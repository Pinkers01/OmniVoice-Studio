import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { copyText } from "../utils/copyText";
import {
  ChevronUp, ChevronDown, RefreshCw, Trash2, Copy, Bug, X,
  AlertTriangle, AlertCircle, Info, FileText, Heart, Download,
  Search, FileDown, WrapText,
} from 'lucide-react';
import UpdatesPanel from './UpdatesPanel';
import UpdateStatusChip from './UpdateStatusChip';
import toast from 'react-hot-toast';
import { clearSystemLogs, clearTauriLogs } from '../api/system';
import { useSystemLogs, useTauriLogs, useClearLogs, useClearTauriLogs } from '../api/hooks';
import { getFrontendLogs, clearFrontendLogs } from '../utils/consoleBuffer';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import NetworkToggle from './NetworkToggle';
import './LogsFooter.css';

/**
 * VSCode-style bottom panel for logs. Always-visible 28 px collapsed bar
 * shows error/warning counts per source (Backend, Frontend, Tauri); click
 * any pill or the chevron to expand into a resizable panel. State — which
 * tab is active, is it collapsed, panel height — persists in localStorage
 * so the panel remembers where the user left it across launches.
 */

const SOURCES = [
  { id: 'backend',  label: 'Backend',  icon: FileText },
  { id: 'frontend', label: 'Frontend', icon: FileText },
  { id: 'tauri',    label: 'Tauri',    icon: FileText },
  { id: 'updates',  label: 'Updates',  icon: Download },
];

const LS_HEIGHT = 'omnivoice.logs.height';
const LS_ACTIVE = 'omnivoice.logs.active';

const MIN_H = 180;
const MAX_H = 720;

const RE_ERROR = /\b(error|fatal|exception|traceback)\b/i;
const RE_WARN  = /\b(warn(ing)?|deprecated)\b/i;

function classifyLine(raw) {
  const text = typeof raw === 'string' ? raw : (raw?.msg ?? String(raw));
  if (RE_ERROR.test(text)) return 'error';
  if (RE_WARN.test(text))  return 'warn';
  return 'info';
}

function countLevels(lines) {
  let error = 0, warn = 0;
  for (const l of lines) {
    const sev = classifyLine(l);
    if (sev === 'error') error++;
    else if (sev === 'warn') warn++;
  }
  return { error, warn, total: lines.length };
}

function formatFrontendLine(entry) {
  const ts = new Date(entry.t).toISOString().slice(11, 23);
  return `[${ts}] ${entry.level.toUpperCase()} ${entry.msg}`;
}

function SeverityIcon({ level, size = 11 }) {
  if (level === 'error') return <AlertCircle size={size} color="#fb4934" />;
  if (level === 'warn')  return <AlertTriangle size={size} color="#25e8a0" />;
  return <Info size={size} color="#6f9ab2" />;
}

function SourcePill({ source, counts, active, onClick }) {
  const hasErrors = counts.error > 0;
  const hasWarns  = counts.warn > 0;
  return (
    <button
      type="button"
      className={[
        'logs-footer__pill',
        active ? 'logs-footer__pill--active' : '',
        hasErrors ? 'logs-footer__pill--error' : hasWarns ? 'logs-footer__pill--warn' : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-label={`${source.label} logs${hasErrors ? `, ${counts.error} errors` : hasWarns ? `, ${counts.warn} warnings` : ''}`}
    >
      <span className="logs-footer__pill-label">{source.label}</span>
      {hasErrors && (
        <span className="logs-footer__badge logs-footer__badge--error">{counts.error}</span>
      )}
      {!hasErrors && hasWarns && (
        <span className="logs-footer__badge logs-footer__badge--warn">{counts.warn}</span>
      )}
      {!hasErrors && !hasWarns && counts.total > 0 && (
        <span className="logs-footer__badge">{counts.total}</span>
      )}
    </button>
  );
}

const HEART_POOL = ['❤️', '🩷', '💜', '💙', '🧡', '💛', '🩵', '💖', '💗'];
const SEASONAL = [
  { month: 12, emoji: '🎄',  color: '#e74c3c', title: 'Merry Christmas! Support this project' },
  { month: 2,  emoji: '💝',  color: '#ff6b81', title: 'Happy Valentine\'s! Support this project' },
  { month: 10, emoji: '🪔',  color: '#f5a623', title: 'Happy Diwali! Support this project' },
  { month: 11, emoji: '✨',  color: '#f5a623', title: 'Happy Diwali! Support this project' },
];

function DonateHeart() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);

  const seasonal = SEASONAL.find(s => s.month === month);
  if (seasonal) {
    return <span style={{ fontSize: 14, lineHeight: 1 }} title={seasonal.title}>{seasonal.emoji}</span>;
  }
  const pick = HEART_POOL[dayOfYear % HEART_POOL.length];
  return <span style={{ fontSize: 14, lineHeight: 1 }}>{pick}</span>;
}

