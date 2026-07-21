export const POPULAR_LANGS = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Russian', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi',
];

export const POPULAR_ISO = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi',
];

export const TAGS = [
  '[laughter]', '[sigh]', '[confirmation-en]', '[question-en]',
  '[question-ah]', '[question-oh]', '[question-ei]', '[question-yi]',
  '[surprise-ah]', '[surprise-oh]', '[surprise-wa]', '[surprise-yo]',
  '[dissatisfaction-hnn]',
];

// Ordered list of the emotion-tag groups shown in TagPalette. Order here
// drives render order in the UI (emotions first, then questions, then
// surprise reactions).
export const TAG_GROUPS = ['emotions', 'questions', 'surprise'];

// Human-friendly metadata for each raw tag chip in TAGS: an emoji, an
// i18n key resolving to a plain-language Polish/English label, and the
// group it belongs to (see TAG_GROUPS). Consumed by <TagPalette>.
export const TAG_META = [
  { tag: '[laughter]', emoji: '😄', labelKey: 'clone.tags.laughter', group: 'emotions' },
  { tag: '[sigh]', emoji: '😮‍💨', labelKey: 'clone.tags.sigh', group: 'emotions' },
  { tag: '[dissatisfaction-hnn]', emoji: '😒', labelKey: 'clone.tags.dissatisfaction_hnn', group: 'emotions' },

  { tag: '[confirmation-en]', emoji: '🙂', labelKey: 'clone.tags.confirmation_en', group: 'questions' },
  { tag: '[question-en]', emoji: '❓', labelKey: 'clone.tags.question_en', group: 'questions' },
  { tag: '[question-ah]', emoji: '❓', labelKey: 'clone.tags.question_ah', group: 'questions' },
  { tag: '[question-oh]', emoji: '❓', labelKey: 'clone.tags.question_oh', group: 'questions' },
  { tag: '[question-ei]', emoji: '❓', labelKey: 'clone.tags.question_ei', group: 'questions' },
  { tag: '[question-yi]', emoji: '❓', labelKey: 'clone.tags.question_yi', group: 'questions' },

  { tag: '[surprise-ah]', emoji: '😲', labelKey: 'clone.tags.surprise_ah', group: 'surprise' },
  { tag: '[surprise-oh]', emoji: '😲', labelKey: 'clone.tags.surprise_oh', group: 'surprise' },
  { tag: '[surprise-wa]', emoji: '😲', labelKey: 'clone.tags.surprise_wa', group: 'surprise' },
  { tag: '[surprise-yo]', emoji: '😲', labelKey: 'clone.tags.surprise_yo', group: 'surprise' },
];

export const CATEGORIES = {
  Gender: ['Auto', 'male', 'female'],
  Age: ['Auto', 'child', 'teenager', 'young adult', 'middle-aged', 'elderly'],
  Pitch: ['Auto', 'very low pitch', 'low pitch', 'moderate pitch', 'high pitch', 'very high pitch'],
  Style: ['Auto', 'whisper'],
  EnglishAccent: [
    'Auto', 'american accent', 'british accent', 'australian accent', 'canadian accent',
    'indian accent', 'chinese accent', 'korean accent', 'japanese accent',
    'portuguese accent', 'russian accent',
  ],
  ChineseDialect: [
    'Auto', '河南话', '陕西话', '四川话', '贵州话', '云南话', '桂林话',
    '济南话', '石家庄话', '甘肃话', '宁夏话', '青岛话', '东北话',
  ],
};

export const PRESETS = [
  { id: 'narrator', name: '🎙️ Authoritative', tags: '',
    attrs: { Gender: 'male', Age: 'middle-aged', Pitch: 'low pitch', Style: 'Auto', EnglishAccent: 'british accent', ChineseDialect: 'Auto' } },
  { id: 'excited_child', name: '🧒 Excited Child', tags: '[laughter] ',
    attrs: { Gender: 'Auto', Age: 'child', Pitch: 'high pitch', Style: 'Auto', EnglishAccent: 'Auto', ChineseDialect: 'Auto' } },
  { id: 'anxious_whisper', name: '🤫 Whisper', tags: '[question-en] ',
    attrs: { Gender: 'Auto', Age: 'young adult', Pitch: 'Auto', Style: 'whisper', EnglishAccent: 'Auto', ChineseDialect: 'Auto' } },
  { id: 'surprised_woman', name: '😲 Surprised', tags: '[surprise-wa] ',
    attrs: { Gender: 'female', Age: 'young adult', Pitch: 'high pitch', Style: 'Auto', EnglishAccent: 'Auto', ChineseDialect: 'Auto' } },
  { id: 'elderly_story', name: '👴 Elder', tags: '[sigh] ',
    attrs: { Gender: 'male', Age: 'elderly', Pitch: 'very low pitch', Style: 'Auto', EnglishAccent: 'Auto', ChineseDialect: 'Auto' } },
  { id: 'sichuan', name: '🌶️ 四川话', tags: '',
    attrs: { Gender: 'female', Age: 'young adult', Pitch: 'moderate pitch', Style: 'Auto', EnglishAccent: 'Auto', ChineseDialect: '四川话' } },
];

// Ref audio do klonowania: do 5 minut (lepszy kontekst + dopasowanie głosu).
export const CLONE_MAX_SECONDS = 300;

// Instruct items recognised by the backend validator. Items outside this set
// cause ValidationFailed at generation time.
export const VALID_INSTRUCT_ITEMS = [
  'american accent', 'australian accent', 'british accent', 'canadian accent',
  'child', 'chinese accent', 'elderly', 'female', 'high pitch', 'indian accent',
  'japanese accent', 'korean accent', 'low pitch', 'male', 'middle-aged',
  'moderate pitch', 'portuguese accent', 'russian accent', 'teenager',
  'very high pitch', 'very low pitch', 'whisper', 'young adult',
];
