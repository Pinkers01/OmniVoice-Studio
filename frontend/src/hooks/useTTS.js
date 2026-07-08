import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '../store';
import { generateSpeech, audioUrlWithCacheBust } from '../api/generate';
import { createProfile } from '../api/profiles';
import { playBlobAudio, playPing } from '../utils/media';
import { probeAudioDuration } from '../utils/format';
import { CLONE_MAX_SECONDS, PRESETS } from '../utils/constants';
import { buildDesignInstruct } from '../utils/voiceInstruct';
import { toast } from 'react-hot-toast';
import i18next from 'i18next';
const t = i18next.t.bind(i18next);

/**
 * Encapsulates TTS generation logic, streaming response handling,
 * audio ingestion (with trim gate), and preset/tag helpers.
 */
export default function useTTS({ selectedProfile, setSelectedProfile, loadHistory, loadProfiles }) {
  const text = useAppStore(s => s.text);
  const setText = useAppStore(s => s.setText);
  const language = useAppStore(s => s.language);
  const instruct = useAppStore(s => s.instruct);
  const refText = useAppStore(s => s.refText);
  const speed = useAppStore(s => s.speed);
  const steps = useAppStore(s => s.steps);
  const cfg = useAppStore(s => s.cfg);
  const denoise = useAppStore(s => s.denoise);
  const tShift = useAppStore(s => s.tShift);
  const posTemp = useAppStore(s => s.posTemp);
  const classTemp = useAppStore(s => s.classTemp);
  const layerPenalty = useAppStore(s => s.layerPenalty);
  const postprocess = useAppStore(s => s.postprocess);
  const duration = useAppStore(s => s.duration);
  const vdStates = useAppStore(s => s.vdStates);
  const mode = useAppStore(s => s.mode);
  const setSidebarTab = useAppStore(s => s.setSidebarTab);

  const [refAudio, setRefAudio] = useState(null);
  const [pendingTrimFile, setPendingTrimFile] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationTime, setGenerationTime] = useState(0);
  // Last synthesized result, surfaced as an on-screen player + download button
  // so the user can save the audio without hunting through the history sidebar.
  const [lastAudioUrl, setLastAudioUrl] = useState(null);   // object URL for in-app playback
  const [lastAudioPath, setLastAudioPath] = useState(null); // server path for native/HTTP download
  const lastUrlRef = useRef(null);
  const timerRef = useRef(null);
  const textAreaRef = useRef(null);

  const ingestRefAudio = useCallback(async (file) => {
    if (!file) { setRefAudio(null); return; }
    const dur = await probeAudioDuration(file);
    if (dur && dur > CLONE_MAX_SECONDS) {
      setPendingTrimFile(file);
      setSelectedProfile(null);
      toast(t('tts_errors.trim_hint', { duration: dur.toFixed(1), max: CLONE_MAX_SECONDS }));
      return;
    }
    setRefAudio(file);
    setSelectedProfile(null);
  }, [setSelectedProfile]);

  const insertTag = useCallback((tag) => {
    if (!textAreaRef.current) return;
    const start = textAreaRef.current.selectionStart;
    const end = textAreaRef.current.selectionEnd;
    setText(text.substring(0, start) + tag + text.substring(end));
    setTimeout(() => { textAreaRef.current.focus(); textAreaRef.current.setSelectionRange(start + tag.length, start + tag.length); }, 0);
  }, [text, setText]);

  const applyPreset = useCallback((preset) => {
    useAppStore.getState().setVdStates(preset.attrs);
    if (preset.tags && !text.includes(preset.tags.trim())) insertTag(preset.tags);
  }, [text, insertTag]);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) return toast.error(t('tts_errors.enter_text'));
    // Pinky fix: brak profilu/ref w trybie clone NIE blokuje — generujemy domyślnym głosem.
    const cloneNoSource = mode === 'clone' && !refAudio && !selectedProfile;
    // ad-hoc głos (wgrany/nagrany, jeszcze nie profil) → po generacji zapamiętamy go jako profil
    const wasAdHoc = mode === 'clone' && !!refAudio && !selectedProfile;
    setIsGenerating(true);
    setGenerationTime(0);
    const st = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = ((Date.now() - st) / 1000).toFixed(1);
      setGenerationTime(prev => {
        const suffix = /\(\d+%\)$/.exec(String(prev))?.[0];
        return suffix ? `${elapsed} ${suffix}` : elapsed;
      });
    }, 100);
    let abortTimer = null;
    try {
      const formData = new FormData();
      formData.append("text", text);
      if (language !== 'Auto') formData.append("language", language);
      formData.append("num_step", steps);
      formData.append("guidance_scale", cfg);
      formData.append("speed", speed);
      formData.append("denoise", denoise);
      formData.append("t_shift", tShift);
      formData.append("position_temperature", posTemp);
      formData.append("class_temperature", classTemp);
      formData.append("layer_penalty_factor", layerPenalty);
      formData.append("postprocess_output", postprocess);
      if (duration) formData.append("duration", parseFloat(duration));

      if (mode === 'clone') {
        if (selectedProfile) {
          formData.append("profile_id", selectedProfile);
        } else if (refAudio) {
          const arrBuf = await refAudio.arrayBuffer();
          const safeBlob = new Blob([arrBuf], { type: refAudio.type });
          formData.append("ref_audio", safeBlob, refAudio.name || "audio.wav");
          formData.append("ref_text", refText);
        } else if (cloneNoSource) {
          // brak źródła → domyślny głos (random seed), żeby synteza zawsze działała
          formData.append("seed", Math.floor(Math.random() * 2147483647));
        }
        if (instruct) formData.append("instruct", instruct);
      } else {
        const designSeed = Math.floor(Math.random() * 2147483647);
        formData.append("seed", designSeed);
        // plan-05 (#132): build a validator-safe instruct (one valid tag per
        // category; drop unsupported free-text) so Synthesize stops failing
        // with "Unsupported instruct items" (#115) / "conflicting items within
        // the same category" (#114).
        const { instruct: finalInstruct, unsupported, duplicates } = buildDesignInstruct(vdStates, instruct);
        if (unsupported.length) {
          toast(t('tts_errors.ignored_unsupported', { items: unsupported.join(', ') }), { icon: '⚠️' });
        }
        if (duplicates.length) {
          toast(t('tts_errors.ignored_duplicate', { items: duplicates.join(', ') }), { icon: '⚠️' });
        }
        if (finalInstruct) formData.append("instruct", finalInstruct);
        if (selectedProfile) {
          formData.append("profile_id", selectedProfile);
        }
      }

      // The first /generate may cold-load/download the model. The backend now
      // bounds that and returns an error rather than hanging; this client-side
      // abort is a backstop so the UI never spins forever even if the backend
      // is unreachable. The ceiling sits just above the backend's load timeout
      // so the backend's descriptive error wins in the normal case.
      const ac = new AbortController();
      abortTimer = setTimeout(() => ac.abort(), 21 * 60 * 1000);
      const response = await generateSpeech(formData, { signal: ac.signal });
      const reader = response.body.getReader();
      const chunks = [];
      let receivedLength = 0;
      const contentLength = parseInt(response.headers.get('Content-Length') || '0', 10);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
        if (contentLength > 0) {
          const pct = Math.round((receivedLength / contentLength) * 100);
          setGenerationTime(prev => `${prev.toString().split(' ')[0]} (${pct}%)`);
        }
      }

      const blob = new Blob(chunks, { type: 'audio/wav' });
      // Surface the result on-screen: revoke the previous object URL, expose a
      // fresh one for the inline player + download button.
      if (lastUrlRef.current) { try { URL.revokeObjectURL(lastUrlRef.current); } catch (e) {} }
      const resUrl = URL.createObjectURL(blob);
      lastUrlRef.current = resUrl;
      setLastAudioUrl(resUrl);
      try { await playBlobAudio(blob); } catch (e) {}

      // ── ZAPAMIĘTAJ GŁOS: pierwszy raz z próbki → auto-zapis jako profil + wybór.
      // Dzięki temu kolejne generacje lecą z tego samego głosu, aż Pinky go zmieni.
      if (wasAdHoc && refAudio) {
        try {
          const ab = await refAudio.arrayBuffer();
          const fd = new FormData();
          const nm = (refAudio.name || 'głos').replace(/\.[^.]+$/, '').slice(0, 24);
          fd.append('name', `${nm} ${Math.floor(Math.random() * 9000 + 1000)}`);
          fd.append('ref_audio', new Blob([ab], { type: refAudio.type || 'audio/wav' }), refAudio.name || 'voice.wav');
          fd.append('ref_text', refText || '');
          fd.append('instruct', instruct || '');
          fd.append('language', language || 'Auto');
          const prof = await createProfile(fd);
          if (prof?.id) { setSelectedProfile(prof.id); setRefAudio(null); }
          if (loadProfiles) await loadProfiles();
          toast.success(t('clone.voice_remembered', { defaultValue: '🎙️ Głos zapamiętany — możesz generować dalej' }));
        } catch (e) { /* zapamiętanie best-effort, nie blokuje generacji */ }
      }

      await loadHistory();
      // Newest history row carries the server-side audio_path that the native
      // (Tauri) save dialog + HTTP download both need.
      try { setLastAudioPath(useAppStore.getState().history?.[0]?.audio_path || null); } catch (e) {}
      setSidebarTab('history');
      playPing();
    } catch (err) {
      const msg = err?.name === 'AbortError'
        ? t('tts_errors.timeout')
        : t('tts_errors.error_prefix', { message: err.message });
      toast.error(msg);
    } finally {
      if (abortTimer) clearTimeout(abortTimer);
      clearInterval(timerRef.current);
      setIsGenerating(false);
    }
  }, [text, mode, selectedProfile, refAudio, refText, language, instruct, steps, cfg, speed, denoise, tShift, posTemp, classTemp, layerPenalty, postprocess, duration, vdStates, loadHistory, setSidebarTab, loadProfiles, setSelectedProfile]);

  return {
    refAudio, setRefAudio,
    pendingTrimFile, setPendingTrimFile,
    isGenerating, generationTime,
    lastAudioUrl, lastAudioPath,
    textAreaRef,
    ingestRefAudio,
    insertTag, applyPreset,
    handleGenerate,
  };
}