const FILTER_LEVELS = ['info', 'warn', 'error'];

export default function LogsFooter() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('omnivoice.logs.collapsed');
  }
  const [collapsed, setCollapsed] = useState(true);
  const { t } = useTranslation();
  const [height, setHeight] = useState(() => {
    const v = Number(localStorage.getItem(LS_HEIGHT));
    return Number.isFinite(v) && v >= MIN_H && v <= MAX_H ? v : 300;
  });
  const [active, setActive] = useState(() => {
    const v = localStorage.getItem(LS_ACTIVE);
    return SOURCES.some(s => s.id === v) ? v : 'backend';
  });

  const [lines, setLines] = useState({ backend: [], frontend: [], tauri: [] });
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [hfInput, setHfInput] = useState('');
  const scrollRef = useRef(null);

  // ── New tooling state ─────────────────────────────────────────────────
  const [filterLevels, setFilterLevels] = useState({ info: true, warn: true, error: true });
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [wrapLines, setWrapLines] = useState(true);

  useEffect(() => localStorage.setItem(LS_HEIGHT, String(height)), [height]);
  useEffect(() => localStorage.setItem(LS_ACTIVE, active),         [active]);

  useEffect(() => {
    const h = collapsed ? 28 : height;
    document.documentElement.style.setProperty('--logs-footer-height', `${h}px`);
    return () => {
      document.documentElement.style.setProperty('--logs-footer-height', '28px');
    };
  }, [collapsed, height]);

  // ── TanStack Query for backend + tauri logs ────────────────────────────
  const backendLogs = useSystemLogs(300, true);
  const tauriLogs   = useTauriLogs(300, true);

  useEffect(() => {
    if (backendLogs.data) {
      setLines(prev => ({ ...prev, backend: backendLogs.data.lines || [] }));
    }
  }, [backendLogs.data]);

  useEffect(() => {
    if (tauriLogs.data) {
      setLines(prev => ({ ...prev, tauri: tauriLogs.data.lines || [] }));
    }
  }, [tauriLogs.data]);

  const pullFrontend = useCallback(() => {
    const raw = getFrontendLogs();
    setLines(prev => ({
      ...prev,
      frontend: raw.map(formatFrontendLine),
    }));
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    backendLogs.refetch();
    tauriLogs.refetch();
    pullFrontend();
    setLoading(false);
  }, [backendLogs, tauriLogs, pullFrontend]);

  useEffect(() => {
    pullFrontend();
    const iv = setInterval(pullFrontend, collapsed ? 8000 : 3000);
    return () => clearInterval(iv);
  }, [pullFrontend, collapsed]);

  // ── Notifications polling ──────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const { API } = await import('../api/client');
      const res = await fetch(`${API}/system/notifications`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch { /* backend not ready */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const iv = setInterval(fetchNotifications, 30000);
    return () => clearInterval(iv);
  }, [fetchNotifications]);

  useEffect(() => {
    const handler = () => {
      setActive('notifications');
      setCollapsed(false);
    };
    window.addEventListener('omni:open-notifications', handler);
    return () => window.removeEventListener('omni:open-notifications', handler);
  }, []);

  // Auto-scroll when new lines arrive — respects the toggle
  useEffect(() => {
    if (collapsed || !autoScroll) return;
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    if (atBottom) el.scrollTop = el.scrollHeight;
  }, [lines, active, collapsed, autoScroll]);

  // Reset search + filters when switching tabs
  useEffect(() => {
    setSearchTerm('');
    setFilterLevels({ info: true, warn: true, error: true });
  }, [active]);

  const counts = useMemo(() => ({
    backend:  countLevels(lines.backend),
    frontend: countLevels(lines.frontend),
    tauri:    countLevels(lines.tauri),
    updates:  { error: 0, warn: 0, total: 0 },
    notifications: {
      error: notifications.filter(n => n.level === 'error').length,
      warn: notifications.filter(n => n.level === 'warn').length,
      total: notifications.length,
    },
  }), [lines, notifications]);

  const openTo = (id) => { setActive(id); setCollapsed(false); };

  // ── Resize handle ─────────────────────────────────────────────────────
  const dragRef = useRef(null);
  const onDragStart = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    const move = (ev) => {
      const dy = startY - ev.clientY;
      const next = Math.min(MAX_H, Math.max(MIN_H, startH + dy));
      setHeight(next);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // ── Toggle a single filter level ──────────────────────────────────────
  const toggleFilter = (level) => {
    setFilterLevels(prev => ({ ...prev, [level]: !prev[level] }));
  };

  // ── Filtered lines ────────────────────────────────────────────────────
  const currentRaw = lines[active] || [];
  const filteredLines = useMemo(() => {
    let result = currentRaw;
    result = result.filter(line => {
      const lvl = classifyLine(line);
      return filterLevels[lvl];
    });
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(line => {
        const text = typeof line === 'string' ? line : JSON.stringify(line);
        return text.toLowerCase().includes(q);
      });
    }
    return result;
  }, [currentRaw, filterLevels, searchTerm]);

  // ── Actions ───────────────────────────────────────────────────────────
  const onClear = async () => {
    try {
      if (active === 'backend')       await clearSystemLogs();
      else if (active === 'tauri')    await clearTauriLogs();
      else if (active === 'frontend') clearFrontendLogs();
      setLines(prev => ({ ...prev, [active]: [] }));
      toast.success(t('logs.log_cleared', { source: active }));
    } catch (e) {
      toast.error(t('logs.clear_failed', { message: e?.message || e }));
    }
  };

  const onCopy = async () => {
    try {
      const raw = filteredLines.join('\n');
      await copyText(raw);
      toast.success(t('logs.log_copied', { source: active }));
    } catch (e) {
      toast.error(t('logs.copy_failed', { message: e?.message || e }));
    }
  };

  const onSaveFile = () => {
    try {
      const raw = filteredLines.join('\n');
      const blob = new Blob([raw], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `omnivoice-${active}-${ts}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('logs.save_success'));
    } catch (e) {
      toast.error(t('logs.save_failed', { message: e?.message || e }));
    }
  };

  const onReportIssue = async () => {
    const header = [
      `OmniVoice Studio — diagnostic report`,
      `When: ${new Date().toISOString()}`,
      `UA: ${navigator.userAgent}`,
      `Counts: backend err=${counts.backend.error}/warn=${counts.backend.warn}, ` +
        `frontend err=${counts.frontend.error}/warn=${counts.frontend.warn}, ` +
        `tauri err=${counts.tauri.error}/warn=${counts.tauri.warn}`,
      '',
    ].join('\n');
    const body = SOURCES.map(s => {
      const l = lines[s.id] || [];
      return `── ${s.label} (last ${Math.min(l.length, 80)} of ${l.length}) ──────────────\n` +
        l.slice(-80).join('\n');
    }).join('\n\n');
    try {
      await copyText(header + body);
      toast.success(t('logs.report_copied'));
    } catch (e) {
      toast.error(t('logs.report_failed', { message: e?.message || e }));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  const notifCounts = { error: 0, warn: notifications.filter(n => n.level === 'warn').length + notifications.filter(n => n.level === 'error').length, total: notifications.length };

  return (
    <div className={['logs-footer', collapsed ? 'logs-footer--collapsed' : 'logs-footer--open'].join(' ')}
         style={collapsed ? undefined : { height }}>
      {!collapsed && (
        <div
          ref={dragRef}
          className="logs-footer__resize"
          onMouseDown={onDragStart}
          title={t('logs.drag_resize')}
        />
      )}

      <div className="logs-footer__bar">
        <div className="logs-footer__left">
          <button
            type="button"
            className="logs-footer__toggle"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? t('logs.expand') : t('logs.collapse')}
            aria-label={collapsed ? t('logs.expand_aria') : t('logs.collapse_aria')}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <span className="logs-footer__title">{t('logs.title')}</span>
          {SOURCES.map(s => (
            <SourcePill
              key={s.id}
              source={s}
              counts={counts[s.id]}
              active={!collapsed && active === s.id}
              onClick={() => (collapsed ? openTo(s.id) : setActive(s.id))}
            />
          ))}
        </div>
        <div className="logs-footer__right">
          {!collapsed && (
            <div className="logs-footer__actions">
              <button className="logs-footer__icon-btn" onClick={refreshAll} disabled={loading} title={t('logs.refresh')} aria-label={t('logs.refresh_aria')}>
                <RefreshCw size={12} className={loading ? 'spinner' : ''} />
              </button>
              <button className="logs-footer__icon-btn" onClick={onCopy} title={t('logs.copy_all')} aria-label={t('logs.copy_all')}>
                <Copy size={12} />
              </button>
              <button className="logs-footer__icon-btn" onClick={onSaveFile} title={t('logs.save_file')} aria-label={t('logs.save_file')}>
                <FileDown size={12} />
              </button>
              <button className="logs-footer__icon-btn" onClick={onClear} title={t('logs.clear')} aria-label={t('logs.clear_aria')}>
                <Trash2 size={12} />
              </button>
              <button className="logs-footer__icon-btn logs-footer__icon-btn--report" onClick={onReportIssue} title={t('logs.report_issue')} aria-label={t('logs.report_issue_aria')}>
                <Bug size={12} />
              </button>
              <button className="logs-footer__icon-btn" onClick={() => setCollapsed(true)} title={t('logs.close')} aria-label={t('logs.close_aria')}>
                <X size={12} />
              </button>
            </div>
          )}
          <UpdateStatusChip onOpen={() => openTo('updates')} />
          <NetworkToggle />
          <button
            type="button"
            className="logs-footer__discord"
            onClick={() => { import('../api/external').then(m => m.openExternal('https://discord.gg/bzQavDfVV9')); }}
            title={t('logs.join_discord')}
            aria-label={t('logs.join_discord_aria')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z"/></svg>
          </button>
          <button
            type="button"
            className="logs-footer__donate"
            onClick={() => useAppStore.getState().setMode?.('donate')}
            title={t('logs.support_project')}
            aria-label={t('logs.support_project_aria')}
          >
            <DonateHeart />
          </button>
        </div>
      </div>

      {/* ── Toolbar: filters + search + toggles (only when expanded) ── */}
      {!collapsed && active !== 'updates' && active !== 'notifications' && (
        <div className="logs-footer__toolbar">
          <div className="logs-footer__toolbar-left">
            <span className="logs-footer__toolbar-label">{t('logs.filter_info')}</span>
            {FILTER_LEVELS.map(lvl => (
              <label key={lvl} className={`logs-footer__filter-chip logs-footer__filter-chip--${lvl} ${filterLevels[lvl] ? 'logs-footer__filter-chip--on' : ''}`}>
                <input
                  type="checkbox"
                  checked={filterLevels[lvl]}
                  onChange={() => toggleFilter(lvl)}
                  className="logs-footer__filter-check"
                />
                <SeverityIcon level={lvl} size={10} />
                <span>{lvl === 'info' ? t('logs.filter_info') : lvl === 'warn' ? t('logs.filter_warning') : t('logs.filter_error')}</span>
              </label>
            ))}
          </div>
          <div className="logs-footer__toolbar-right">
            <div className="logs-footer__search-wrap">
              <Search size={12} className="logs-footer__search-icon" />
              <input
                type="text"
                className="logs-footer__search-input"
                placeholder={t('logs.search_placeholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                aria-label={t('logs.search')}
              />
            </div>
            <label className="logs-footer__toggle-chip" title={t('logs.autoscroll')}>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={() => setAutoScroll(a => !a)}
              />
              <span>{t('logs.autoscroll')}</span>
            </label>
            <label className="logs-footer__toggle-chip" title={t('logs.wrap')}>
              <input
                type="checkbox"
                checked={wrapLines}
                onChange={() => setWrapLines(w => !w)}
              />
              <WrapText size={11} />
              <span>{t('logs.wrap')}</span>
            </label>
          </div>
        </div>
      )}

      {!collapsed && active === 'updates' && (
        <div className="logs-footer__body">
          <UpdatesPanel />
        </div>
      )}

      {!collapsed && active !== 'notifications' && active !== 'updates' && (
        <div ref={scrollRef} className="logs-footer__body">
          {currentRaw.length === 0 && (
            <div className="logs-footer__empty">
              {active === 'frontend' ? t('logs.empty_frontend_short') : t('logs.empty_lines')}
            </div>
          )}
          {currentRaw.length > 0 && filteredLines.length === 0 && (
            <div className="logs-footer__empty">
              {t('logs.no_lines_match')}
            </div>
          )}
          {filteredLines.map((line, i) => {
            const level = classifyLine(line);
            return (
              <div key={i} className={`logs-footer__line logs-footer__line--${level}`}>
                <span className="logs-footer__line-icon"><SeverityIcon level={level} /></span>
                <pre className={['logs-footer__line-text', !wrapLines ? 'logs-footer__line-text--nowrap' : ''].filter(Boolean).join(' ')}>{typeof line === 'string' ? line : JSON.stringify(line)}</pre>
              </div>
            );
          })}
        </div>
      )}

      {!collapsed && active === 'notifications' && (
        <div className="logs-footer__body logs-footer__notif-body">
          {notifications.length === 0 ? (
            <div className="logs-footer__empty">
              {t('logs.all_clear')}
            </div>
          ) : (
            notifications.map(notif => (
              <div
                key={notif.id}
                className={`logs-footer__notif-item logs-footer__notif-item--${notif.level} ${notif.action ? 'logs-footer__notif-item--clickable' : ''}`}
                onClick={() => {
                  if (!notif.action) return;
                  if (notif.action.type === 'navigate') {
                    useAppStore.getState().setMode?.(notif.action.target);
                    setCollapsed(true);
                  } else if (notif.action.type === 'link') {
                    import('../api/external').then(m => m.openExternal(notif.action.target));
                  }
                }}
                role={notif.action ? 'button' : undefined}
                tabIndex={notif.action ? 0 : undefined}
              >
                <span className="logs-footer__notif-icon">
                  <SeverityIcon level={notif.level} />
                </span>
                <div className="logs-footer__notif-content">
                  <strong>{notif.title}</strong>
                  <span className="logs-footer__notif-msg">{notif.message}</span>
                </div>
                {notif.action && (
                  <span className="logs-footer__notif-action">
                    {notif.action.label} →
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
