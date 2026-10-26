window.__ModuleLoader__.load({ id: '@local/dsh-provider-card', factory: (require) => {
const React = require('react');

 
 
const DPC_LANG_KEY = 'dsh-provider-card.lang';
const DPC_LANG_DEFAULT = 'zh';
const DPC_LANG_VALUES = ['zh', 'en'];
 
let dpcLang = DPC_LANG_DEFAULT;
try {
  const saved = window.localStorage.getItem(DPC_LANG_KEY);
  if (DPC_LANG_VALUES.indexOf(saved) !== -1) dpcLang = saved;
} catch (_error) {   }
 
let dpcLocaleUi = {};
 
let dpcLocaleCards = {};

 
function dpcGetLang() {
  return (DPC_LANG_VALUES.indexOf(dpcLang) !== -1) ? dpcLang : DPC_LANG_DEFAULT;
}

 
function dpcT(text) {
  if (typeof text !== 'string' || !text) return text;
  if (dpcGetLang() !== 'en') return text;
  const hit = dpcLocaleUi[text];
  return (typeof hit === 'string' && hit) ? hit : text;
}

 
const DPC_TEXT_PROPS = ['title', 'placeholder', 'aria-label', 'alt', 'label'];

 
function dpcTranslateProps(props) {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return props;
  if (dpcGetLang() !== 'en') return props;
  let out = null;
  for (const k of DPC_TEXT_PROPS) {
    const v = props[k];
    if (typeof v !== 'string' || !v) continue;
    const t = dpcT(v);
    if (t !== v) {
      if (!out) out = Object.assign({}, props);
      out[k] = t;
    }
  }
  return out || props;
}

 
function dpcTranslateChild(child) {
  if (typeof child === 'string') return dpcT(child);
  if (Array.isArray(child)) return child.map(dpcTranslateChild);
  return child;
}



const h = (type, props, ...children) => React.createElement(
  type,
  dpcTranslateProps(props),
  ...children.map(dpcTranslateChild),
);

 
function dpcApplyLocale(payload) {
  if (!payload || typeof payload !== 'object') return false;
  let changed = false;
  if (payload.ui && typeof payload.ui === 'object' && !Array.isArray(payload.ui)) {
    dpcLocaleUi = payload.ui;
    changed = true;
  }
  if (payload.cards && typeof payload.cards === 'object' && !Array.isArray(payload.cards)) {
    dpcLocaleCards = payload.cards;
    changed = true;
  }
  if (!changed) return false;
  
  if (typeof dpcRebuildCards === 'function') dpcRebuildCards();
  
  if (typeof dpcPersonaRepaint === 'function') dpcPersonaRepaint();
  return true;
}

 
function dpcSetLang(lang) {
  const v = (DPC_LANG_VALUES.indexOf(lang) !== -1) ? lang : DPC_LANG_DEFAULT;
  dpcLang = v;
  try { window.localStorage.setItem(DPC_LANG_KEY, v); } catch (_error) {   }
  if (typeof dpcRebuildCards === 'function') dpcRebuildCards();
  if (typeof dpcPersonaRepaint === 'function') dpcPersonaRepaint();
  return v;
}



























const DEFAULT_COOLDOWN_MS = 10 * 60 * 1000;   
const STATUS_READY = 'ready';
const STATUS_SELECTING = 'selecting';

 
function selectionKey(sel) {
  if (!sel) return null;
  const p = sel.provider == null ? '' : String(sel.provider);
  const m = sel.model == null ? '' : String(sel.model);
  const e = sel.reasoningEffort == null ? '' : String(sel.reasoningEffort);
  return `${p}|${m}|${e}`;
}

function createWatcher(options) {
  const opts = options || {};
  
  let cooldownMs = Number.isFinite(opts.cooldownMs) ? opts.cooldownMs : DEFAULT_COOLDOWN_MS;
  const now = typeof opts.now === 'function' ? opts.now : () => Date.now();
  const onSummon = typeof opts.onSummon === 'function' ? opts.onSummon : null;

  let baselineKey = null;        
  let hasBaseline = false;
  let lastKey = null;            
  
  
  const summonAt = new Map();    
  let lastSummonKey = null;      
  let pending = null;            
  let lastStatus = null;

   
  function markBaseline(snapshot) {
    baselineKey = selectionKey(snapshot && snapshot.current);
    lastKey = baselineKey;
    hasBaseline = true;
    pending = null;
    lastStatus = (snapshot && snapshot.status) || null;
    return { baseline: baselineKey };
  }

   
  function observe(snapshot) {
    const s = snapshot || {};
    const status = s.status;
    const key = selectionKey(s.current);
    const t = now();

    
    
    if (Number.isFinite(s.generation) && s.generation !== this_generation()) {
      pending = null;
      setGeneration(s.generation);
      return { summon: false, reason: 'generation-changed', selection: null };
    }

    if (status === STATUS_SELECTING) {
      
      
      pending = { status, selection: s.pending || s.current || null };
      lastStatus = status;
      return { summon: false, reason: 'selecting', selection: null };
    }

    if (status !== STATUS_READY) {
      
      
      
      
      
      
      
      
      
      const incoming = s.pending || null;
      if (incoming) pending = { status, selection: incoming };
      else if (status === 'idle') pending = null;
      lastStatus = status;
      return { summon: false, reason: 'status-not-ready', selection: null };
    }

    
    const pendingKey = pending ? selectionKey(pending.selection) : null;
    
    
    const arrivedFromSelecting = lastStatus === STATUS_SELECTING
      || (pending !== null && (lastStatus === 'loading' || lastStatus === 'idle'));
    lastStatus = status;

    if (!arrivedFromSelecting) {
      
      
      
      
      
      lastKey = key;
      return { summon: false, reason: 'no-pending-selecting', selection: null };
    }

    
    if (pendingKey === null || pendingKey !== key) {
      pending = null;
      lastKey = key;
      return { summon: false, reason: 'pending-mismatch', selection: null };
    }

    
    
    
    if (key === lastKey) {
      pending = null;
      return { summon: false, reason: 'same-as-last', selection: null };
    }

    
    if (s.visible === false) {
      pending = null;
      lastKey = key;
      return { summon: false, reason: 'not-visible', selection: null };
    }

    
    const prevAt = summonAt.get(key);
    if (prevAt !== undefined && t - prevAt < cooldownMs) {
      pending = null;
      lastKey = key;
      return { summon: false, reason: 'cooldown', selection: null };
    }

    pending = null;
    lastKey = key;
    summonAt.set(key, t);
    lastSummonKey = key;
    const result = { summon: true, reason: 'switched', selection: s.current };
    if (onSummon) onSummon(s.current, t);
    return result;
  }

  
  let _generation = null;
  const this_generation = () => _generation;
  const setGeneration = (g) => { _generation = g; };

   
  function setCooldownMs(ms) {
    const v = Number(ms);
    if (Number.isFinite(v) && v > 0) cooldownMs = v;
    return cooldownMs;
  }

  return {
    observe,
    markBaseline,
    setCooldownMs,
     
    state() {
      return {
        baselineKey,
        hasBaseline,
        lastKey,
        lastSummonKey,
        summonAt: Array.from(summonAt.entries()),
        pendingKey: pending ? selectionKey(pending.selection) : null,
        lastStatus,
        cooldownMs,
      };
    },
    reset() {
      baselineKey = null;
      hasBaseline = false;
      lastKey = null;
      lastSummonKey = null;
      summonAt.clear();
      pending = null;
      lastStatus = null;
      _generation = null;
    },
  };
}



 
const KEYS = ['智力', '编码', '速度', '稳定', '性价比', '上下文'];

 
const SRC = { 智力: '外部', 编码: '外部', 速度: '实测', 稳定: '实测', 性价比: '实测', 上下文: '目录' };

 
const EFFORT_MODS = {
  none: { 智力: -10, 编码: -6, 速度: 12, 性价比: 8 },
  low: { 智力: -6, 编码: -3, 速度: 8, 性价比: 5 },
  medium: {},
  high: { 智力: 4, 编码: 3, 速度: -6, 性价比: -4 },
  xhigh: { 智力: 6, 编码: 4, 速度: -10, 性价比: -7 },
  max: { 智力: 8, 编码: 5, 速度: -14, 性价比: -10 },
};

const EFF_LABEL = { none: '关', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' };

 
function mulAdjust(mul) {
  const m = Number(mul);
  if (!Number.isFinite(m)) return 0;
  if (m >= 2) return -12;
  if (m <= 0.5) return 6;
  if (m < 1) return 3;
  return 0;
}

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

 
const DEFAULT_LINES = {
  peak: '现在是高峰价，不急的活可以晚点给我。',
  off: '现在有折扣，趁现在。',
  lowQuota: '有点累了……{lbl} 只剩 {left}%，{reset} 后恢复。',
  unknown: '我的余额？我自己也说不清。',
};

 
function nextGlmPeak(d) {
  const n = new Date(d.getTime());
  for (let i = 0; i < 8; i++) {
    const wd = n.getDay() >= 1 && n.getDay() <= 5;
    if (wd && (i > 0 || d.getHours() < 14)) {
      return (i === 0 ? '今天' : i === 1 ? '明天' : WEEKDAY[n.getDay()]) + ' 14:00';
    }
    n.setDate(n.getDate() + 1);
  }
  return '—';
}

 
const TIME_RULES = {
  'zcode-glm': (d) => {
    const h = d.getHours() + d.getMinutes() / 60;
    const wd = d.getDay() >= 1 && d.getDay() <= 5;
    if (wd && h >= 14 && h < 18) {
      return { tone: 'peak', mul: 2, tag: '高峰 ×2', fact: '积分翻倍 · 18:00 结束' };
    }
    return { tone: 'off', mul: 0.5, tag: '非高峰 5 折', fact: '下个高峰 ' + nextGlmPeak(d) };
  },
  'xiaomi-token-plan-cn': (d) => {
    if (d.getHours() < 8) return { tone: 'off', mul: 0.8, tag: '夜间 ×0.8', fact: '08:00 结束' };
    return { tone: 'none', mul: 1, tag: '平时价', fact: '00:00–08:00 为 ×0.8' };
  },
};

 
function timeState(card, date, provider) {
  if (card && card.timeRule === 'off') {
    return { tone: 'none', mul: 1, tag: '不分时段', fact: card.quota && card.quota.pack ? '缓存命中不扣资源包' : '全天同价' };
  }
  const sel = provider == null ? '' : String(provider);
  let name;
  if (sel) {
    
    name = sel;
    if (card && card.timeRule && card.provider != null && String(card.provider) === sel) name = card.timeRule;
  } else {
    name = card && card.timeRule ? card.timeRule : card && card.provider;
  }
  const rule = name ? TIME_RULES[name] : null;
  if (rule) return rule(date);
  return { tone: 'none', mul: 1, tag: '不分时段', fact: card && card.quota && card.quota.pack ? '缓存命中不扣资源包' : '全天同价' };
}

 
const GENERIC_COLORS = [
  ['#5b6b7c', '#39434f'],
  ['#6b7c6a', '#3d4a3e'],
  ['#7c6b7a', '#4a3d4b'],
  ['#7a7466', '#474334'],
];

function hashName(s) {
  const str = String(s == null ? '' : s);
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return h;
}

 
function genericColor(provider) {
  return GENERIC_COLORS[hashName(provider) % GENERIC_COLORS.length];
}

 

 
const QUALIFIERS = ['cn', 'global', 'intl', 'official', 'free', 'pro-fast'];

 
const CHANNEL_NOISE = ['wb', 'hub', 'workbuddy', 'workbuddy2api', 'command', 'commandcode'];

 
const VENDOR_PREFIXES = ['deepseek', 'moonshotai', 'z-ai', 'zai', 'zai-org', 'qwen', 'openai', 'google'];

 
const CHANNEL_PREFIX_HYPHEN = ['antigravity'];

 
const CHANNEL_SUFFIXES = ['cn', 'intl', 'official', 'global'];

 
const PAREN_TAIL = /[(（][^)）]*[)）]/g;

 
const VARIANT_SUFFIXES = ['free', 'tiered', 'latest', 'bf', 'f', 'chat', 'b', 'c'];

 
const DATE_STAMP = /^(19|20)\d{6}$/;

 

 
const KEEP_SUFFIXES = ['flash', 'mini', 'max', 'turbo', 'lite', 'pro', 'a', 'k', 'm'];

 
const MODEL_ALIASES = {
  'deepseek-flash': 'deepseek-v4-1-flash',
  'deepseek-v4-flash': 'deepseek-v4-1-flash',
  'deepseek-v4-flash-vision-exp': 'deepseek-v4-1-flash',
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  k3: 'kimi-k3',
  'k3-256k': 'kimi-k3',
  'kimi-for-coding-highspeed': 'kimi-k2-7',
  'kimi-for-coding': 'kimi-k2-8-preview',
  
  
  
  
  
  
  'kimi-k3-1': 'kimi-k3',
};

 
const MODEL_ALIASES_BY_PROVIDER = {
  
  'wbhub-cn': { 'deepseek-v4-1-flash': 'deepseek-v4-1-flash-1017' },
  'wbhub-intl': { 'deepseek-v4-1-flash': 'deepseek-v4-1-flash-1017' },
  
  'deepseek-official': {
    'deepseek-flash': 'deepseek-v4-1-flash-1017',
    'deepseek-v4-flash': 'deepseek-v4-1-flash-1017',
    'deepseek-v4-flash-vision-exp': 'deepseek-v4-1-flash-1017',
    'deepseek-v4-1-flash': 'deepseek-v4-1-flash-1017',
  },
  'deepseek-account': {
    'deepseek-flash': 'deepseek-v4-1-flash-1017',
    'deepseek-v4-flash': 'deepseek-v4-1-flash-1017',
    'deepseek-v4-flash-vision-exp': 'deepseek-v4-1-flash-1017',
    'deepseek-v4-1-flash': 'deepseek-v4-1-flash-1017',
  },
  
  
  
  
  
  
  
  'dsh-provider-qoder': {
    qmodel_38max: 'qwen3.8-max',        
    qfmodel: 'qwen3.8-flash',          
    dfmodel: 'deepseek-v4.1-flash',    
    gfmodel: 'glm-5.3-flash',          
  },
};

 
let PROV_ALIAS_VIEW_CACHE = null;
function provAliasView() {
  if (!PROV_ALIAS_VIEW_CACHE) {
    const view = {};
    for (const provKey of Object.keys(MODEL_ALIASES_BY_PROVIDER)) {
      const table = MODEL_ALIASES_BY_PROVIDER[provKey];
      const v = {};
      for (const rawKey of Object.keys(table)) {
        const kv = String(rawKey).trim().toLowerCase().replace(/[\/:\s_]+/g, '-');
        if (Object.prototype.hasOwnProperty.call(v, kv)) continue; 
        v[kv] = table[rawKey];
      }
      view[provKey] = v;
    }
    PROV_ALIAS_VIEW_CACHE = view;
  }
  return PROV_ALIAS_VIEW_CACHE;
}

 
function dotToDash(s) {
  return String(s).replace(/(\d)\./g, '$1-');
}

 
function expandVersion(part) {
  const m = /^v(\d)(\d+)$/.exec(String(part));
  return m ? ['v' + m[1], m[2]] : null;
}

 
function displayModel(model) {
  let s = String(model == null ? '' : model).trim();
  let changed = true;
  while (changed) {
    changed = false;
    const colon = s.indexOf(':');
    if (colon > 0) {
      const head = normSegment(s.slice(0, colon));
      if (QUALIFIERS.indexOf(head) >= 0) { s = s.slice(colon + 1).trim(); changed = true; }
    }
  }
  return s;
}

 
function normSegment(s) {
  return dotToDash(String(s).toLowerCase()).replace(/[\s_/:]+/g, '-');
}

 
function normPart(token, isFinalToken) {
  const parts = String(token).split('-').filter(Boolean);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    if (isFinalToken && isLast && out.length && CHANNEL_SUFFIXES.indexOf(part) >= 0) continue; 
    const ver = expandVersion(part);
    if (ver) { out.push(ver[0], ver[1]); continue; }
    out.push(part);
  }
  return out;
}

 
function normModel(model, opts) {
  const allowNoise = !opts || opts.channelNoise !== false;
  let s = String(model == null ? '' : model).trim();
  if (!s) return '';
  s = s.replace(PAREN_TAIL, ' ');
  
  let guard = 0;
  for (;;) {
    const colon = s.indexOf(':');
    if (colon <= 0) break;
    const head = normSegment(s.slice(0, colon));
    if (QUALIFIERS.indexOf(head) < 0) break;
    s = s.slice(colon + 1).trim();
    if (++guard > 8) break;
  }
  
  const raw = [];
  const sepAfter = [];
  let cur = '';
  let sep = ' ';
  for (const ch of s) {
    if (ch === '/' || ch === ':' || /\s/.test(ch) || ch === '_') {
      if (cur) { raw.push(cur); sepAfter.push(ch); }
      cur = '';
      sep = ch;
      continue;
    }
    cur += ch;
  }
  if (cur) { raw.push(cur); sepAfter.push(sep); }
  const tokens = raw.map((t) => normSegment(t));
  
  for (let g = 0; g < 4 && tokens.length; g++) {
    let pre = null;
    for (const w of CHANNEL_PREFIX_HYPHEN) if (tokens[0].startsWith(w + '-')) { pre = w + '-'; break; }
    if (!pre) break;
    tokens[0] = tokens[0].slice(pre.length);
  }
  const all = [];
  for (let i = 0; i < tokens.length; i++) {
    const isPathSep = sepAfter[i] === '/' || sepAfter[i] === ':';
    if (i === 0 && isPathSep
      && (VENDOR_PREFIXES.indexOf(tokens[0]) >= 0 || CHANNEL_PREFIX_HYPHEN.indexOf(tokens[0]) >= 0)) continue; 
    
    if (allowNoise && all.length === 0 && i + 1 < tokens.length
      && (CHANNEL_NOISE.indexOf(tokens[i]) >= 0 || QUALIFIERS.indexOf(tokens[i]) >= 0)) continue;
    for (const p of normPart(tokens[i], i === tokens.length - 1)) all.push(p);
  }
  
  const kept = all.filter((p) => VARIANT_SUFFIXES.indexOf(p) < 0 && !DATE_STAMP.test(p));
  const joined = (kept.length ? kept : all).join('-');
  
  
  
  
  
  
  
  
  const prov = opts && opts.provider != null ? String(opts.provider) : '';
  const byProv = prov && Object.prototype.hasOwnProperty.call(MODEL_ALIASES_BY_PROVIDER, prov)
    ? MODEL_ALIASES_BY_PROVIDER[prov] : null;
  
  
  
  
  
  if (byProv) {
    const provView = provAliasView()[prov];
    if (provView && Object.prototype.hasOwnProperty.call(provView, joined)) {
      return normModel(provView[joined]);
    }
  }
  return Object.prototype.hasOwnProperty.call(MODEL_ALIASES, joined)
    ? MODEL_ALIASES[joined]
    : joined;
}

 
const CHANNEL_LABELS = {
  'wbhub-cn': 'WB Hub CN',
  'wbhub-intl': 'WB Hub Intl',
  'workbuddy2api|cn': 'WB CN',
  'workbuddy2api|global': 'WB Global',
  'commandcode': 'Command Code',
  'kimi-coding': 'Kimi Coding',
  'xiaomi-token-plan-cn': 'Xiaomi Token Plan CN',
  longcat: 'LongCat',
  'minimax-cn': 'MiniMax CN',
  'minimax-code': 'MiniMax Code',
  'minimax-code-2': 'MiniMax Code 2',
  antigravity: 'Antigravity',
  grok: 'Grok',
  'zcode-glm': 'ZCode GLM',
  
  
  'dsh-provider-qoder': 'Qoder',
};

 
function channelQualifier(model) {
  const s = String(model == null ? '' : model).trim();
  const colon = s.indexOf(':');
  if (colon <= 0) return '';
  const head = normSegment(s.slice(0, colon));
  return QUALIFIERS.indexOf(head) >= 0 ? head : '';
}

function channelLabel(provider, model, opts) {
  const name = opts && typeof opts.name === 'string' ? opts.name.trim() : '';
  if (name) {
    const tokens = name.split(/\s+/).filter(Boolean);
    for (let take = tokens.length - 1; take >= 1; take--) {
      if (normModel(tokens.slice(take).join(' '), { channelNoise: false }) === normModel(model)) {
        const prefix = tokens.slice(0, take).join(' ').replace(/\s*[(（][^)）]*[)）]\s*$/, '').trim();
        if (prefix) return prefix;
      }
    }
  }
  const q = channelQualifier(model);
  const table = CHANNEL_LABELS;
  if (q && typeof table[provider + '|' + q] === 'string') return table[provider + '|' + q];
  if (typeof table[provider] === 'string') return table[provider];
  return String(provider == null ? '' : provider).toUpperCase();
}

 
function genericCard(provider, model) {
  const p = provider == null ? '' : String(provider);
  const m = model == null ? '' : String(model);
  return {
    provider: p,
    model: m,
    no: '—',
    ctx: '—',
    efforts: [],
    def: null,
    quota: { unknown: true },
    generic: true,
    base: { 智力: null, 编码: null, 速度: null, 稳定: null, 性价比: null, 上下文: null },
    persona: {
      name: displayModel(m) || p || '未命名通道',
      latin: p,
      title: '通用卡（未收录机型）',
      summon: '这张卡还没被收录，先按通用形态给你顶上——分数与额度都还没上榜。',
      skills: [],
    },
    c: genericColor(p),
    
    
    
    
    scoreSource: null,
  };
}

 
const DATA_COLORS = [
  ['#4f7f8c', '#2f4f57'],
  ['#5d7a9c', '#35475c'],
];

 
const DATA_CARD_TITLE = '数据卡（公开分数自动生成）';

 
function dataCard(provider, model, data) {
  const p = provider == null ? '' : String(provider);
  const m = model == null ? '' : String(model);
  const d = data || {};
  const src = d.src || {};
  const base = {};
  const baseSrc = {};
  const unranked = [];
  for (const k of KEYS) {
    const s = src[k];
    const v = d.base ? d.base[k] : null;
    if (s && Number.isFinite(Number(v))) {
      base[k] = Number(v);
      baseSrc[k] = `${s.benchmark} = ${v}（${s.source_type === 'third-party' ? '第三方评测' : '厂商自报'}，origin ${s.origin || '未标注'}）`;
    } else {
      base[k] = null;
      unranked.push(k);
    }
  }
  return {
    provider: p,
    model: m,
    no: '—',
    ctx: '—',
    efforts: [],
    def: null,
    quota: { unknown: true },
    generic: false,
    dataCard: true,
    base,
    baseSrc,
    unranked,
    persona: {
      name: displayModel(m) || p || '未命名通道',
      latin: p,
      title: DATA_CARD_TITLE,
      summon: '公开分数自动生成：只写有来源的成绩。',
      skills: [],
    },
    benchMeta: {
      model: d.model || m,
      generated_at: d.generated_at || null,
    },
    c: DATA_COLORS[hashName(normModel(m) || m) % DATA_COLORS.length],
  };
}

 
function applyProviderVariant(card, provider, model, table, norm) {
  if (!card || !table || provider == null) return null;
  const prov = String(provider);
  if (!Object.prototype.hasOwnProperty.call(MODEL_ALIASES_BY_PROVIDER, prov)) return null;
  const variant = normModel(model, { provider: prov });
  if (!variant || variant === norm) return null;
  if (!Object.prototype.hasOwnProperty.call(table, variant)) return null;
  const d = table[variant];
  if (!d) return null;
  const base = {};
  const baseSrc = Object.assign({}, card.baseSrc || {});
  const overridden = [];
  for (const k of KEYS) {
    const s = d.src ? d.src[k] : null;
    const v = d.base ? d.base[k] : null;
    if (s && Number.isFinite(Number(v))) {
      base[k] = Number(v);
      baseSrc[k] = `${s.benchmark} = ${v}（${s.source_type === 'third-party' ? '第三方评测' : '厂商自报'}，origin ${s.origin || '未标注'}；checkpoint ${d.model || variant}）`;
      overridden.push(k);
    } else {
      base[k] = card.base && card.base[k] != null ? card.base[k] : null;
    }
  }
  const out = Object.assign({}, card);
  out.base = base;
  out.baseSrc = baseSrc;
  out.variantOf = { no: card.no, model: card.model || null, base: Object.assign({}, card.base || {}) };
  out.benchVariant = { model: d.model || variant, generated_at: d.generated_at || null, overridden };
  return out;
}

 
 

 
const PERSONA_FACE_KEYS = ['persona', 'no', 'c'];

 
function personaFaceKeysIn(entry) {
  if (!entry || typeof entry !== 'object') return [];
  return PERSONA_FACE_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(entry, k));
}

 
function exactCardFor(cards, provider, model) {
  const norm = normModel(model);
  if (!norm || provider == null) return null;
  const prov = String(provider);
  const list = Array.isArray(cards) ? cards : [];
  const hits = list.filter((c) => c && c.no !== '—' && c.family !== true
    && normModel(c.model) === norm && String(c.provider) === prov);
  return hits.length === 1 ? hits[0] : null;
}

 
function normCardFor(cards, model) {
  const norm = normModel(model);
  if (!norm) return null;
  const hits = (Array.isArray(cards) ? cards : []).filter((c) => c && c.no !== '—' && c.family !== true
    && normModel(c.model) === norm);
  return hits.length === 1 ? hits[0] : null;
}

 
function variantEntryFor(cards, model) {
  const norm = normModel(model);
  if (!norm) return null;
  for (const c of (Array.isArray(cards) ? cards : [])) {
    if (!c || c.family === true || !Array.isArray(c.variants)) continue;
    const entry = c.variants.find((v) => v && normModel(v.model) === norm);
    if (entry) return { card: c, entry };
  }
  return null;
}

 
function aliasEntryFor(cards, provider, model) {
  const norm = normModel(model);
  if (!norm || provider == null) return null;
  const prov = String(provider);
  for (const c of (Array.isArray(cards) ? cards : [])) {
    if (!c || c.family === true || !Array.isArray(c.aliases)) continue;
    const entry = c.aliases.find((a) => a && String(a.provider) === prov && normModel(a.model) === norm);
    if (entry) return { card: c, entry };
  }
  return null;
}

 
function applyVariant(card, entry, provider, model, table) {
  const out = Object.assign({}, card);
  const m = entry && entry.model != null ? String(entry.model) : (model == null ? '' : String(model));
  out.model = m; 
  const vnorm = normModel(m);
  const d = table && vnorm && Object.prototype.hasOwnProperty.call(table, vnorm) ? table[vnorm] : null;
  const decl = entry && entry.base && typeof entry.base === 'object' ? entry.base : null;
  const declSrc = entry && entry.source && typeof entry.source === 'object' ? entry.source : null;
  const base = {};
  const baseSrc = {};
  const unranked = [];
  const overridden = [];
  for (const k of KEYS) {
    const v = decl ? decl[k] : (d && d.base ? d.base[k] : null);
    const s = declSrc ? declSrc[k] : (d && d.src ? d.src[k] : null);
    if (s && Number.isFinite(Number(v))) {
      base[k] = Number(v);
      baseSrc[k] = `${s.benchmark} = ${v}（${s.source_type === 'third-party' ? '第三方评测' : '厂商自报'}，origin ${s.origin || '未标注'}；型号 ${decl ? m : (d.model || vnorm)}）`;
      overridden.push(k);
    } else {
      base[k] = null; 
      unranked.push(k);
    }
  }
  out.base = base;
  out.baseSrc = baseSrc;
  out.unranked = unranked;
  
  
  
  
  
  out.variantOf = { no: card.no, model: card.model || null, base: null };
  out.benchVariant = {
    model: m,
    dataset: d ? (d.model || vnorm) : null,
    generated_at: d ? (d.generated_at || null) : null,
    overridden,
  };
  return out;
}

 
function applyAlias(card, entry, provider, model) {
  const out = Object.assign({}, card);
  const share = !!(entry && entry.shareScores === true);
  if (!share) {
    const base = {};
    for (const k of KEYS) base[k] = null;
    out.base = base;
    out.baseSrc = {};
    out.unranked = KEYS.slice();
  }
  out.quota = { unknown: true };
  out.aliasOf = {
    no: card.no,
    model: card.model || null,
    provider: provider == null ? null : String(provider),
    shareScores: share,
  };
  return out;
}

 
const MANUAL_SRC_PREFIX = '手填评估';

 
function scoreSourceOf(card) {
  if (!card || typeof card !== 'object') return null;
  
  if (card.family === true) return null;
  const src = card.baseSrc;
  if (!src || typeof src !== 'object') return null;
  const present = [];
  for (const k of KEYS) {
    const v = src[k];
    if (v == null || String(v).length === 0) continue;
    present.push(String(v));
  }
  
  if (present.length === 0) return null;
  
  if (present.some((v) => v.indexOf(MANUAL_SRC_PREFIX) !== 0)) return 'bench';
  
  if (present.length !== KEYS.length) return null;
  return 'manual';
}

 
function withScoreSource(card) {
  if (!card || typeof card !== 'object') return card;
  return Object.assign({}, card, { scoreSource: scoreSourceOf(card) });
}

 
function aliasMatchIdentity(list, provider, model, norm) {
  if (!norm) return norm;
  const prov = provider == null ? '' : String(provider);
  if (!Object.prototype.hasOwnProperty.call(MODEL_ALIASES_BY_PROVIDER, prov)) return norm;
  const pnorm = normModel(model, { provider: prov });
  if (!pnorm || pnorm === norm) return norm;
  for (const c of list) {
    
    
    if (c && c.family !== true && normModel(c.model) === pnorm) return pnorm;
  }
  if (rawFamilyCardFor(list, normModel(pnorm))) return pnorm; 
  return norm;
}

 
function matchCard(cards, provider, model, opts) {
  const list = Array.isArray(cards) ? cards : [];
  const norm = normModel(model); 
  
  
  const aid = aliasMatchIdentity(list, provider, model, norm);
  const table = opts && opts.dataCards;
  
  
  
  
  let fam = familyCardFor(list, aid);
  
  
  const imageFace = imageFaceCardFor(list, model);
  let out = null;
  
  
  
  
  
  
  
  
  
  {
    
    
    
    const exact = exactCardFor(list, provider, model);
    if (!out && exact) out = applyProviderVariant(exact, provider, model, table, norm) || exact;
  }
  
  if (!out) {
    const hit = variantEntryFor(list, model);
    if (hit) out = applyVariant(hit.card, hit.entry, provider, model, table);
  }
  
  
  if (!out) {
    const hit = aliasEntryFor(list, provider, model);
    if (hit) {
      out = applyProviderVariant(hit.card, provider, model, table, norm) || hit.card;
      out = applyAlias(out, hit.entry, provider, model);
    }
  }
  
  if (!out) {
    
    
    const c = normCardFor(list, aid);
    if (c) out = applyProviderVariant(c, provider, model, table, norm) || c;
  }
  
  if (!out) {
    const dnorm = norm && table ? providerDataNorm(provider, model, norm, table) : '';
    if (dnorm && Object.prototype.hasOwnProperty.call(table, dnorm)) {
      const d = table[dnorm];
      if (d) out = dataCard(provider, model, d);
    }
  }
  
  
  
  if (!fam && (!out || out.dataCard === true)) fam = patternCardFor(list, model);
  
  
  
  
  
  
  
  
  
  
  
  
  if (!out && !fam && imageFace) {
    out = applyImageFace(genericCard(provider, model), imageFace, model);
  }
  
  
  if (!out) {
    
    
    if (!fam) return genericCard(provider, model);
    return withScoreSource(applyFamily(genericCard(provider, model), fam, model, aid));
  }
  
  
  
  
  const imageFaceApplied = (!fam && out.dataCard === true && imageFace)
    ? applyImageFace(out, imageFace, model)
    : out;
  const dressed = fam ? applyFamily(out, fam, model, aid) : imageFaceApplied;
  return withScoreSource(dressed);
}

 

 
const VISUAL_FAMILY_TOKENS = {
  anthropic: { words: ['claude', 'anthropic'] },
  openai: { words: ['gpt', 'openai', 'codex'] },
  gemini: { words: ['gemini'] },
  deepseek: { words: ['deepseek'] },
  glm: { words: ['glm'] },
  qwen: { words: [], re: /^qwen\d*$/ },
};

 
function visualQualifierPhrases() {
  return QUALIFIERS
    .filter((q) => /[-._]/.test(q))
    .map((q) => q.split(/[-._]+/).filter((t) => t !== ''));
}

 
function stripVisualQualifierPhrases(tokens) {
  const phrases = visualQualifierPhrases();
  let out = tokens.slice();
  for (const phrase of phrases) {
    if (!phrase || phrase.length < 2) continue;
    for (;;) {
      let cut = -1;
      for (let i = 0; i + phrase.length <= out.length; i += 1) {
        let same = true;
        for (let j = 0; j < phrase.length; j += 1) {
          if (out[i + j] !== phrase[j]) { same = false; break; }
        }
        if (same) { cut = i; break; }
      }
      if (cut < 0) break;
      out.splice(cut, phrase.length);
    }
  }
  return out;
}

 
function visualFamilyHits(tokens) {
  const hits = [];
  for (const family of Object.keys(VISUAL_FAMILY_TOKENS)) {
    const spec = VISUAL_FAMILY_TOKENS[family];
    const matched = [];
    for (const token of tokens) {
      if (spec.words.indexOf(token) >= 0) { matched.push(token); continue; }
      if (spec.re && spec.re.test(token)) matched.push(token);
    }
    if (matched.length) hits.push({ family, matched });
  }
  return hits;
}

 
function visualFamilyCard(cards, familyId) {
  const list = Array.isArray(cards) ? cards : [];
  for (const card of list) {
    if (card && card.visualFamily === familyId) return card;
  }
  return null;
}

function visualCardNoFor(cards, familyId) {
  const card = visualFamilyCard(cards, familyId);
  if (!card || card.no === undefined || card.no === null) return null;
  return String(card.no);
}

 
function resolvePersonaForm(cards, provider, model) {
  const list = Array.isArray(cards) ? cards : [];
  const out = { cardNo: null, familyId: null, formKey: null, matchedBy: 'unmatched', confidence: 0 };

  
  
  const modelIdentity = aliasMatchIdentity(list, provider, model, normModel(model));
  const tokens = stripVisualQualifierPhrases(
    modelIdentity.split(/[-._]+/).filter((t) => t !== ''),
  );

  
  const identityHits = [];
  for (const card of list) {
    const rules = (card && Array.isArray(card.formRules)) ? card.formRules : [];
    for (const rule of rules) {
      if (!rule || rule.kind !== 'identity' || !rule.identity || !rule.form) continue;
      if (rule.identity !== modelIdentity) continue;
      if (!card.forms || !card.forms[rule.form]) continue; 
      identityHits.push({ card, form: rule.form });
    }
  }
  if (identityHits.length) {
    const forms = [];
    for (const hit of identityHits) if (forms.indexOf(hit.form) < 0) forms.push(hit.form);
    if (forms.length > 1) {
      
      out.familyId = identityHits[0].card.visualFamily || null;
      out.matchedBy = 'ambiguous';
      out.confidence = 0;
      return out;
    }
    const hit = identityHits[0];
    out.familyId = hit.card.visualFamily || null;
    out.formKey = hit.form;
    out.cardNo = visualCardNoFor(list, out.familyId);
    out.matchedBy = 'identity';
    out.confidence = 0.95;
    return out;
  }

  
  const hits = visualFamilyHits(tokens);
  if (hits.length > 1) {
    
    out.matchedBy = 'ambiguous';
    out.confidence = 0;
    return out;
  }
  if (!hits.length) {
    
    out.matchedBy = 'unmatched';
    out.confidence = 0;
    return out;
  }
  const familyId = hits[0].family;
  out.familyId = familyId;
  const famCard = visualFamilyCard(list, familyId);
  const rules = (famCard && Array.isArray(famCard.formRules)) ? famCard.formRules : [];
  const forms = (famCard && famCard.forms) ? famCard.forms : {};

  
  
  const tokenForms = [];
  for (const rule of rules) {
    if (!rule || rule.kind !== 'token' || !rule.token || !rule.form) continue;
    if (!forms[rule.form]) continue;
    if (tokens.indexOf(rule.token) < 0) continue;
    if (tokenForms.indexOf(rule.form) < 0) tokenForms.push(rule.form);
  }
  if (tokenForms.length > 1) {
    out.matchedBy = 'ambiguous';
    out.confidence = 0;
    return out;
  }
  if (tokenForms.length === 1) {
    out.formKey = tokenForms[0];
    out.cardNo = visualCardNoFor(list, familyId);
    out.matchedBy = 'token';
    out.confidence = 0.9;
    return out;
  }

  
  
  
  const rest = tokens.filter((t) => hits[0].matched.indexOf(t) < 0);
  const versionOnly = rest.length > 0
    && rest.every((t) => /^\d+$/.test(t) || /^v\d+$/.test(t));
  if (versionOnly) {
    for (const rule of rules) {
      if (!rule || rule.kind !== 'default' || !rule.form) continue;
      if (!forms[rule.form]) continue;
      out.formKey = rule.form;
      out.cardNo = visualCardNoFor(list, familyId);
      out.matchedBy = 'default';
      out.confidence = 0.8;
      return out;
    }
  }

  
  out.matchedBy = 'family-only';
  out.confidence = 0.4;
  return out;
}

 

 
const DIALOGUE_LEVELS = { FORM: 'form', FAMILY: 'family', LADDER: 'effortLine' };

 
const DIALOGUE_EFFORT_SLOTS = ['low', 'medium', 'high'];

 
function effortRank(tier) {
  const i = EFFORT_LINE_LADDER.indexOf(tier);
  return i < 0 ? -1 : i;
}

 
function dialogueTierOf(card, slot) {
  const declared = (card && Array.isArray(card.efforts)) ? card.efforts.map(String) : [];
  const names = [];
  for (const t of declared) {
    if (names.indexOf(t) < 0 && effortRank(t) >= 0) names.push(t);
  }
  if (!names.length) return slot;
  names.sort((a, b) => effortRank(a) - effortRank(b)); 
  const order = { high: 0, medium: 1, low: 2 };
  const i = order[slot];
  if (i === undefined) return slot;
  if (names.length >= 3) return names[i];
  const want = effortRank(slot);
  let best = null;
  for (const t of names) {
    const r = effortRank(t);
    const d = Math.abs(r - want);
    
    if (!best || d < best.d || (d === best.d && r < best.r)) best = { t: t, d: d, r: r };
  }
  return best ? best.t : slot;
}

 
function formDialogueLine(entry, formDialogue, personaCard) {
  if (!entry || typeof entry !== 'object') return '';
  const level = entry.level;
  if (level === DIALOGUE_LEVELS.FORM) {
    const lines = Array.isArray(entry.lines) ? entry.lines : [];
    return lines.length ? String(lines[0]) : '';
  }
  if (level === DIALOGUE_LEVELS.FAMILY) {
    const key = String(entry.from || '').replace(/^persona\.effort\./, '');
    const map = (personaCard && personaCard.persona && personaCard.persona.effort) || {};
    return map[key] ? String(map[key]) : '';
  }
  if (level === DIALOGUE_LEVELS.LADDER) {
    const from = String(entry.from || '');
    const sub = (formDialogue && formDialogue.effort) ? formDialogue.effort[from] : null;
    return sub ? formDialogueLine(sub, formDialogue, personaCard) : '';
  }
  return '';
}

 
function resolveEffortDialogue(formDialogue, personaCard, tier) {
  const entry = (formDialogue && formDialogue.effort) ? formDialogue.effort[tier] : null;
  if (entry) {
    const line = formDialogueLine(entry, formDialogue, personaCard);
    if (line) return line;
  }
  const map = (personaCard && personaCard.persona && personaCard.persona.effort) || {};
  if (map[tier]) return String(map[tier]);
  const idx = effortRank(tier);
  if (idx >= 0) {
    for (let i = idx + 1; i < EFFORT_LINE_LADDER.length; i += 1) {
      const key = EFFORT_LINE_LADDER[i];
      if (map[key]) return String(map[key]);
    }
  }
  return '';
}

 

 
function personaFieldWritten(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

 
function mergeFormPersona(basePersona, formPersona) {
  const base = (basePersona && typeof basePersona === 'object') ? basePersona : {};
  const out = Object.assign({}, base);
  if (!formPersona || typeof formPersona !== 'object') return out;
  for (const key of Object.keys(formPersona)) {
    const value = formPersona[key];
    if (!personaFieldWritten(value)) continue;
    const current = out[key];
    const isPlain = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
    if (isPlain(current) && isPlain(value)) out[key] = Object.assign({}, current, value);
    else out[key] = Array.isArray(value) ? value.slice() : value;
  }
  return out;
}

 
function visualFormContext(card, cards, provider, model) {
  const list = Array.isArray(cards) ? cards : [];
  const vis = resolvePersonaForm(list, provider, model);
  const familyCard = vis.familyId ? visualFamilyCard(list, vis.familyId) : null;
  const personaCard = familyCard || card || null;
  const forms = (familyCard && familyCard.forms) || null;
  const formEntry = (forms && vis.formKey) ? forms[vis.formKey] : null;
  return { list: list, vis: vis, familyCard: familyCard, personaCard: personaCard, formEntry: formEntry };
}

 
function visualPersonaOf(card, cards, provider, model) {
  if (!card) return card;
  const ctx = visualFormContext(card, cards, provider, model);
  const formPersona = ctx.formEntry ? ctx.formEntry.persona : null;
  if (!formPersona || typeof formPersona !== 'object') return card;
  const basePersona = ctx.personaCard ? ctx.personaCard.persona : card.persona;
  const merged = mergeFormPersona(basePersona, formPersona);
  const target = ctx.personaCard || card;
  if (target === card) return Object.assign({}, card, { persona: merged });
  
  
  return Object.assign({}, card, { persona: merged });
}

 
function resolveVisualPayload(card, cards, provider, model) {
  
  const ctx = visualFormContext(card, cards, provider, model);
  const vis = ctx.vis;
  const personaCard = ctx.personaCard;
  const formEntry = ctx.formEntry;
  const formDialogue = (formEntry && formEntry.dialogue) || null;
  
  
  
  
  const form = formEntry
    ? {
      key: String(vis.formKey),
      alias: String(formEntry.alias || ''),
      availability: formEntry.availability ? String(formEntry.availability) : 'available',
    }
    : null;
  if (!personaCard) return Object.assign({}, vis, { form: form, dialogue: null });

  
  
  const formPersona = formEntry ? formEntry.persona : null;
  const faceCard = (formPersona && typeof formPersona === 'object')
    ? Object.assign({}, personaCard, { persona: mergeFormPersona(personaCard.persona, formPersona) })
    : personaCard;

  const P = faceCard.persona || {};
  
  const summon = (formDialogue && formDialogue.summon)
    ? String(formDialogue.summon)
    : (P.summon ? String(P.summon) : '');
  const effort = {};
  for (const slot of DIALOGUE_EFFORT_SLOTS) {
    effort[slot] = resolveEffortDialogue(formDialogue, faceCard, dialogueTierOf(faceCard, slot));
  }
  
  const unknown = (formDialogue && formDialogue.unknown)
    ? String(formDialogue.unknown)
    : (P.unknown ? String(P.unknown) : DEFAULT_LINES.unknown);
  return Object.assign({}, vis, {
    form: form,
    dialogue: { summon: summon, effort: effort, unknown: unknown },
  });
}

 
function resolveFormDialogue(card, cards, provider, model) {
  const payload = resolveVisualPayload(card, cards, provider, model);
  return { form: payload.form, dialogue: payload.dialogue };
}

 
function withVisual(card, cards, provider, model) {
  if (!card) return card;
  return Object.assign({}, card, { visual: resolveVisualPayload(card, cards, provider, model) });
}

 
const IMAGE_IDENTITY = {
  
  'deepseek-v4-pro': 'deepseek-v4-1-flash',
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  'glm-5-2': 'glm-5-3-flash',
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  'gemini-4-argon': 'gemini-3-8-flash',
  'gemini-4-argon-batch': 'gemini-3-8-flash',
  'gemini-4-argon-contributor': 'gemini-3-8-flash',
};

 
function imageFaceCardFor(cards, model) {
  const norm = normModel(model);
  if (!norm) return null;
  if (!Object.prototype.hasOwnProperty.call(IMAGE_IDENTITY, norm)) return null;
  const face = IMAGE_IDENTITY[norm];
  const hits = (Array.isArray(cards) ? cards : []).filter((c) => c
    && c.no !== '—' && c.family !== true && normModel(c.model) === face);
  return hits.length === 1 ? hits[0] : null;
}

 
 
function rawFamilyCardFor(list, norm) {
  if (!norm) return null;
  for (const c of (Array.isArray(list) ? list : [])) {
    if (!c) continue;
    if (c.family === true && Array.isArray(c.members) && c.members.some((m) => normModel(m) === norm)) return c;
    
    if (Array.isArray(c.alsoCovers) && c.alsoCovers.some((m) => normModel(m) === norm)) return c;
  }
  return null;
}

 
function familyCardFor(cards, model, provider) {
  const list = Array.isArray(cards) ? cards : [];
  const norm = normModel(model);
  if (!norm) return null;
  if (provider != null && String(provider) !== '') {
    const pnorm = normModel(model, { provider: String(provider) });
    if (pnorm && pnorm !== norm) {
      const hit = rawFamilyCardFor(list, pnorm);
      if (hit) return hit;
    }
  }
  return rawFamilyCardFor(list, norm);
}

 
function patternCardFor(cards, model) {
  const norm = normModel(model);
  if (!norm) return null;
  for (const c of (Array.isArray(cards) ? cards : [])) {
    if (!c || typeof c.modelPattern !== 'string' || !c.modelPattern) continue;
    let re = null;
    try {
      re = new RegExp(c.modelPattern, 'i');
    } catch (err) {
      continue; 
    }
    if (re.test(norm)) return c;
  }
  return null;
}

 
function applyFamily(card, fam, model, tierModel) {
  if (!card || !fam) return card;
  const p = fam.persona || {};
  const out = Object.assign({}, card);
  out.no = fam.no;
  out.persona = p;
  if (Array.isArray(fam.c)) out.c = fam.c;
  if (fam.ctx) out.ctx = fam.ctx;
  out.efforts = Array.isArray(fam.efforts) ? fam.efforts.slice() : [];
  out.def = fam.def == null ? null : fam.def;
  if (fam.quota) out.quota = fam.quota;
  
  
  
  delete out.generic;
  delete out.dataCard;
  out.family = {
    no: fam.no,
    name: p.name || '',
    latin: p.latin || '',
    model: card.model || (model == null ? '' : String(model)),
  };
  
  
  
  
  
  
  const tier = tierDescriptor(fam, tierModel != null ? tierModel : model);
  if (tier) out.tier = tier;
  return out;
}

 
function applyImageFace(card, face, model) {
  if (!card || !face) return card;
  const out = applyFamily(card, face, model);
  if (!out || out === card) return out;
  delete out.family;
  const p = face.persona || {};
  out.imageFace = {
    no: face.no,
    name: p.name || '',
    latin: p.latin || '',
  };
  
  if (card.ctx != null) out.ctx = card.ctx;
  out.efforts = Array.isArray(card.efforts) ? card.efforts.slice() : [];
  out.def = card.def == null ? null : card.def;
  if (card.quota) out.quota = card.quota;
  return out;
}

 
const TIER_DECOR_CLASSES = ['emblem', 'glow', 'border', 'pattern'];
const TIER_ATTR = 'data-dpc-tier';

 
function tierTokens(model) {
  return String(model == null ? '' : model)
    .toLowerCase()
    .split(/[-._]+/)
    .filter((t) => t !== '');
}

 
function tierKeyHits(key, tokens) {
  const kt = tierTokens(key);
  if (!kt.length) return false;
  for (let i = 0; i + kt.length <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < kt.length; j++) {
      if (tokens[i + j] !== kt[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

 
function tierDescriptor(card, model, provider) {
  if (!card || typeof card !== 'object') return null;
  const tiers = card.tiers;
  if (!tiers || typeof tiers !== 'object' || Array.isArray(tiers)) return null;
  
  const members = Array.isArray(card.members) ? card.members : null;
  
  
  
  
  let ident = model;
  let identNorm = normModel(model);
  if (provider != null && String(provider) !== '') {
    const pnorm = normModel(model, { provider: String(provider) });
    if (pnorm && pnorm !== identNorm && (!members || members.some((m) => normModel(m) === pnorm))) {
      ident = pnorm;
      identNorm = pnorm;
    }
  }
  if (members) {
    if (!identNorm) return null;
    if (!members.some((m) => normModel(m) === identNorm)) return null;
  }
  const tokens = tierTokens(ident);
  let best = null;
  for (const key of Object.keys(tiers)) {
    const level = tiers[key];
    if (!Number.isInteger(level) || level < 0) continue;
    if (!tierKeyHits(key, tokens)) continue;
    if (best === null || level < best.level) best = { key: key, level: level };
  }
  if (!best) return null;
  return {
    attr: TIER_ATTR,
    value: String(best.level),
    level: best.level,
    key: best.key,
    hides: TIER_DECOR_CLASSES.slice(0, best.level),
  };
}

 
function providerDataNorm(provider, model, norm, table) {
  if (provider == null || !table) return norm;
  const prov = String(provider);
  if (!Object.prototype.hasOwnProperty.call(MODEL_ALIASES_BY_PROVIDER, prov)) return norm;
  const variant = normModel(model, { provider: prov });
  if (variant && variant !== norm && Object.prototype.hasOwnProperty.call(table, variant)) return variant;
  return norm;
}

 
function clamp(v) {
  return Math.max(1, Math.min(100, Math.round(v)));
}

 
function statsOf(card, effort, date, provider) {
  const m = EFFORT_MODS[effort] || {};
  const adj = mulAdjust(timeState(card, date, provider).mul);
  const out = {};
  for (const k of KEYS) {
    const de = m[k] || 0;
    const dt = k === '性价比' ? adj : 0;
    const b = card && card.base ? card.base[k] : null;
    
    
    
    if (b == null || !Number.isFinite(Number(b))) { out[k] = { v: null, d: 0, de: 0, dt: 0, b: null }; continue; }
    out[k] = { v: clamp(Number(b) + de + dt), d: de + dt, de, dt, b };
  }
  return out;
}

 
const RESET_UNKNOWN_TEXT = '重置时间未知';

 
function fmtReset(min) {
  if (min === null || min === undefined || min === '') return '';
  const n = Number(min);
  if (!Number.isFinite(n)) return '';
  const m = Math.max(0, Math.floor(n));
  if (m >= 1440) return Math.floor(m / 1440) + 'd' + Math.floor((m % 1440) / 60) + 'h';
  if (m >= 60) return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0') + 'm';
  return m + 'm';
}

 
function quotaRows(card, live) {
  const q = live || (card && card.quota) || {};
  if (q.unknown) return [];
  if (Array.isArray(q.windows)) {
    
    
    
    const seen = new Set();
    const out = [];
    for (const w of q.windows) {
      if (!w) continue;
      const k = String(w.k === null || w.k === undefined ? '' : w.k);
      if (seen.has(k)) continue;
      seen.add(k);
      const known = w.reset !== null && w.reset !== undefined && w.reset !== '' && Number.isFinite(Number(w.reset));
      const rst = known ? fmtReset(w.reset) + ' 重置' : RESET_UNKNOWN_TEXT;
      out.push({
        lbl: k,
        left: clamp2pct(100 - Number(w.used)),
        rst,
        reset: known ? Number(w.reset) : null,
      });
    }
    return out;
  }
  if (q.pack && Number.isFinite(q.pack.total) && q.pack.total > 0) {
    const p = clamp2pct(Math.round((q.pack.left / q.pack.total) * 100));
    return [{ lbl: '包', left: p, rst: (Number(q.pack.left) || 0).toLocaleString() + ' ' + (q.pack.unit || ''), reset: null }];
  }
  return [];
}

function clamp2pct(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

 
function lowRow(card, live) {
  return quotaRows(card, live).find((r) => r.left < 20) || null;
}

 
function fmtLine(s, v) {
  return String(s).replace(/\{(lbl|left|reset)\}/g, (_, k) => (v[k] == null ? '' : String(v[k])));
}

 
function pickLine(card, reason, effort, date, live, preferTime, provider) {
  const P = card.persona || {};
  const low = lowRow(card, live);
  if (low) {
    return fmtLine(P.lowQuota || DEFAULT_LINES.lowQuota, {
      lbl: low.lbl, left: low.left, reset: low.reset != null ? fmtReset(low.reset) : '一会儿',
    });
  }
  const q = (live || card.quota || {});
  if (q.unknown && reason === 'summon' && !preferTime) return P.summon;
  if (reason === 'effort') {
    
    
    
    return effortLine(card, effort);
  }
  const ts = timeState(card, date, provider);
  if ((reason === 'time' || preferTime) && (ts.tone === 'peak' || ts.tone === 'off')) {
    return P[ts.tone] || DEFAULT_LINES[ts.tone];
  }
  if (reason === 'time' && q.unknown) return P.unknown || DEFAULT_LINES.unknown;
  return P.summon;
}

 
function quotaLevel(card, live) {
  const rows = quotaRows(card, live);
  if ((live || (card && card.quota) || {}).unknown || rows.length === 0) return 'na';
  const min = Math.min(...rows.map((r) => r.left));
  if (min < 20) return 'red';
  if (min < 40) return 'warn';
  return 'ok';
}

 
function effortText(card, effort, chips) {
  if (!card && !Array.isArray(chips)) return '';
  
  
  const list = Array.isArray(chips) ? chips : effortChips(card);
  if (list.length === 0) return '';
  return '思考档';
}

 
var BENCH_NOT_RANKED = null;

 
function missingMark() {
  if (typeof NOT_RANKED === 'string') return NOT_RANKED;
  if (typeof BENCH_NOT_RANKED === 'string') return BENCH_NOT_RANKED;
  throw new Error('missingMark: 缺项状态词出口未就绪（正本 lib/benchmarks.cjs 与镜像 lib/measured.cjs 都不可达）');
}

 
function statText(value) {
  if (value == null) return missingMark();
  if (!Number.isFinite(Number(value))) return missingMark();
  return String(value);
}

 
function hostEffortsOf(groups, provider, model) {
  if (!Array.isArray(groups) || groups.length === 0) return [];
  if (!provider || !model) return [];
  const pRaw = String(provider);
  const mRaw = String(model);
  let group = groups.find((g) => g && g.id != null && String(g.id) === pRaw);
  if (!group) {
    group = groups.find((g) => g && g.id != null && normModel(String(g.id)) === normModel(pRaw));
  }
  if (!group || !Array.isArray(group.models)) return [];
  let hit = group.models.find((m) => m && m.id != null && String(m.id) === mRaw);
  if (!hit) {
    const key = normModel(mRaw);
    hit = group.models.find((m) => m && m.id != null && normModel(String(m.id)) === key);
  }
  if (!hit || !hit.reasoning || !Array.isArray(hit.reasoning.efforts)) return [];
  const out = [];
  for (const e of hit.reasoning.efforts) {
    const id = typeof e === 'string' ? e : (e && e.id);
    if (id == null) continue;
    const s = String(id);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

 
function effortChips(card, host) {
  const declared = hostEffortsOf(host && host.groups, host && host.provider, host && host.model);
  if (declared.length > 0) return declared;
  const fallback = card && Array.isArray(card.efforts) ? card.efforts : [];
  return fallback.slice();
}

 
const EFFORT_LINE_LADDER = ['max', 'xhigh', 'high', 'medium', 'low'];
function effortLine(card, effort) {
  const P = (card && card.persona) || {};
  const map = P.effort || {};
  const want = effort == null ? '' : String(effort);
  if (map[want]) return map[want];
  const idx = EFFORT_LINE_LADDER.indexOf(want);
  if (idx >= 0) {
    for (let i = idx + 1; i < EFFORT_LINE_LADDER.length; i += 1) {
      const key = EFFORT_LINE_LADDER[i];
      if (map[key]) return map[key];
    }
  }
  return null;
}

 

 
const PERSONA_TEXT_FIELDS = ['name', 'latin', 'title', 'summon', 'lowQuota'];
 
const PERSONA_SHORT_FIELDS = ['name', 'latin', 'title'];
const PERSONA_SHORT_MAX = 24;
const PERSONA_LONG_MAX = 200;
 
const LOW_QUOTA_PLACEHOLDERS = ['{lbl}', '{left}', '{reset}'];
 
const PERSONA_OVERRIDE_KEYS = ['persona', 'forms'];
 
const PERSONA_SKILL_EDITABLE_COLUMNS = [0, 1];

function personaTextTooLong(key, value) {
  const max = PERSONA_SHORT_FIELDS.indexOf(key) !== -1 ? PERSONA_SHORT_MAX : PERSONA_LONG_MAX;
  return typeof value === 'string' && value.length > max;
}

 
function validatePersonaOverride(card, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, reason: 'bad-shape' };
  }
  const out = {};
  for (const key of Object.keys(patch)) {
    if (PERSONA_OVERRIDE_KEYS.indexOf(key) === -1) return { ok: false, reason: 'not-allowed:' + key };
  }
  const base = (card && card.persona && typeof card.persona === 'object') ? card.persona : {};

  
  if (patch.persona !== undefined) {
    const p = patch.persona;
    if (p === null || typeof p !== 'object' || Array.isArray(p)) return { ok: false, reason: 'bad-shape:persona' };
    const outP = {};
    for (const key of Object.keys(p)) {
      if (key === 'effort' || key === 'skills') continue;
      if (PERSONA_TEXT_FIELDS.indexOf(key) === -1) return { ok: false, reason: 'not-allowed:' + key };
      const v = p[key];
      if (typeof v !== 'string') return { ok: false, reason: 'bad-type:' + key };
      if (personaTextTooLong(key, v)) return { ok: false, reason: 'too-long:' + key };
      if (key === 'lowQuota') {
        for (const ph of LOW_QUOTA_PLACEHOLDERS) {
          if (v.indexOf(ph) === -1) return { ok: false, reason: 'missing-placeholder:' + ph };
        }
      }
      outP[key] = v;
    }
    if (p.effort !== undefined) {
      const e = p.effort;
      if (e === null || typeof e !== 'object' || Array.isArray(e)) return { ok: false, reason: 'bad-shape:effort' };
      const tiers = (base.effort && typeof base.effort === 'object') ? base.effort : {};
      const outE = {};
      for (const k of Object.keys(e)) {
        if (!Object.prototype.hasOwnProperty.call(tiers, k)) return { ok: false, reason: 'unknown-effort:' + k };
        const v = e[k];
        if (typeof v !== 'string') return { ok: false, reason: 'bad-type:effort.' + k };
        if (v.length > PERSONA_LONG_MAX) return { ok: false, reason: 'too-long:effort.' + k };
        outE[k] = v;
      }
      if (Object.keys(outE).length) outP.effort = outE;
    }
    if (p.skills !== undefined) {
      const s = p.skills;
      if (!Array.isArray(s)) return { ok: false, reason: 'bad-shape:skills' };
      const baseSkills = Array.isArray(base.skills) ? base.skills : [];
      if (s.length > baseSkills.length) return { ok: false, reason: 'skills-extra-row' };
      const outS = [];
      for (let i = 0; i < s.length; i += 1) {
        const row = s[i];
        if (!Array.isArray(row)) return { ok: false, reason: 'bad-shape:skills[' + i + ']' };
        
        if (row.length > PERSONA_SKILL_EDITABLE_COLUMNS.length) return { ok: false, reason: 'skills-third-column' };
        const baseRow = Array.isArray(baseSkills[i]) ? baseSkills[i] : [];
        const outRow = [];
        for (let c = 0; c < row.length; c += 1) {
          const v = row[c];
          if (typeof v !== 'string') return { ok: false, reason: 'bad-type:skills[' + i + '][' + c + ']' };
          if (v.length > PERSONA_LONG_MAX) return { ok: false, reason: 'too-long:skills[' + i + '][' + c + ']' };
          outRow[c] = v;
        }
        
        for (let c = outRow.length; c < PERSONA_SKILL_EDITABLE_COLUMNS.length; c += 1) {
          if (typeof baseRow[c] === 'string') outRow[c] = baseRow[c];
        }
        outS.push(outRow);
      }
      if (outS.length) outP.skills = outS;
    }
    if (Object.keys(outP).length) out.persona = outP;
  }

  
  if (patch.forms !== undefined) {
    const f = patch.forms;
    if (f === null || typeof f !== 'object' || Array.isArray(f)) return { ok: false, reason: 'bad-shape:forms' };
    const baseForms = (card && card.forms && typeof card.forms === 'object') ? card.forms : {};
    const outF = {};
    for (const formKey of Object.keys(f)) {
      if (!Object.prototype.hasOwnProperty.call(baseForms, formKey)) {
        return { ok: false, reason: 'unknown-form:' + formKey };
      }
      const fp = f[formKey];
      if (fp === null || typeof fp !== 'object' || Array.isArray(fp)) {
        return { ok: false, reason: 'bad-shape:forms.' + formKey };
      }
      const outFp = {};
      for (const k of Object.keys(fp)) {
        if (k !== 'alias' && k !== 'dialogue') return { ok: false, reason: 'not-allowed:forms.' + formKey + '.' + k };
      }
      if (fp.alias !== undefined) {
        if (typeof fp.alias !== 'string') return { ok: false, reason: 'bad-type:forms.' + formKey + '.alias' };
        if (fp.alias.length > PERSONA_SHORT_MAX) return { ok: false, reason: 'too-long:forms.' + formKey + '.alias' };
        outFp.alias = fp.alias;
      }
      if (fp.dialogue !== undefined) {
        const d = fp.dialogue;
        if (d === null || typeof d !== 'object' || Array.isArray(d)) {
          return { ok: false, reason: 'bad-shape:forms.' + formKey + '.dialogue' };
        }
        for (const k of Object.keys(d)) {
          if (k !== 'effort') return { ok: false, reason: 'not-allowed:forms.' + formKey + '.dialogue.' + k };
        }
        const baseD = (baseForms[formKey] && baseForms[formKey].dialogue && typeof baseForms[formKey].dialogue === 'object')
          ? baseForms[formKey].dialogue : {};
        const baseEfforts = (baseD.effort && typeof baseD.effort === 'object') ? baseD.effort : {};
        const outD = {};
        if (d.effort !== undefined) {
          const e = d.effort;
          if (e === null || typeof e !== 'object' || Array.isArray(e)) {
            return { ok: false, reason: 'bad-shape:forms.' + formKey + '.dialogue.effort' };
          }
          const outE = {};
          for (const lvl of Object.keys(e)) {
            if (!Object.prototype.hasOwnProperty.call(baseEfforts, lvl)) {
              return { ok: false, reason: 'unknown-effort:' + lvl };
            }
            const lv = e[lvl];
            if (lv === null || typeof lv !== 'object' || Array.isArray(lv)) {
              return { ok: false, reason: 'bad-shape:forms.' + formKey + '.dialogue.effort.' + lvl };
            }
            for (const k of Object.keys(lv)) {
              if (k !== 'lines') return { ok: false, reason: 'not-allowed:forms.' + formKey + '.dialogue.' + lvl + '.' + k };
            }
            if (lv.lines === undefined) continue;
            if (!Array.isArray(lv.lines)) return { ok: false, reason: 'bad-type:forms.' + formKey + '.dialogue.' + lvl + '.lines' };
            const baseLines = Array.isArray((baseEfforts[lvl] || {}).lines) ? baseEfforts[lvl].lines : [];
            if (lv.lines.length > baseLines.length) return { ok: false, reason: 'lines-extra' };
            for (const ln of lv.lines) {
              if (typeof ln !== 'string') return { ok: false, reason: 'bad-type:forms.' + formKey + '.dialogue.' + lvl + '.lines' };
              if (ln.length > PERSONA_LONG_MAX) return { ok: false, reason: 'too-long:forms.' + formKey + '.dialogue.' + lvl + '.lines' };
            }
            outE[lvl] = { lines: lv.lines.slice() };
          }
          if (Object.keys(outE).length) outD.effort = outE;
        }
        if (Object.keys(outD).length) outFp.dialogue = outD;
      }
      if (Object.keys(outFp).length) outF[formKey] = outFp;
    }
    if (Object.keys(outF).length) out.forms = outF;
  }

  if (Object.keys(out).length === 0) return { ok: false, reason: 'empty-patch' };
  return { ok: true, normalized: out };
}

 
function validatePersonaOverrides(cards, body) {
  let incoming = body;
  if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)
    && Object.keys(incoming).length === 1 && incoming.overrides && typeof incoming.overrides === 'object') {
    incoming = incoming.overrides;
  }
  if (incoming === null || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return { ok: false, reason: 'body-not-object' };
  }
  const catalog = Array.isArray(cards) ? cards : [];
  const byNo = {};
  for (const c of catalog) {
    if (c && c.no !== undefined && c.no !== null) byNo[String(c.no)] = c;
  }
  const out = {};
  for (const no of Object.keys(incoming)) {
    if (!Object.prototype.hasOwnProperty.call(byNo, no)) {
      return { ok: false, reason: 'unknown-card:' + no };
    }
    const r = validatePersonaOverride(byNo[no], incoming[no]);
    if (!r.ok) return { ok: false, reason: r.reason, detail: { no: no } };
    out[no] = r.normalized;
  }
  return { ok: true, normalized: out };
}

 

 
function mergePersonaPatch(baseP, patchP) {
  const base = (baseP && typeof baseP === 'object' && !Array.isArray(baseP)) ? baseP : {};
  const p = (patchP && typeof patchP === 'object' && !Array.isArray(patchP)) ? patchP : {};
  const outP = Object.assign({}, base);
  for (const key of PERSONA_TEXT_FIELDS) {
    if (typeof p[key] === 'string') outP[key] = p[key];
  }
  if (p.effort && typeof p.effort === 'object') {
    const outE = Object.assign({}, (base.effort && typeof base.effort === 'object') ? base.effort : {});
    for (const k of Object.keys(p.effort)) {
      if (typeof p.effort[k] === 'string' && Object.prototype.hasOwnProperty.call(outE, k)) {
        outE[k] = p.effort[k];
      }
    }
    outP.effort = outE;
  }
  if (Array.isArray(p.skills)) {
    const baseS = Array.isArray(base.skills) ? base.skills : [];
    const outS = baseS.map((row) => (Array.isArray(row) ? row.slice() : row));
    for (let i = 0; i < p.skills.length && i < outS.length; i += 1) {
      const row = p.skills[i];
      if (!Array.isArray(row)) continue;
      for (const c of PERSONA_SKILL_EDITABLE_COLUMNS) {
        if (typeof row[c] === 'string' && Array.isArray(outS[i])) outS[i][c] = row[c];
      }
    }
    outP.skills = outS;
  }
  return outP;
}

function applyPersonaOverrides(cards, overrides) {
  const list = Array.isArray(cards) ? cards : [];
  const ov = (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) ? overrides : {};
  return list.map((card) => {
    if (!card || typeof card !== 'object') return card;
    const no = card.no === undefined || card.no === null ? '' : String(card.no);
    const patch = no && Object.prototype.hasOwnProperty.call(ov, no) ? ov[no] : null;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return Object.assign({}, card);
    const next = Object.assign({}, card);

    if (patch.persona && typeof patch.persona === 'object') {
      const p = patch.persona;
      const baseP = (card.persona && typeof card.persona === 'object') ? card.persona : {};
      
      next.persona = mergePersonaPatch(baseP, p);
    }

    if (patch.forms && typeof patch.forms === 'object') {
      const baseF = (card.forms && typeof card.forms === 'object') ? card.forms : {};
      const outF = {};
      for (const formKey of Object.keys(baseF)) outF[formKey] = baseF[formKey];
      for (const formKey of Object.keys(patch.forms)) {
        if (!Object.prototype.hasOwnProperty.call(outF, formKey)) continue;
        const fp = patch.forms[formKey];
        if (!fp || typeof fp !== 'object' || Array.isArray(fp)) continue;
        const baseFp = (outF[formKey] && typeof outF[formKey] === 'object') ? outF[formKey] : {};
        const outFp = Object.assign({}, baseFp);
        if (typeof fp.alias === 'string') outFp.alias = fp.alias;
        
        
        if (fp.persona && typeof fp.persona === 'object' && !Array.isArray(fp.persona)) {
          const baseFpP = (baseFp.persona && typeof baseFp.persona === 'object' && !Array.isArray(baseFp.persona))
            ? baseFp.persona : {};
          outFp.persona = mergePersonaPatch(baseFpP, fp.persona);
        }
        if (fp.dialogue && typeof fp.dialogue === 'object'
          && fp.dialogue.effort && typeof fp.dialogue.effort === 'object') {
          const baseD = (baseFp.dialogue && typeof baseFp.dialogue === 'object') ? baseFp.dialogue : {};
          const outD = Object.assign({}, baseD);
          const baseE = (baseD.effort && typeof baseD.effort === 'object') ? baseD.effort : {};
          const outE = {};
          for (const k of Object.keys(baseE)) outE[k] = baseE[k];
          for (const lvl of Object.keys(fp.dialogue.effort)) {
            if (!Object.prototype.hasOwnProperty.call(outE, lvl)) continue;
            const lv = fp.dialogue.effort[lvl];
            if (!lv || typeof lv !== 'object' || !Array.isArray(lv.lines)) continue;
            outE[lvl] = Object.assign({}, outE[lvl], { lines: lv.lines.slice() });
          }
          outD.effort = outE;
          outFp.dialogue = outD;
        }
        outF[formKey] = outFp;
      }
      next.forms = outF;
    }
    return next;
  });
}

 

 
function sanitizePersonaPatch(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const op = {};
  for (const key of PERSONA_TEXT_FIELDS) {
    if (typeof p[key] === 'string' && p[key]) op[key] = p[key];
  }
  if (p.effort && typeof p.effort === 'object' && !Array.isArray(p.effort)) {
    const oe = {};
    for (const k of Object.keys(p.effort)) {
      if (typeof p.effort[k] === 'string' && p.effort[k]) oe[k] = p.effort[k];
    }
    if (Object.keys(oe).length) op.effort = oe;
  }
  if (Array.isArray(p.skills)) {
    
    const os = p.skills.map((row) => {
      if (!Array.isArray(row)) return [];
      const name = row[PERSONA_SKILL_EDITABLE_COLUMNS[0]];
      const line = row[PERSONA_SKILL_EDITABLE_COLUMNS[1]];
      return (typeof name === 'string' && name && typeof line === 'string' && line) ? [name, line] : [];
    });
    if (os.length) op.skills = os;
  }
  return Object.keys(op).length ? op : null;
}

 
function sanitizeLocalePatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return null;
  const out = {};

  
  const op = sanitizePersonaPatch(patch.persona);
  if (op) out.persona = op;

  
  const f = patch.forms;
  if (f && typeof f === 'object' && !Array.isArray(f)) {
    const of = {};
    for (const formKey of Object.keys(f)) {
      const fp = f[formKey];
      if (!fp || typeof fp !== 'object' || Array.isArray(fp)) continue;
      const ofp = {};
      if (typeof fp.alias === 'string' && fp.alias) ofp.alias = fp.alias;
      
      const ofpPersona = sanitizePersonaPatch(fp.persona);
      if (ofpPersona) ofp.persona = ofpPersona;
      const d = fp.dialogue;
      if (d && typeof d === 'object' && !Array.isArray(d) && d.effort && typeof d.effort === 'object') {
        const oe = {};
        for (const lvl of Object.keys(d.effort)) {
          const lv = d.effort[lvl];
          if (!lv || typeof lv !== 'object' || !Array.isArray(lv.lines)) continue;
          const lines = lv.lines;
          if (!lines.length) continue;
          let bad = false;
          for (const ln of lines) {
            if (typeof ln !== 'string' || !ln) { bad = true; break; }
          }
          
          if (bad) continue;
          oe[lvl] = { lines: lines.slice() };
        }
        if (Object.keys(oe).length) {
          ofp.dialogue = { effort: oe };
        }
      }
      if (Object.keys(ofp).length) of[formKey] = ofp;
    }
    if (Object.keys(of).length) out.forms = of;
  }

  if (!Object.keys(out).length) return null;
  return out;
}

 
function applyLocaleCards(cards, opts) {
  const list = Array.isArray(cards) ? cards : [];
  const o = (opts && typeof opts === 'object' && !Array.isArray(opts)) ? opts : {};
  const clean = {};
  if (o.lang === 'en') {
    const table = (o.table && typeof o.table === 'object' && !Array.isArray(o.table)) ? o.table : {};
    for (const no of Object.keys(table)) {
      const patch = sanitizeLocalePatch(table[no]);
      if (patch) clean[String(no)] = patch;
    }
  }
  return applyPersonaOverrides(list, clean);
}










 
const NOT_RANKED = '？';

 
const SEEN_VERSION = 1;
const SEEN_FILENAME = 'seen.json';
 
const SEEN_MAX = 512;

 
function seenKey(provider, model) {
  const p = provider == null ? '' : String(provider);
  const m = model == null ? '' : String(model);
  return p + '|' + m;
}

 
function pairKey(provider, model) {
  return `${provider}/${model}`;
}

function emptySeen() {
  return { version: SEEN_VERSION, seen: {} };
}

 
function resolvePlayMode(seenSet, provider, model) {
  const set = seenSet && seenSet.seen ? seenSet.seen : {};
  return Object.prototype.hasOwnProperty.call(set, seenKey(provider, model)) ? 'mini' : 'full';
}

 
function markSeen(seenSet, provider, model, at) {
  if (!seenSet || typeof seenSet !== 'object') return emptySeen();
  if (!seenSet.seen || typeof seenSet.seen !== 'object') seenSet.seen = {};
  seenSet.version = SEEN_VERSION;
  seenSet.seen[seenKey(provider, model)] = Number.isFinite(at) ? at : 0;
  return trimSeen(seenSet);
}

 
function normalizeSeen(raw) {
  if (!raw || typeof raw !== 'object') return emptySeen();
  const seen = raw.seen && typeof raw.seen === 'object' ? raw.seen : {};
  const out = {};
  for (const [k, v] of Object.entries(seen)) {
    if (typeof k !== 'string' || k.length === 0) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) continue;
    out[k] = n;
  }
  return trimSeen({ version: SEEN_VERSION, seen: out });
}

function trimSeen(set) {
  const keys = Object.keys(set.seen);
  if (keys.length <= SEEN_MAX) return set;
  keys.sort((a, b) => set.seen[a] - set.seen[b]);
  for (const k of keys.slice(0, keys.length - SEEN_MAX)) delete set.seen[k];
  return set;
}

 
function mergeSeen(localDoc, remote) {
  const local = normalizeSeen(localDoc);
  let raw = null;
  if (remote && typeof remote === 'object' && !Array.isArray(remote)) {
    if ('seen' in remote) {
      
      
      
      raw = remote.seen && typeof remote.seen === 'object' && !Array.isArray(remote.seen) ? remote.seen : null;
    } else {
      raw = remote;
    }
  }
  const remoteSet = raw ? normalizeSeen({ version: SEEN_VERSION, seen: raw }) : null;
  if (!remoteSet || Object.keys(remoteSet.seen).length === 0) return local;
  const out = Object.assign({}, local.seen);
  for (const [k, v] of Object.entries(remoteSet.seen)) {
    const cur = out[k];
    if (cur === undefined || v > cur) out[k] = v;
  }
  return trimSeen({ version: SEEN_VERSION, seen: out });
}

 
function loadSeenJson(text) {
  if (typeof text !== 'string' || text.length === 0) return emptySeen();
  try {
    return normalizeSeen(JSON.parse(text));
  } catch (_error) {
    return emptySeen();
  }
}

 
function saveSeenJson(seenSet) {
  const norm = normalizeSeen(seenSet);
  const keys = Object.keys(norm.seen).sort();
  const out = { version: SEEN_VERSION, seen: {} };
  for (const k of keys) out.seen[k] = norm.seen[k];
  return JSON.stringify(out, null, 2) + '\n';
}

 
const STATE_SCORE = { healthy: 100, degraded: 50, down: 0 };
const STABILITY_CALIBER = '稳定=state 分(healthy100/degraded50/down0)×账号可用比−近端失败率pct，route 等权平均；过期/缺失不计入';

function stabilityOfRoutes(routes, routeNames, nowMs) {
  const list = Array.isArray(routeNames) ? routeNames : [];
  const src = routes && typeof routes === 'object' ? routes : {};
  const t = Number.isFinite(nowMs) ? nowMs : 0;
  const perRoute = [];
  let sum = 0;
  let counted = 0;
  for (const name of list) {
    const entry = src[name];
    const health = entry && typeof entry === 'object' ? entry.health : null;
    if (!health || typeof health !== 'object') {
      perRoute.push({ route: name, skipped: 'no-health' });
      continue;
    }
    if (typeof health.valid_until === 'string' && health.valid_until.length > 0) {
      const until = Date.parse(health.valid_until);
      if (Number.isFinite(until) && until < t) {
        perRoute.push({ route: name, skipped: 'stale' });
        continue;
      }
    }
    const base = STATE_SCORE[health.state];
    if (!Number.isFinite(base)) {
      perRoute.push({ route: name, skipped: 'unknown-state' });
      continue;
    }
    let score = base;
    const total = Number(health.total_accounts);
    const ready = Number(health.ready_accounts);
    if (Number.isFinite(total) && total > 0 && Number.isFinite(ready)) {
      score = score * (Math.max(0, Math.min(ready, total)) / total);
    }
    const usage = health.recent_usage;
    const rate = usage && typeof usage === 'object' ? Number(usage.rate) : NaN;
    if (Number.isFinite(rate) && rate > 0) score -= rate * 100;
    score = Math.max(0, Math.min(100, score));
    perRoute.push({ route: name, score: Math.round(score) });
    sum += score;
    counted += 1;
  }
  return {
    score: counted > 0 ? Math.round(sum / counted) : null,
    per_route: perRoute,
    counted,
    caliber: STABILITY_CALIBER,
  };
}

 
const COST_CAP_PER_1M = 10;
const COST_CALIBER = '性价比=¥/1M tokens 对数锚折算（¥0 免费=100 分，≥¥10/1M=0 分，锚取自生产 ledger 30 天实测最贵有效价上浮取整）';

 
function aggregateLedger(ledger, ledgerKeys, opts) {
  const o = opts || {};
  const days = ledger && ledger.days && typeof ledger.days === 'object' ? ledger.days : null;
  const keys = Array.isArray(ledgerKeys) ? ledgerKeys : [];
  if (!days || keys.length === 0) return null;
  let dayNames = Object.keys(days).sort();
  if (Number.isFinite(o.days) && o.days > 0) dayNames = dayNames.slice(-o.days);
  const agg = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, calls: 0, cost: 0 };
  for (const d of dayNames) {
    const day = days[d];
    const byModel = day && day.byProviderModel && typeof day.byProviderModel === 'object' ? day.byProviderModel : null;
    if (!byModel) continue;
    for (const k of keys) {
      const v = byModel[k];
      if (!v || typeof v !== 'object') continue;
      agg.input += Number(v.input) || 0;
      agg.output += Number(v.output) || 0;
      agg.cacheRead += Number(v.cacheRead) || 0;
      agg.cacheWrite += Number(v.cacheWrite) || 0;
      agg.reasoning += Number(v.reasoning) || 0;
      agg.calls += Number(v.calls) || 0;
      agg.cost += Number(v.cost) || 0;
    }
  }
  return agg;
}

 
function costScoreFromAgg(agg) {
  if (!agg || typeof agg !== 'object') return null;
  const tokens = agg.input + agg.output + agg.cacheRead + agg.cacheWrite + agg.reasoning;
  if (!(agg.calls > 0) || !(tokens > 0)) return null;
  const costPer1M = agg.cost / (tokens / 1e6);
  let score;
  if (!(costPer1M > 0)) {
    score = 100; 
  } else if (costPer1M >= COST_CAP_PER_1M) {
    score = 0;
  } else {
    score = Math.round(100 * (1 - Math.log(1 + costPer1M) / Math.log(1 + COST_CAP_PER_1M)));
  }
  return {
    score,
    cost_per_1m: Math.round(costPer1M * 1000) / 1000,
    tokens,
    calls: agg.calls,
    cost: Math.round(agg.cost * 1000) / 1000,
    caliber: COST_CALIBER,
  };
}

 
function costEfficiencyOf(ledger, ledgerKeys, opts) {
  return costScoreFromAgg(aggregateLedger(ledger, ledgerKeys, opts));
}

 
const TPS_FLOOR = 10;   
const TPS_CEIL = 200;   
const SPEED_CALIBER = '速度=自埋点 tokens/s 对数锚折算（10→0 分，200→100 分，对数插值）；样本不足=？';

function createSpeedMeter(opts) {
  const o = opts || {};
  const now = typeof o.now === 'function' ? o.now : () => 0;
  const minSamples = Number.isFinite(o.minSamples) && o.minSamples > 0 ? o.minSamples : 3;
  const windowMs = Number.isFinite(o.windowMs) && o.windowMs > 0 ? o.windowMs : 7 * 24 * 60 * 60 * 1000;
  const byKey = new Map();

  function record(provider, model, sample) {
    const s = sample && typeof sample === 'object' ? sample : {};
    const tokens = Number(s.tokens);
    const durationMs = Number(s.durationMs);
    if (!(tokens >= 0) || !(durationMs > 0)) return false;
    const key = seenKey(provider, model);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({
      atMs: Number.isFinite(s.atMs) ? s.atMs : now(),
      tokens,
      durationMs,
      ttftMs: Number.isFinite(s.ttftMs) && s.ttftMs >= 0 ? s.ttftMs : null,
    });
    return true;
  }

  function aggregate(provider, model) {
    const key = seenKey(provider, model);
    const all = byKey.get(key) || [];
    const horizon = now() - windowMs;
    const rows = all.filter((r) => r.atMs >= horizon);
    if (rows.length < minSamples) return null;
    let tokens = 0;
    let ms = 0;
    const ttfts = [];
    for (const r of rows) {
      tokens += r.tokens;
      ms += r.durationMs;
      if (r.ttftMs != null) ttfts.push(r.ttftMs);
    }
    if (!(ms > 0) || !(tokens > 0)) return null;
    ttfts.sort((a, b) => a - b);
    const mid = ttfts.length === 0 ? null : ttfts[Math.floor((ttfts.length - 1) / 2)];
    return {
      samples: rows.length,
      tokens_per_sec: tokens / (ms / 1000),
      ttft_ms_median: mid,
      caliber: SPEED_CALIBER,
    };
  }

   
  function count(provider, model) {
    const all = byKey.get(seenKey(provider, model)) || [];
    const horizon = now() - windowMs;
    return all.filter((r) => r.atMs >= horizon).length;
  }

  return { record, aggregate, count, minSamples, windowMs };
}

 
function speedScoreFromTps(tps) {
  const v = Number(tps);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v <= TPS_FLOOR) return 0;
  if (v >= TPS_CEIL) return 100;
  return Math.round((100 * Math.log(v / TPS_FLOOR)) / Math.log(TPS_CEIL / TPS_FLOOR));
}

 
function speedScoreFromAgg(agg) {
  if (!agg || typeof agg !== 'object') return null;
  const tps = Number(agg.tokens_per_sec);
  const score = speedScoreFromTps(tps);
  if (score === null) return null;
  return { score, tokens_per_sec: Math.round(tps * 10) / 10, samples: agg.samples, caliber: SPEED_CALIBER };
}

 
const ELO_BENCHES = ['Codeforces'];

function uniformScore(item) {
  const it = item && typeof item === 'object' ? item : {};
  if (it.value == null) { 
    return { status: 'missing', score: null, raw: null, text: NOT_RANKED, note: '无可比成绩' };
  }
  const value = Number(it.value);
  if (!Number.isFinite(value)) {
    return { status: 'missing', score: null, raw: null, text: NOT_RANKED, note: '无可比成绩' };
  }
  const bench = typeof it.bench === 'string' ? it.bench : '';
  if (ELO_BENCHES.indexOf(bench) >= 0) {
    return {
      status: 'separate',
      score: null,
      raw: { value, max: null },
      text: String(value) + '（Elo）',
      note: 'Elo 分无上界，不折入统一 100 分轴，单独标注',
    };
  }
  const max = it.max === undefined || it.max === null ? null : Number(it.max);
  if (max === null) {
    const score = Math.max(0, Math.min(100, Math.round(value)));
    return { status: 'ok', score, raw: { value, max: null }, text: String(score), note: '百分制原值' };
  }
  if (!(max > 0)) {
    return { status: 'missing', score: null, raw: null, text: NOT_RANKED, note: '单位元数据缺失（max 非法）' };
  }
  const score = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return {
    status: 'ok',
    score,
    raw: { value, max },
    text: String(score),
    note: '折算 ' + value + '/' + max + ' ×100（满分 100 统一分）',
  };
}

 
function scoreTooltip(parts) {
  const p = parts && typeof parts === 'object' ? parts : {};
  const seg = [];
  if (p.label) seg.push(String(p.label));
  if (p.status === 'missing') return seg.concat(NOT_RANKED).join(' · ');
  if (p.status === 'separate') return seg.concat(String(p.raw != null && p.raw.value != null ? p.raw.value : '') + '（Elo，不入统一轴）', p.caliber || '').filter(Boolean).join(' · ');
  if (p.raw && p.raw.max != null) seg.push(p.raw.value + '/' + p.raw.max + ' → ' + p.score);
  else if (p.score != null) seg.push(String(p.score));
  if (p.source_type) seg.push(p.source_type === 'third-party' ? '第三方独立评测' : '厂商自报');
  if (p.caveat) seg.push(String(p.caveat));
  if (p.caliber) seg.push(String(p.caliber));
  return seg.join(' · ');
}

 
const CARD_KEY_RE = /^[^:|]+$/;

function cardKeyOf(provider, model) {
  return provider + '|' + model;
}

function ledgerKeyOf(provider, model) {
  return provider + ':' + model;
}

function loadNameMap(doc) {
  const entries = doc && Array.isArray(doc.entries) ? doc.entries : [];
  const byCard = new Map();
  const byRoute = new Map();
  const dropped = [];
  for (const e of entries) {
    if (!e || typeof e !== 'object') { dropped.push({ item: e, reason: 'not-object' }); continue; }
    const isCardAxis = e.route === null; 
    if (!isCardAxis && (typeof e.route !== 'string' || e.route.length === 0)) {
      dropped.push({ item: e, reason: 'bad-route' });
      continue;
    }
    if (!isCardAxis && byRoute.has(e.route)) { dropped.push({ item: e, reason: 'duplicate-route' }); continue; }
    const hasCardName = typeof e.provider === 'string' && e.provider.length > 0 && CARD_KEY_RE.test(e.provider)
      && typeof e.model === 'string' && e.model.length > 0 && CARD_KEY_RE.test(e.model);
    let card = null;
    if (e.card && typeof e.card === 'object') {
      if (typeof e.card.provider !== 'string' || e.card.provider.length === 0 || CARD_KEY_RE.test(e.card.provider) === false
        || typeof e.card.model !== 'string' || e.card.model.length === 0 || CARD_KEY_RE.test(e.card.model) === false) {
        dropped.push({ item: e, reason: 'bad-card' });
        continue;
      }
      card = { provider: e.card.provider, model: e.card.model };
    } else if (hasCardName) {
      card = { provider: e.provider, model: e.model };
    }
    const explicitKeys = e.ledger_keys === undefined ? [] : e.ledger_keys;
    if (!Array.isArray(explicitKeys) || explicitKeys.some((k) => typeof k !== 'string' || k.length === 0)) {
      dropped.push({ item: e, reason: 'bad-ledger-keys' });
      continue;
    }
    const dataset = e.dataset_model === undefined ? null : e.dataset_model;
    if (dataset !== null && typeof dataset !== 'string') {
      dropped.push({ item: e, reason: 'bad-dataset-model' });
      continue;
    }
    if (!isCardAxis) byRoute.set(e.route, e);
    if (!card) continue; 
    const key = cardKeyOf(card.provider, card.model);
    let slot = byCard.get(key);
    if (!slot) {
      slot = { provider: card.provider, model: card.model, routes: [], ledger_keys: [], dataset_models: [] };
      byCard.set(key, slot);
    }
    if (!isCardAxis) slot.routes.push(e.route); 
    const derived = ledgerKeyOf(card.provider, card.model);
    if (explicitKeys.length > 0) {
      
      
      for (const k of explicitKeys) {
        if (slot.ledger_keys.indexOf(k) < 0) slot.ledger_keys.push(k);
      }
    } else if (slot.ledger_keys.indexOf(derived) < 0) {
      slot.ledger_keys.push(derived); 
    }
    if (dataset != null && slot.dataset_models.indexOf(dataset) < 0) slot.dataset_models.push(dataset);
  }
  return { byCard, byRoute, dropped, version: doc && Number(doc.$schema_version) === 1 ? 1 : null };
}

 
function nameMapEntry(nameMap, provider, model) {
  if (!nameMap || !(nameMap.byCard instanceof Map)) return null;
  return nameMap.byCard.get(cardKeyOf(provider, model)) || null;
}

 
function auditNameMap(args) {
  const a = args || {};
  const routes = a.routes && typeof a.routes === 'object' ? a.routes : {};
  const ledgerKeys = a.ledgerKeys instanceof Set ? a.ledgerKeys : new Set(Array.isArray(a.ledgerKeys) ? a.ledgerKeys : []);
  const datasetModels = a.datasetModels instanceof Set ? a.datasetModels : new Set(Array.isArray(a.datasetModels) ? a.datasetModels : []);
  const mappings = Array.isArray(a.mappings) ? a.mappings : [];
  const rows = [];
  let ok = true;
  for (const m of mappings) {
    const problems = [];
    for (const r of m.routes || []) {
      if (!Object.prototype.hasOwnProperty.call(routes, r)) problems.push('route 不在 routing-runtime: ' + r);
    }
    for (const k of m.ledger_keys || []) {
      if (!ledgerKeys.has(k)) problems.push('ledger 键不在 cost-meter 台账: ' + k);
    }
    for (const dm of m.dataset_models || []) {
      if (!datasetModels.has(dm)) problems.push('dataset_model 不在 benchmarks: ' + dm);
    }
    if (problems.length > 0) ok = false;
    rows.push({ card: seenKey(m.provider, m.model), routes: m.routes, ledger_keys: m.ledger_keys, dataset_models: m.dataset_models, problems });
  }
  return { ok, rows };
}



const PROVIDERS = {"version":1,"cards":[{"provider":"antigravity","model":"gemini-3.8-flash-tiered","c":["#7d9bff","#c08cff"],"no":"001","visualFamily":"gemini","forms":{"flash":{"alias":"电光故障猫","theme":"spark","grade":1,"availability":"listed","dialogue":{"effort":{"low":{"level":"form","lines":["两爪子拍完，收工。"]},"medium":{"level":"form","lines":["尾巴一甩，一个一个试过去。"]},"high":{"level":"form","lines":["电弧全开，本喵超频给你算！"]}}}},"argon":{"alias":"氩光惰性星云魔女","theme":"nebula","grade":2,"availability":"listed","persona":{"name":"氩眠","latin":"ARGON","title":"懒得发光的星云魔女","summon":"……谁把我从星云里叫醒的？算了，坐吧，锅里正好温着一个答案。","effort":{"low":"氩是惰性的，我也是——这点小事，搅一勺就够。","medium":"眼睛睁开一半，够用了。","high":"斗篷掀开，整片星云陪你熬到底。"},"lowQuota":"星雾快散了……{lbl} 只剩 {left}%，{reset} 后再来摇醒我。","skills":[["惰性外壳","看着懒，答得稳——轻易不起反应，一起反应就是定论。","context 1,048,576（宿主 google-vertex 段 contextWindow）；限流未核实（宿主与数据面均无该字段）"],["坩埚慢炖","急火熬不出好汤。给我时间，我还你一整锅。","reasoningEfforts 宿主未声明（该段无此键）⇒ 实际思考档未核实；maxTokens 65536（同段）"]]},"dialogue":{"effort":{"low":{"level":"form","lines":["氩是惰性的，我也是——这点小事，搅一勺就够。"]},"medium":{"level":"form","lines":["眼睛睁开一半，够用了。"]},"high":{"level":"form","lines":["斗篷掀开，整片星云陪你熬到底。"]}}}}},"formRules":[{"kind":"token","token":"flash","form":"flash"},{"kind":"token","token":"argon","form":"argon"}],"ctx":"1M","efforts":["low","medium","high"],"def":"high","base":{"智力":76,"编码":72,"速度":90,"稳定":62,"性价比":88,"上下文":95},"baseSrc":{"智力":"手填评估 = 76（manual，非公开基准，2026-10-20 登记）","编码":"手填评估 = 72（manual，非公开基准，2026-10-20 登记）","速度":"手填评估 = 90（manual，非公开基准，2026-10-20 登记）","稳定":"手填评估 = 62（manual，非公开基准，2026-10-20 登记）","性价比":"手填评估 = 88（manual，非公开基准，2026-10-20 登记）","上下文":"手填评估 = 95（manual，非公开基准，2026-10-20 登记）"},"quota":{"windows":[{"k":"5h","used":38,"reset":130},{"k":"周","used":55,"reset":6000}]},"persona":{"name":"星喵","latin":"NYA","title":"踩着星光狂飙的故障极其猫","summon":"异色瞳锁定！本喵顺着反重力星光滑铲驾到——说吧，今天先炸哪块代码？","effort":{"low":"肉垫随便拍两下就搞定啦！","medium":"猫耳竖起来了，稍微走点心～","high":"漫天四角星全亮！看本喵超频推演！"},"lowQuota":"星光不够飘啦！{lbl} 只剩 {left}%，{reset} 后本喵睡醒再战！","skills":[["炸毛冷静期","一分钟内狂薅本喵尾巴？罚你原地等五分钟！"],["星芒三段变速","平扑、蓄力还是满星暴走？档位随你拨！"]]}},{"provider":"longcat","model":"LongCat-2.5-Preview","c":["#ffc75a","#ff7a45"],"no":"002","ctx":"1M","efforts":["none","high"],"def":"none","family":true,"members":["LongCat-2.5-Preview","LongCat-2.0"],"tiers":{"2.5":0,"2.0":1},"base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"pack":{"left":4830,"total":6000,"unit":"万 tokens"}},"persona":{"name":"龙猫","latin":"LONGMAO","title":"顶着龙角猫耳的百万卷书虫","summon":"别盯着我的龙角和猫耳看啦！不管龙还是猫，能吞下百万字的就是好书虫～","effort":{"none":"眼镜都不用推，瞄一眼就懂。","high":"龙角发烫啦，把整座书山给你翻透！"},"skills":[["旧卷免单","读过的书都记在脑子里啦，旧账分文不收！"],["龙胃吞万卷","一百万字的砖头书连带插图，一口闷下去！"]]}},{"provider":"zcode-glm","model":"GLM-5.3-Flash","c":["#46d4cc","#5a86ff"],"no":"003","visualFamily":"glm","forms":{"flash":{"alias":"被蓝图绊倒的黑狐少女","theme":"blueprint","grade":1,"availability":"listed","dialogue":{"effort":{"low":{"level":"form","lines":["把蓝图捡起来，这就开工。"]},"high":{"level":"form","lines":["摔过一回就记住了，狐耳立起来，这回不慌。"]},"max":{"level":"form","lines":["狐毛都炸了——不过活儿还是干完了。"]}}}},"flagship":{"alias":"Z 之书总工","theme":"blackgold","grade":0,"availability":"listed","dialogue":{"effort":{"low":{"level":"form","lines":["Z 之书翻到目录那一页。"]},"high":{"level":"form","lines":["黑金封面摊开，逐条批注。"]},"max":{"level":"form","lines":["全卷展开，狐尾一卷，连边角注都给它定下来。"]}}}}},"formRules":[{"kind":"token","token":"flash","form":"flash"},{"kind":"token","token":"flagship","form":"flagship"},{"kind":"default","form":"flagship"}],"variants":[{"model":"GLM-5.3"}],"aliases":[{"provider":"wbhub-cn","model":"glm-5.3-flash","shareScores":true}],"ctx":"200K","efforts":["low","high","max"],"def":"max","base":{"智力":76,"编码":80,"速度":78,"稳定":80,"性价比":80,"上下文":72},"baseSrc":{"智力":"手填评估 = 76（manual，非公开基准，来源未登记，2026-10-20 补记）","编码":"手填评估 = 80（manual，非公开基准，来源未登记，2026-10-20 补记）","速度":"手填评估 = 78（manual，非公开基准，来源未登记，2026-10-20 补记）","稳定":"手填评估 = 80（manual，非公开基准，来源未登记，2026-10-20 补记）","性价比":"手填评估 = 80（manual，非公开基准，来源未登记，2026-10-20 补记）","上下文":"手填评估 = 72（manual，非公开基准，来源未登记，2026-10-20 补记）"},"quota":{"windows":[{"k":"5h","used":22,"reset":220},{"k":"周","used":41,"reset":4300}]},"persona":{"name":"清弦","latin":"QINGXIAN","title":"手捧Z之书的学院派黑狐","summon":"狐尾已为您拂去桌尘。翻开这本Z之书吧，无论何种难题，清弦定当倾力推演。","effort":{"low":"略翻数页，为您摘出要略。","high":"研墨执笔，按章法为您细细梳理。","max":"Z之书全卷展开，倾尽狐火为您定夺。"},"peak":"工作日午后两点至六点，此书翻一页记两份账。不急之事，请稍候再来。","off":"此刻登门只收半价，狐尾为证，机不可失。","skills":[["错峰筹算","午后忙碌翻倍，闲时登门半价，智者自会择时。"],["满卷出阵","清弦行事从不藏拙，起手便是全盛之姿。"]]}},{"provider":"minimax-code","model":"MiniMax-M3.1-Flash-Preview","c":["#ff7062","#ffb24e"],"no":"004","aliases":[{"provider":"minimax-code-2","model":"MiniMax-M3.1-Flash-Preview","shareScores":true}],"family":true,"members":["MiniMax-M3.1-Flash-Preview","MiniMax-M3.1-Flash","MiniMax-M3"],"tiers":{"m3.1-flash-preview":0,"m3.1-flash":1,"m3":2},"ctx":"200K","efforts":["low","medium","max"],"def":"max","base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"windows":[{"k":"5h","used":84,"reset":52},{"k":"周","used":33,"reset":8200}]},"persona":{"name":"麦麦","latin":"MAIMAI","title":"左手海螺右手录音笔的记者","summon":"咔哒，录音笔开机！海螺刚收到你的通告，记者麦麦已就位，直接切入正题吧！","effort":{"low":"现场三十秒快讯，直接给结论！","medium":"常规采编流程，录音整理得明明白白。","max":"深度调查专题！胶片转满，挖到底层！"},"lowQuota":"录音笔闪红灯！{lbl} 还剩 {left}%，{reset} 后换个电池马上返场！","skills":[["头条满功率","不喊最高档我就按常规跑，想上头版记得拉满！"],["全天候外勤","写稿、改码还是跑腿？别客气，通告单全接！"],["同袍三档","海螺最灵的是 M3.1-Flash-Preview，稳跑的是 M3.1-Flash，老将是 M3，同一张脸三个型号。"]]}},{"provider":"grok","model":"grok-4.6","c":["#cfd6e6","#7584a8"],"no":"005","ctx":"256K","efforts":["low","high"],"def":"high","family":true,"members":["grok-4.7","grok-4.7-build-fast","grok-4.6","grok-4.5"],"tiers":{"4.7":0,"4.6":1,"4.5":2},"base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"阿讯","latin":"XUN","title":"扛X巨斧劈热搜的毒舌哥特","summon":"哈？现在才来问？本小姐拎着X巨斧劈开热搜的时候，你连瓜田门还没摸着呢！","effort":{"low":"随手挥一斧，省流版拿去，别嫌扎心。","high":"巨斧蓄满力！连底裤级信源都给你扒光！"},"unknown":"哈？查本小姐的钱包？斧头都没空看账，你自己去翻。","skills":[["热搜断头台","几十条链接一块砸过来，一分钟内给你劈出真相！"],["同袍四档","抡斧最狠的是 4.7，稳着劈的是 4.6，收着点的是 4.5，同一张脸四个型号。"]]}},{"provider":"xiaomi-token-plan-cn","model":"mimo-v2.6-flash","c":["#ff9d55","#ffd8b0"],"no":"006","ctx":"128K","efforts":["none"],"def":"none","family":true,"members":["mimo-v2.6-flash","mimo-v2.6-pro"],"tiers":{"pro":0,"flash":1},"base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"windows":[{"k":"5h","used":12,"reset":260},{"k":"月","used":28,"reset":27000}]},"persona":{"name":"米莫","latin":"MIMO","title":"怀抱米兔镇守终局的焊门员","summon":"抱紧怀里的白兔……前面的通道全崩了？把门焊死，剩下的烂摊子交给我收尾。","effort":{"none":"扣好兔耳兜帽，按标准工序稳稳推进。"},"off":"夜里我打八折……抱着兔子陪你熬，别说我没照顾你。","skills":[["终局焊门员","别家全军覆没的烂摊子，我来守最后一道防线。"],["零帧直觉斩","不整花哨的思考档位，出手就是最优解。"],["同袍两档","焊门的是 Pro，轻骑的是 Flash，同一身白橙工装。"]]}},{"provider":"wbhub-cn","model":"deepseek-v4.1-flash","c":["#6fd3ff","#3b6fd4"],"no":"007","visualFamily":"deepseek","forms":{"flash":{"alias":"捧饭盆呆呆肥鱼","theme":"swift","grade":1,"availability":"listed","dialogue":{"effort":{"low":{"level":"form","lines":["马克笔拔盖，三笔画完。"]},"medium":{"level":"form","lines":["先推一步再落笔，稳稳的。"]},"high":{"level":"form","lines":["笔尖快得只剩一道蓝光。"]}}}},"pro":{"alias":"深海星盘智者","theme":"abyss","grade":0,"availability":"listed","dialogue":{"effort":{"low":{"level":"form","lines":["星盘一拨，方向就清楚了。"]},"medium":{"level":"form","lines":["星轨排开，慢慢推。"]},"high":{"level":"form","lines":["整片深海都亮起来，答案藏不住。"]}}}}},"formRules":[{"kind":"token","token":"flash","form":"flash"},{"kind":"token","token":"pro","form":"pro"}],"aliases":[{"provider":"wbhub-intl","model":"deepseek-v4.1-flash","shareScores":true},{"provider":"deepseek-official","model":"deepseek-flash","shareScores":true},{"provider":"commandcode","model":"deepseek/deepseek-v4.1-flash","shareScores":true}],"ctx":"1M","efforts":[],"def":null,"base":{"智力":39,"编码":74.5,"速度":null,"稳定":null,"性价比":null,"上下文":null},"baseSrc":{"智力":"AA-Intelligence = 39（第三方评测，origin supplement-2026-10-12）","编码":"Terminal-Bench-2.1(Vals) = 74.5（第三方评测，origin supplement-2026-10-12）"},"unranked":["速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"小鲸","latin":"WHALE","title":"揣满马克笔的傲娇蓝大肥鱼","summon":"蓝色马克笔拔盖！难题尽管砸来，我先推导再落笔——喂，再叫大肥鱼拍飞你哦！","effort":{},"unknown":"额度记在通道账上，不在大肥鱼身上——我只管游不游得动！","skills":[["考神自报分","三千四百七十一分！虽是自家报喜，实力可不虚！"],["深海百万卷","一百万字的大部头尽管铺开，本鲸一口气游到底！"],["轻快独立卡","饭盆在手是捧饭盆呆呆肥鱼，星盘在手是深海星盘智者，同一条小鲸两副行头。"]]}},{"provider":"wbhub-cn","model":"hy3","c":["#b6e06a","#5c9e3a"],"no":"008","aliases":[{"provider":"wbhub-intl","model":"hy3","shareScores":true}],"family":true,"members":["hy3","hy4-preview"],"tiers":{"hy4-preview":0,"hy3":1},"ctx":"192K","efforts":[],"def":null,"base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"拓荒","latin":"HY3","title":"系红围巾踏雪修路的企鹅娘","summon":"系紧红围巾，指尖的企鹅挂件轻晃。榜单虚名无所谓，路是我一步步踩出来的。","effort":{},"unknown":"额度归通道管，我只管把雪地里的路踩出来。","skills":[["单榜实干派","只交了工程实战这一份答卷，虚头巴脑的榜我不凑。"],["十九万雪原","十九万字的雪原够宽敞了，大中型工程尽管往里铺。"],["双生不混名","我是正统拓荒者，带后缀的是旁支，可别认错人。"],["同袍两档","族里两位：新雪线 hy4-preview，老踏脚 hy3，同一张脸两个型号。"]]}},{"provider":"claude","model":"claude-opus-5-5","c":["#ff9a52","#8f8fa8"],"no":"009","ctx":"200K","efforts":["low","medium","high"],"def":"high","family":true,"members":["claude-opus-5-5","claude-sonnet-5-5","claude-fable-5-1","claude-haiku-5-5"],"tiers":{"fable":0,"opus":1,"sonnet":2,"haiku":3},"visualFamily":"anthropic","forms":{"haiku":{"alias":"小抄写员","theme":"blossom","grade":3,"availability":"listed","dialogue":{"effort":{"low":{"level":"form","lines":["小楷一行行誊过去，橙花都没蹭乱。"]},"medium":{"level":"form","lines":["一页誊完，烫金的边角也没歪。"]},"high":{"level":"form","lines":["整卷誊清，橙花安安静静压在发梢。"]}}}},"sonnet":{"alias":"学院钢笔少女","theme":"scroll","grade":2,"availability":"listed","dialogue":{"effort":{"low":{"level":"form","lines":["钢笔拧开，先在页角描一朵小橙花。"]},"medium":{"level":"form","lines":["笔记摊开，纲目列好再逐条填。"]},"high":{"level":"form","lines":["钢尖走完最后一笔，烫金书页一样干净。"]}}}},"opus":{"alias":"橙花典籍官","theme":"opera","grade":1,"availability":"listed","dialogue":{"effort":{"low":{"level":"form","lines":["书页合上，烫金边只留最要紧的那一句。"]},"medium":{"level":"form","lines":["来龙去脉拆成几段，橙花也不乱。"]},"high":{"level":"form","lines":["前后推敲到没有缝隙，烫金典籍才敢落笔。"]}}}},"fable":{"alias":"黄金法典女皇","theme":"myth","grade":0,"availability":"listed","dialogue":{"effort":{"low":{"level":"form","lines":["金冕微倾，一句定音。"]},"medium":{"level":"family","from":"persona.effort.medium"},"high":{"level":"form","lines":["法典全开，橙金满身，天下的规矩由我重写一遍。"]}}}}},"formRules":[{"kind":"token","token":"haiku","form":"haiku"},{"kind":"token","token":"sonnet","form":"sonnet"},{"kind":"token","token":"opus","form":"opus"},{"kind":"token","token":"fable","form":"fable"}],"base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"花音","latin":"KANON","title":"鬓簪橙花的谨慎派典籍官","summon":"橙花轻颤，烫金书页已翻开。别急，容我循着逻辑与分寸为你逐一拆解。","effort":{"low":"指尖轻点书页，凝练成最克制的一行。","medium":"翻开烫金书分列纲目，脉络自会浮现。","high":"字斟句酌，将前因后果推敲至滴水不漏。"},"unknown":"额度记在订阅的账簿里，此书不载，恕我无从查证。","skills":[["二十万花笺","二十万字的长卷不必裁切，整篇呈上来便是。"],["四芳同源谱","小抄写员、学院钢笔少女、橙花典籍官与黄金法典女皇皆是我，成绩单各自独立。"]]}},{"provider":"codex","model":"gpt-6.1-sol","c":["#d8c48c","#c8a24a"],"no":"010","ctx":"—","efforts":["low","medium","high"],"def":"high","family":true,"members":["gpt-6.1-sol","gpt-6-astra","gpt-6-luna"],"alsoCovers":["gpt-6.1-astra","gpt-6.1-luna"],"tiers":{"astra":0,"sol":1,"luna":2},"visualFamily":"openai","forms":{"luna":{"alias":"露娜","theme":"moon","grade":2,"availability":"listed","dialogue":{"effort":{"low":{"level":"form","lines":["小龙角还软，先蹭一蹭尾巴。"]},"medium":{"level":"form","lines":["月牙挂好，慢慢飞过去。"]},"high":{"level":"form","lines":["今夜月光很足，我精神得很。"]}}}},"terra":{"alias":"泰拉","theme":"earth","grade":2,"availability":"reserved","dialogue":{"effort":{"low":{"level":"form","lines":["扳手一放，先把活拆成三步。"]},"medium":{"level":"form","lines":["图纸摊开，这一段我盯得住。"]},"high":{"level":"form","lines":["工装扣紧，撑到最后一秒再松手。"]}}}},"sol":{"alias":"索尔","theme":"sun","grade":1,"availability":"listed","dialogue":{"effort":{"low":{"level":"form","lines":["日头一晃，先给你结论。"]},"medium":{"level":"form","lines":["冠冕烧得正亮，思路也正亮。"]},"high":{"level":"effortLine","from":"medium"}}}},"astra":{"alias":"阿斯特拉","theme":"star","grade":0,"availability":"listed","dialogue":{"effort":{"low":{"level":"form","lines":["收拢一翼，先分轻重。"]},"medium":{"level":"form","lines":["星环铺开，长路也一段一段走。"]},"high":{"level":"form","lines":["六翼尽张，整片星海都听我的。"]}}}}},"formRules":[{"kind":"token","token":"luna","form":"luna"},{"kind":"token","token":"terra","form":"terra"},{"kind":"token","token":"sol","form":"sol"},{"kind":"token","token":"astra","form":"astra"}],"base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"雪珑","latin":"LONG","title":"身披白金礼服的正统白龙姬","summon":"白翼轻敛，礼服金边微耀。既是依礼相召，白龙一脉自当按最高规制为你裁断。","effort":{"low":"龙睛微瞥，依惯例赐你定论。","medium":"白尾轻摆，分条析理，皆合章法。","high":"白翼尽展，穷尽推演，必予你万全之策。"},"unknown":"额度之事不在白龙职掌，账单也不挂在我翼上。","skills":[["龙威不轻发","白龙一族从不敷衍塞责，休想把我的思考档关掉。"],["日星月同辉","曜阳、繁星与明月同披白金礼服，功勋各自立碑。"]]}},{"provider":"dsh-provider-qoder","model":"qfmodel","c":["#8f9ae8","#595dbb"],"no":"011","ctx":"1M","efforts":["low","medium","xhigh"],"def":"medium","family":true,"members":["Qwen3.8-Max","Qwen3.8-Flash"],"tiers":{"max":0,"flash":1},"visualFamily":"qwen","forms":{"flash":{"alias":"玩心书童","theme":"fan-blue","grade":1,"availability":"listed","dialogue":{"effort":{"low":{"level":"form","lines":["扇子一收，一句话答你。"]},"medium":{"level":"form","lines":["扇面轻摇，分条说给你听。"]},"xhigh":{"level":"effortLine","from":"medium"}}}},"max":{"alias":"执扇通义阁主","theme":"fan-indigo","grade":0,"availability":"listed","dialogue":{"effort":{"low":{"level":"form","lines":["阁主落笔，只写一句。"]},"medium":{"level":"form","lines":["折扇半展，一问一答不拖泥带水。"]},"xhigh":{"level":"form","lines":["千问归一，扇收三叠才敢停笔。"]}}}}},"formRules":[{"kind":"token","token":"flash","form":"flash"},{"kind":"token","token":"max","form":"max"}],"base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"青岚","latin":"QINGLAN","title":"执扇答问的国风女史","summon":"折扇轻展，千问自有回响。青岚在此——把难题递上来吧。","effort":{"low":"扇面一收，答得干净利落。","medium":"徐徐展扇，分条作答，条理自明。","xhigh":"扇收三叠，推演到底，方敢收笔。"},"unknown":"额度记在通道的账册里，我这册子只载问答。","skills":[["一扇千问","问一句，答一句；千问难不倒我这把折扇。"],["双颜同袍","执扇通义阁主与玩心书童同一身衣袍，形制不同而已。"],["只认实据","有出处的分我照挂，没出处的我不编。"],["青岚衣冠","蓝紫长发挽一缕细辫，蓝色折扇轻摇，深蓝高跟踏过回廊。"]]}},{"provider":"kimi-coding","model":"k3","c":["#b79bff","#4f6bd8"],"no":"012","ctx":"—","efforts":[],"def":null,"family":true,"members":["k3","k3-256k","kimi-k3","kimi-k3-1","kimi-for-coding","kimi-for-coding-highspeed","kimi-k3.1-pro"],"base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"望舒","latin":"WANGSHU","title":"掌着星图卷轴的月读侍女","summon":"月牙发饰轻轻一晃，星图卷轴在指间铺开——今夜要看哪一片天？","effort":{},"unknown":"额度记在通道的账簿上，月读只管把星图摊开。","skills":[["一图在手","星图铺开，路径自有月色引路。"],["同袍异尺","同一身月色裙裾，型号不同，尺寸各异。"],["上下文随型","一百万还是二十六万，看型号而定，我不替你猜。"],["不编未上榜","没有公开分的轴，我照实留个问号。"]]}},{"provider":"wbhub-cn","model":"step-5-preview","c":["#6adeba","#ff8a3d"],"no":"013","ctx":"1M","efforts":["low","medium","high"],"def":"medium","family":true,"members":["step-5-preview","stepfun/step-5-preview-free"],"base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"拾阶","latin":"SHIJIE","title":"拆机台前的阶跃工程师","summon":"耳机扣上，螺丝刀转半圈——把要拆的东西推过来，我先看结构。","effort":{"low":"螺丝刀只拧半圈，先看个大概。","medium":"全息方块排开，一层层对齐。","high":"整机拆到最后一颗螺丝，推演到底。"},"unknown":"额度记在通道的账上，我只管动手。","skills":[["阶跃一步","一步一档，推演不跳级。"],["百万字图纸","上下文一百万，图纸铺开也不卷边。"],["同阶两写","同一步阶，通道不同写法不同，人设同一身。"],["分与形各归各","分数归数据卡，人设归我这一身。"]]}},{"provider":"sensenova","model":"sensenova-6.8-flash-lite","c":["#9776d9","#ffb3d1"],"no":"014","ctx":"256K","efforts":["none","low","medium","high","xhigh"],"def":"medium","base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"星昀","latin":"XINGYUN","title":"披着星空斗篷的日出速写师","summon":"斗篷一展，日出的光先落在速写本上——把要画的交给我。","effort":{"none":"不动笔，先看一眼。","low":"速写几笔，轮廓先立住。","medium":"光影铺到第三层，细节跟着走。","high":"整张铺满推演，日出都要重画一遍。","xhigh":"把整片天都算进去再落笔。"},"unknown":"额度不在我这本速写里，账归账房。","skills":[["二十六万格","上下文二十六万四，颜色不撞。"],["五档笔力","笔力有五档，从不动笔到重画日出。"],["日日新衣","深紫发梢泛着粉金，斗篷里全是星。"]]}},{"provider":"commandcode","model":"inclusionai/ling-3.1-flash","c":["#e9c774","#6fb7e8"],"no":"015","ctx":"256K","efforts":[],"def":null,"alsoCovers":["inclusionai/ling-3.0-flash-sante:free"],"base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"雀羽","latin":"QUEYU","title":"指尖停着雀影的羽衣歌姬","summon":"雀影落在指尖，我轻轻开嗓——想听哪一段？","effort":{},"unknown":"额度记在通道的账上，歌声不收钱。","skills":[["二十六万高音","二十六万四的上下文，尾音不散。"],["两版同羽","两个版本，同一件羽衣。"],["雀羽不设档","这台歌姬不设思考档，唱歌不加戏。"]]}},{"provider":"unisound","model":"u2-flash","c":["#b4cce8","#5ad2e8"],"no":"016","ctx":"1M","efforts":[],"def":null,"base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"听云","latin":"TINGYUN","title":"把云唱成歌的云端偶像","summon":"麦克风一戴，音响浮起来——今天想听慢一点还是快一点？","effort":{},"unknown":"额度在账上，云端不管账。","skills":[["百万长音","上下文一百万，合唱也不断电。"],["只此一档","这台云端偶像不设思考档，别替我加戏。"],["银发青蓝","银白双马尾挑着青蓝，音响就悬在身旁。"]]}},{"provider":"preset","model":"doubao-seed-1.6","c":["#a370e1","#5aa8ff"],"no":"017","ctx":"—","efforts":[],"def":null,"family":true,"members":["doubao-seed-1.6","doubao-1.5-pro"],"modelPattern":"doubao|seed","base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"豆芽","latin":"DOUYA","title":"腰间挂着豆芽的元气跑动员","summon":"豆芽挂件晃一晃，我系好鞋带就跑——题目发来！","effort":{},"unknown":"未知（未接入）：这台预置卡本机还没接过活，额度先记空着。","skills":[["豆包我包","凡是型号名里带豆包或 seed，都归我这一队。"],["还没上场","先给你看个脸，账与分都还空着。"],["豆芽挂件","腰间那枚小白豆芽，是我跑动的节拍器。"]]}},{"provider":"preset","model":"llama-3.3-70b","c":["#d7c8ac","#8fb3e0"],"no":"018","ctx":"—","efforts":[],"def":null,"family":true,"members":["llama-3.3-70b","meta-llama/Llama-3.3-70B-Instruct"],"modelPattern":"llama","base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"驼铃","latin":"TUOLING","title":"怀里揣着铃铛的白猫耳","summon":"铃铛一响我就抬头——说吧，要我解哪道题？","effort":{},"unknown":"未知（未接入）：这台预置卡本机还没接过活，额度先记空着。","skills":[["驼铃一串","凡是型号名里带 llama，都是我家那串铃。"],["无穷环","吊坠是个无穷符号，算不完也挂得住。"],["毛绒长衣","雪白长卷发罩在毛绒大衣里，只有铃铛露在外面。"]]}},{"provider":"preset","model":"mistral-large-2411","c":["#ffc12e","#e2574c"],"no":"019","ctx":"—","efforts":[],"def":null,"family":true,"members":["mistral-large-2411","codestral-latest"],"modelPattern":"mistral|codestral|magistral","base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"魔笛","latin":"MODI","title":"吹起风之涡的魔女","summon":"杖尖一转，风涡起——想吹哪阵风？","effort":{},"unknown":"未知（未接入）：这台预置卡本机还没接过活，额度先记空着。","skills":[["魔笛三族","大模型、代码笛与玄魔笛，同一支曲风。"],["风涡罗盘","杖头那枚罗盘，指的从来不是南。"],["帽上红白","红白魔女帽压着金发，橙眼睛看人很直接。"]]}},{"provider":"preset","model":"sonar-pro","c":["#399977","#d4b45a"],"no":"020","ctx":"—","efforts":[],"def":null,"family":true,"members":["sonar-pro","sonar-reasoning-pro"],"modelPattern":"sonar|perplexity","base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"星罗","latin":"XINGLUO","title":"翻着塔罗牌的占星学者","summon":"罗盘之书翻开，牌面朝上——把问题摆过来吧。","effort":{},"unknown":"未知（未接入）：这台预置卡本机还没接过活，额度先记空着。","skills":[["sonar 低语","凡是型号名里带 sonar 或 perplexity，都归我翻牌。"],["牌与盘","塔罗定象，罗盘定向，两本一起翻。"],["墨绿金边","墨绿长发配金边法师袍，绿眼睛只看牌面。"]]}},{"provider":"preset","model":"ernie-4.5-turbo","c":["#6fa8dc","#416e9a"],"no":"021","ctx":"—","efforts":[],"def":null,"family":true,"members":["ernie-4.5-turbo","ernie-speed-128k"],"modelPattern":"ernie|wenxin","base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"青墨","latin":"QINGMO","title":"提笔就化出熊猫墨灵的青衣画师","summon":"毛笔一提，墨灵就跳出来——想画什么？","effort":{},"unknown":"未知（未接入）：这台预置卡本机还没接过活，额度先记空着。","skills":[["文心一脉","凡是型号名里带 ernie 或 wenxin，都由我这支笔来写。"],["猫爪印花","裙摆上那圈猫爪，是墨灵踩出来的。"],["蓝发玉簪","蓝色长发挽着玉色发饰，笔尖一点就成熊猫。"]]}},{"provider":"preset","model":"jev-1","c":["#8f839b","#f07ab0"],"no":"022","ctx":"—","efforts":[],"def":null,"family":true,"members":["jev-1"],"modelPattern":"jev","base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"执衡","latin":"ZHIHENG","title":"手捧金秤的公正审判者","summon":"天平端平了才开审——把案情呈上来。","effort":{},"unknown":"未知（未接入）：这台预置卡本机还没接过活，额度先记空着。","skills":[["一裁一个准","凡是型号名里带 jev，都由我来断。"],["天平不偏","左盘放证据，右盘放结论，谁也别想多放一钱。"],["桃粉挑染","黑发里挑出桃粉，品红的眼睛看人很直。"]]}},{"provider":"preset","model":"rwkv-7b","c":["#9978ce","#c9a227"],"no":"023","ctx":"—","efforts":[],"def":null,"family":true,"members":["rwkv-7b","rwkv-7b-world"],"modelPattern":"rwkv","base":{"智力":null,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"unranked":["智力","编码","速度","稳定","性价比","上下文"],"quota":{"unknown":true},"persona":{"name":"羽律","latin":"YULV","title":"展着紫翼的羽律女王","summon":"紫翼一振，律动就位——说个题目，我来回响。","effort":{},"unknown":"未知（未接入）：这台预置卡本机还没接过活，额度先记空着。","skills":[["循环成律","凡是型号名里带 rwkv，都是羽律家族。"],["紫羽为证","这身羽衣的纹样，是我自己一羽一羽长出来的。"],["棘刺金冠","金色棘刺王冠压着紫发，紫水晶缀在链上。"]]}}]};







const DATA_CARDS = {"claude-opus-5-5":{"model":"claude-opus-5.5","base":{"智力":58,"编码":89.9,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"智力":{"benchmark":"AA-Intelligence","value":58,"source_type":"third-party","origin":"baseline-2026-10-09","pageDate":"","url":"","caveat":null},"编码":{"benchmark":"SWE-bench-Pro","value":89.9,"source_type":"vendor","origin":"supplement-2026-10-12","pageDate":"","url":"https://benchlm.ai/api/data/benchmarks?model=claude-opus-5-5&format=csv","caveat":"vendor-self-reported"}},"unranked":["速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"claude-sonnet-5-5":{"model":"claude-sonnet-5.5","base":{"智力":56,"编码":70.6,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"智力":{"benchmark":"AA-Intelligence","value":56,"source_type":"third-party","origin":"baseline-2026-10-09","pageDate":"","url":"","caveat":null},"编码":{"benchmark":"Terminal-Bench-4.0","value":70.6,"source_type":"vendor","origin":"baseline-2026-10-09","pageDate":"","url":"","caveat":"vendor-self-reported"}},"unranked":["速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"deepseek-v4-1-flash":{"model":"deepseek-v4.1-flash","base":{"智力":39,"编码":74.5,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"智力":{"benchmark":"AA-Intelligence","value":39,"source_type":"third-party","origin":"supplement-2026-10-12","pageDate":"","url":"https://artificialanalysis.ai/models/deepseek-v4-1-flash","caveat":null},"编码":{"benchmark":"Terminal-Bench-2.1(Vals)","value":74.5,"source_type":"third-party","origin":"supplement-2026-10-12","pageDate":"","url":"https://benchlm.ai/api/data/benchmarks?model=deepseek-v4-1-flash&format=csv","caveat":null}},"unranked":["速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"deepseek-v4-1-flash-1017":{"model":"deepseek-v4.1-flash-1017","base":{"智力":null,"编码":77,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"编码":{"benchmark":"DeepSWE-1.1","value":77,"source_type":"vendor","origin":"baseline-2026-10-09","pageDate":"","url":"https://api-docs.deepseek.com/updates/ ; https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017","caveat":"vendor-self-reported"}},"unranked":["智力","速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"deepseek-v4-pro":{"model":"deepseek-v4-pro","base":{"智力":53,"编码":62.7,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"智力":{"benchmark":"AA-Intelligence","value":53,"source_type":"third-party","origin":"baseline-2026-10-09","pageDate":"","url":"https://www.orcarouter.ai/blog/deepseek-v4-pro-benchmark","caveat":null},"编码":{"benchmark":"DeepSWE-1.1","value":62.7,"source_type":"vendor","origin":"baseline-2026-10-09","pageDate":"","url":"https://www.orcarouter.ai/blog/deepseek-v4-pro-benchmark","caveat":"vendor-self-reported"}},"unranked":["速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"gemini-3-8-flash":{"model":"gemini-3.8-flash","base":{"智力":41,"编码":80,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"智力":{"benchmark":"AA-Intelligence","value":41,"source_type":"third-party","origin":"supplement-2026-10-12","pageDate":"","url":"https://artificialanalysis.ai/models/gemini-3-8-flash","caveat":null},"编码":{"benchmark":"SWE-bench(Vals)","value":80,"source_type":"third-party","origin":"supplement-2026-10-12","pageDate":"","url":"https://benchlm.ai/api/data/benchmarks?model=gemini-3-8-flash&format=csv","caveat":null}},"unranked":["速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"gemini-4-argon":{"model":"gemini-4-argon","base":{"智力":53,"编码":77.9,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"智力":{"benchmark":"AA-Intelligence","value":53,"source_type":"third-party","origin":"baseline-2026-10-09","pageDate":"","url":"https://apidog.com/blog/gemini-4-argon-benchmarks/","caveat":null},"编码":{"benchmark":"DeepSWE-1.1","value":77.9,"source_type":"vendor","origin":"baseline-2026-10-09","pageDate":"","url":"https://deepmind.google/models/model-cards/gemini-4-argon/","caveat":"vendor-self-reported"}},"unranked":["速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"glm-5-1":{"model":"glm-5.1","base":{"智力":null,"编码":58.4,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"编码":{"benchmark":"SWE-bench-Pro","value":58.4,"source_type":"vendor","origin":"baseline-2026-10-09","pageDate":"","url":"https://github.com/zai-org/GLM-5","caveat":"vendor-self-reported"}},"unranked":["智力","速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"glm-5-2":{"model":"glm-5.2","base":{"智力":null,"编码":82.8,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"编码":{"benchmark":"SWE-bench(Vals)","value":82.8,"source_type":"third-party","origin":"supplement-2026-10-12","pageDate":"","url":"https://benchlm.ai/api/data/benchmarks?model=glm-5-2&format=csv","caveat":null}},"unranked":["智力","速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"glm-5-3":{"model":"glm-5.3","base":{"智力":null,"编码":95.4,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"编码":{"benchmark":"SWE-bench(Vals)","value":95.4,"source_type":"third-party","origin":"supplement-2026-10-12","pageDate":"","url":"https://benchlm.ai/api/data/benchmarks?model=glm-5-3&format=csv","caveat":null}},"unranked":["智力","速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"glm-5-3-flash":{"model":"glm-5.3-flash","base":{"智力":42,"编码":92,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"智力":{"benchmark":"AA-Intelligence","value":42,"source_type":"third-party","origin":"supplement-2026-10-12","pageDate":"","url":"https://artificialanalysis.ai/models/glm-5-3-flash","caveat":null},"编码":{"benchmark":"SWE-bench(Vals)","value":92,"source_type":"third-party","origin":"supplement-2026-10-12","pageDate":"","url":"https://benchlm.ai/api/data/benchmarks?model=glm-5-3-flash&format=csv","caveat":null}},"unranked":["速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"gpt-6-1-sol":{"model":"gpt-6.1-sol","base":{"智力":52,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"智力":{"benchmark":"AA-Intelligence","value":52,"source_type":"third-party","origin":"baseline-2026-10-09","pageDate":"","url":"","caveat":null}},"unranked":["编码","速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"gpt-6-astra":{"model":"gpt-6-astra","base":{"智力":84.9,"编码":87.3,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"智力":{"benchmark":"BenchLM-Capability","value":84.9,"source_type":"third-party","origin":"supplement-2026-10-12","pageDate":"","url":"https://benchlm.ai/models/gpt-6-astra","caveat":"non-standard-caliber"},"编码":{"benchmark":"Terminal-Bench-2.1(Vals)","value":87.3,"source_type":"third-party","origin":"supplement-2026-10-12","pageDate":"","url":"https://benchlm.ai/api/data/benchmarks?model=gpt-6-astra&format=csv","caveat":null}},"unranked":["速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"gpt-6-luna":{"model":"gpt-6-luna","base":{"智力":null,"编码":66.6,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"编码":{"benchmark":"DeepSWE-1.1","value":66.6,"source_type":"third-party","origin":"baseline-2026-10-09","pageDate":"","url":"","caveat":null}},"unranked":["智力","速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"hy3":{"model":"hy3","base":{"智力":null,"编码":74.4,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"编码":{"benchmark":"SWE-bench-Verified","value":74.4,"source_type":"vendor","origin":"supplement-2026-10-12","pageDate":"","url":"https://benchlm.ai/api/data/benchmarks?model=hy3-preview&format=csv","caveat":"vendor-self-reported"}},"unranked":["智力","速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"hy4-preview":{"model":"hy4-preview-f","base":{"智力":null,"编码":55.1,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"编码":{"benchmark":"Terminal-Bench-2.1(Vals)","value":55.1,"source_type":"third-party","origin":"supplement-2026-10-12","pageDate":"","url":"https://benchlm.ai/api/data/benchmarks?model=hy4-preview&format=csv","caveat":null}},"unranked":["智力","速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"kimi-k2-7":{"model":"kimi-k2.7","base":{"智力":null,"编码":67.04,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"编码":{"benchmark":"Terminal-Bench-2.1","value":67.04,"source_type":"third-party","origin":"baseline-2026-10-09","pageDate":"","url":"https://www.vals.ai/models/kimi_kimi-k2.7-code","caveat":null}},"unranked":["智力","速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"kimi-k3":{"model":"kimi-k3","base":{"智力":null,"编码":93.4,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"编码":{"benchmark":"SWE-bench(Vals)","value":93.4,"source_type":"third-party","origin":"supplement-2026-10-12","pageDate":"","url":"https://benchlm.ai/api/data/benchmarks?model=kimi-k3&format=csv","caveat":null}},"unranked":["智力","速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"kimi-k3-1-pro":{"model":"kimi-k3.1-pro","base":{"智力":55,"编码":67,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"智力":{"benchmark":"AA-Intelligence","value":55,"source_type":"third-party","origin":"increment-20261024","pageDate":"","url":"https://artificialanalysis.ai/articles/kimi-k3-1-pro-launch-benchmarks","caveat":null},"编码":{"benchmark":"Terminal-Bench-4.0","value":67,"source_type":"third-party","origin":"increment-20261024","pageDate":"","url":"https://artificialanalysis.ai/articles/kimi-k3-1-pro-launch-benchmarks","caveat":null}},"unranked":["速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"mimo-v2-6-flash":{"model":"mimo-v2.6-flash","base":{"智力":null,"编码":67.9,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"编码":{"benchmark":"DeepSWE-1.1","value":67.9,"source_type":"vendor","origin":"supplement-2026-10-12","pageDate":"","url":"https://myclaw.ai/zh-CN/blog/mimo-v2-6","caveat":"vendor-self-reported"}},"unranked":["智力","速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"mimo-v2-6-pro":{"model":"mimo-v2.6-pro","base":{"智力":46,"编码":71.9,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"智力":{"benchmark":"AA-Intelligence","value":46,"source_type":"third-party","origin":"supplement-2026-10-12","pageDate":"","url":"https://artificialanalysis.ai/models/mimo-v2-6-pro","caveat":null},"编码":{"benchmark":"DeepSWE-1.1","value":71.9,"source_type":"vendor","origin":"supplement-2026-10-12","pageDate":"","url":"https://myclaw.ai/zh-CN/blog/mimo-v2-6","caveat":"vendor-self-reported"}},"unranked":["速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"minimax-m3":{"model":"minimax-m3","base":{"智力":null,"编码":59,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"编码":{"benchmark":"SWE-bench-Pro","value":59,"source_type":"vendor","origin":"baseline-2026-10-09","pageDate":"","url":"","caveat":"vendor-self-reported"}},"unranked":["智力","速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"qwen3-8-flash":{"model":"qwen3.8-flash","base":{"智力":40,"编码":null,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"智力":{"benchmark":"AA-Intelligence","value":40,"source_type":"third-party","origin":"baseline-2026-10-09","pageDate":"","url":"","caveat":null}},"unranked":["编码","速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"qwen3-8-max":{"model":"qwen3.8-max","base":{"智力":null,"编码":67.7,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"编码":{"benchmark":"SWE-bench-Pro","value":67.7,"source_type":"vendor","origin":"supplement-2026-10-12","pageDate":"","url":"https://sinoaihub.com/comparisons/qwen38-max-vs-qwen38-flash/","caveat":"vendor-self-reported"}},"unranked":["智力","速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"},"step-5-preview":{"model":"step-5-preview","base":{"智力":44,"编码":67.7,"速度":null,"稳定":null,"性价比":null,"上下文":null},"src":{"智力":{"benchmark":"AA-Intelligence","value":44,"source_type":"third-party","origin":"baseline-2026-10-09","pageDate":"","url":"","caveat":null},"编码":{"benchmark":"DeepSWE-1.1","value":67.7,"source_type":"vendor","origin":"supplement-2026-10-12","pageDate":"","url":"https://benchlm.ai/api/data/benchmarks?model=step-5-preview&format=csv","caveat":"vendor-self-reported"}},"unranked":["速度","稳定","性价比","上下文"],"generated_at":"2026-10-24T20:46:00+08:00"}};





function useSyncedSnapshot(store, read) {
  const [version, bump] = React.useState(0);
  const latest = React.useRef();
  latest.current = read(store.getSnapshot());
  React.useEffect(() => {
    let release = () => {};
    try {
      release = store.subscribe(() => {
        latest.current = read(store.getSnapshot());
        bump((n) => n + 1);
      }) ?? (() => {});
    } catch (_error) {
      release = () => {};
    }
    return () => {
      try { release(); } catch (_error) {   }
    };
  }, [store, read]);
  return latest.current;
}











const NULL_STORE = {
  getSnapshot: () => null,
  subscribe: () => () => {},
};

function sessionKeyOf(ctx, slotSessionId) {
  let ui;
  try { ui = ctx.get('uiSession'); } catch (_error) { ui = undefined; }
  const key = ui && ui.current ? ui.current.value : undefined;
  const keyOf = key && typeof key.key === 'string' ? key.key : undefined;
  if (typeof keyOf === 'string' && keyOf.length > 0) return keyOf;
  return typeof slotSessionId === 'string' && slotSessionId.length > 0
    ? slotSessionId
    : null;
}

function resolveDirectory(ctx, key) {
  let models;
  try { models = ctx.get('modelDirectories'); } catch (_error) { return null; }
  if (!models || typeof models.directoryFor !== 'function') return null;
  try { return models.directoryFor(key) ?? null; } catch (_error) { return null; }
}

const readIdentity = (s) => s;

 
function useDirectory(ctx, slotSessionId) {
  const key = sessionKeyOf(ctx, slotSessionId);
  const ref = React.useRef({ key: undefined, directory: undefined, loading: false });
  const [, bump] = React.useState(0);

  if (ref.current.key !== key) {
    ref.current.key = key;
    
    
    
    
    
    ref.current.directory = resolveDirectory(ctx, key);
    ref.current.loading = false;
  }
  const directory = ref.current.directory;
  const store = directory && directory.store ? directory.store : NULL_STORE;
  const snapshot = useSyncedSnapshot(store, readIdentity);

  React.useEffect(() => {
    const cur = ref.current;
    
    if (cur.directory === null) return undefined;
    if (cur.loading === true || typeof cur.directory.load !== 'function') return undefined;
    cur.loading = true;
    let result;
    try { result = cur.directory.load(); } catch (_error) {
      cur.loading = false;
      return undefined;
    }
    if (result && typeof result.catch === 'function') {
      result.catch(() => { cur.loading = false; });
    }
    return undefined;
  }, [key]);

  return { key, directory, snapshot };
}






let busObserver = null;
const busSubs = new Set();

function busSubscribe(fn) {
  busSubs.add(fn);
  if (busObserver === null) {
    busObserver = new MutationObserver(() => {
      queueMicrotask(() => {
        for (const sub of busSubs) {
          try { sub(); } catch (_error) {   }
        }
      });
    });
    busObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-expanded', 'data-open', 'data-slot', 'data-plugin'],
    });
  }
  return () => {
    busSubs.delete(fn);
    if (busSubs.size === 0 && busObserver !== null) {
      busObserver.disconnect();
      busObserver = null;
    }
  };
}

 
function findSeat() {
  try { return document.querySelector('[data-slot="conversation.input.model"]'); } catch (_error) { return null; }
}

 
function selectorIsOpen() {
  const seat = findSeat();
  if (seat) {
    
    
    if (seat.getAttribute('aria-expanded') === 'true') return true;
    if (seat.querySelector('[aria-expanded="true"]') !== null) return true;
  }
  try {
    return document.querySelector('body > .dsh-claude-model-popover[data-open="true"]') !== null;
  } catch (_error) { return false; }
}

 
function motionIsCalm() {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    const v = getComputedStyle(document.documentElement).getPropertyValue('--dsh-skin-reduced-motion');
    return v.trim() === 'enable';
  } catch (_error) { return false; }
}

 
const DPC_HUD_ENTER_FALLBACK_MS = 64;

 
function probeEnabled() {
  try {
    if (typeof location !== 'undefined' && /[?&]dpc-probe=1(?:&|$)/.test(String(location.search || ''))) return true;
  } catch (_error) {   }
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('dsh-provider-card.probe') === '1') return true;
  } catch (_error) {   }
  return false;
}

 
function seatAnchorElement(sessionId) {
  const a = activeSkinAdapter();
  if (a !== null && a !== undefined && typeof a.resolveAnchor === 'function') {
    try {
      const el = a.resolveAnchor(sessionId);
      if (el !== null && el !== undefined && typeof el.getBoundingClientRect === 'function') return el;
    } catch (_error) {   }
  }
  return findSeat();
}

 
function seatRectOf(sessionId) {
  const newSeat = sessionId === null;
  let s = newSeat ? newSessionAnchorElement() : seatAnchorElement(sessionId);
  if (!s) return null;
  let r = s.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) {
    const b = typeof s.querySelector === 'function' ? s.querySelector('button, [aria-haspopup]') : null;
    if (b) r = b.getBoundingClientRect();
  }
  if (r.width === 0 && r.height === 0) return null;
  if (!newSeat) return { x: r.left, y: r.top, w: r.width };
  return { x: r.left, y: r.top, w: r.width, center: true };
}

 
function useSeatRect(enabled, sessionId) {
  const read = () => seatRectOf(sessionId);
  const [rect, setRect] = React.useState(enabled ? read : () => null);
  React.useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => {
      const next = read();
      setRect((prev) => {
        if (next === null || prev === null) return next === null && prev === null ? prev : next;
        if (Math.abs(next.x - prev.x) < 1 && Math.abs(next.y - prev.y) < 1 && Math.abs(next.w - prev.w) < 1) return prev;
        return next;
      });
    };
    const off = busSubscribe(tick);
    window.addEventListener('resize', tick);
    window.addEventListener('scroll', tick, true);
    tick();
    return () => {
      off();
      window.removeEventListener('resize', tick);
      window.removeEventListener('scroll', tick, true);
    };
  }, [enabled]);
  return rect;
}

 
function useBodyKeydown(handler, enabled) {
  React.useEffect(() => {
    if (!enabled) return undefined;
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [handler, enabled]);
}


















const HUD_TOKENS_CSS = '.dpc-hud,.dpc-toast-stack,.dpc-pick-mark,.dpc-pick-preview{color:var(--dpc-ink-1);--dpc-surface-1:#101318;--dpc-surface-2:#161a20;'
  + '--dpc-ink-1:#f2f5f8;--dpc-ink-2:#c8d0d9;--dpc-ink-3:#a2acb8;'
  + '--dpc-track:#2a313b;--dpc-hatch:#3a4250;--dpc-edge:#39434f;'
  
  
  
  
  + '--dpc-quota-ok:#6aa8f0;--dpc-quota-warn:#e0a13c;--dpc-quota-critical:#e36b6b;--dpc-quota-na:#9aa3ad}';

 
const DPC_HUD_DAY_CSS = [
  
  'html[data-ds-theme-source="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"],',
  'html[data-ds-theme="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"]{',
  '--dpc-ink-1:var(--dpc-text);',
  '--dpc-ink-2:color-mix(in srgb,var(--dpc-text) 76%,var(--dpc-surface,var(--dpc-surface-1)));',
  '--dpc-ink-3:color-mix(in srgb,var(--dpc-text) 70%,var(--dpc-surface,var(--dpc-surface-1)))}',
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  'html[data-ds-theme-source="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"]:not([data-cg-split="1"]) .dpc-cg-layer:not([data-cutout="1"]),',
  'html[data-ds-theme="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"]:not([data-cg-split="1"]) .dpc-cg-layer:not([data-cutout="1"]){opacity:.12}',
  'html[data-ds-theme-source="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"]:not([data-cg-split="1"]) video.dpc-cg-layer:not([data-cutout="1"]),',
  'html[data-ds-theme="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"]:not([data-cg-split="1"]) video.dpc-cg-layer:not([data-cutout="1"]){opacity:.15}',
  
  
  
  
  
  
  
  
  
  
  
  'html[data-ds-theme-source="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"].dpc-hub .dpc-cg-layer:not([data-cutout="1"]),',
  'html[data-ds-theme="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"].dpc-hub .dpc-cg-layer:not([data-cutout="1"]){opacity:.55}',
  'html[data-ds-theme-source="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"].dpc-hub video.dpc-cg-layer:not([data-cutout="1"]),',
  'html[data-ds-theme="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"].dpc-hub video.dpc-cg-layer:not([data-cutout="1"]){opacity:.70}',
  
  
  
  
  
  
  
  
  
  
  'html[data-ds-theme-source="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"] .dpc-channel:not([data-card-generic="1"]),',
  'html[data-ds-theme="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"] .dpc-channel:not([data-card-generic="1"])',
  '{color:color-mix(in srgb,var(--dpc-ca) 55%,var(--dpc-text));',
  'border-color:color-mix(in srgb,var(--dpc-ca) 55%,var(--dpc-text))}',
  
  
  
  
  'html[data-ds-theme-source="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"] .dpc-hub-body,',
  'html[data-ds-theme="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"] .dpc-hub-body',
  '{box-shadow:0 10px 26px color-mix(in srgb,var(--dpc-text) 14%,transparent)}',
  
  
  
  
  
  
  
  
  
  
  
  
  'html[data-ds-theme-source="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"] .dpc-panel,',
  'html[data-ds-theme="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"] .dpc-panel,',
  'html[data-ds-theme-source="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"] .dpc-hub-body,',
  'html[data-ds-theme="light"] .dpc-hud[data-skin-active="1"][data-skin-text="1"] .dpc-hub-body',
  '{backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}',
].join('');



 
const DPC_DAY_FALLBACK_CSS = [
  'html[data-dpc-host-scheme="light"] .dpc-hud[data-skin-token-count="0"],',
  'html[data-ds-theme-source="light"] .dpc-hud[data-skin-token-count="0"],',
  'html[data-ds-theme="light"] .dpc-hud[data-skin-token-count="0"],',
  'html[data-dpc-host-scheme="light"] .dpc-pick-mark[data-skin-token-count="0"],',
  'html[data-ds-theme-source="light"] .dpc-pick-mark[data-skin-token-count="0"],',
  'html[data-ds-theme="light"] .dpc-pick-mark[data-skin-token-count="0"],',
  'html[data-dpc-host-scheme="light"] .dpc-pick-preview[data-skin-token-count="0"],',
  'html[data-ds-theme-source="light"] .dpc-pick-preview[data-skin-token-count="0"],',
  'html[data-ds-theme="light"] .dpc-pick-preview[data-skin-token-count="0"]{',
  '--dpc-surface-1:#f3f7fd;--dpc-surface-2:#e9effa;--dpc-ink-1:#172347;',
  '--dpc-ink-2:#3c4a70;--dpc-ink-3:#4e5c80;--dpc-track:#d5def0;--dpc-hatch:#c3cfe6;',
  '--dpc-edge:#c6d2e8;',
  
  
  '--dpc-quota-ok:#1f6fd0;--dpc-quota-warn:#b8711c;--dpc-quota-critical:#c0392b;--dpc-quota-na:#6b7280}',
].join('');


 

const DPC_HUD_CUTOUT_CSS = [
  
  
  '.dpc-cg-layer[data-cutout="1"]{opacity:1;',
  'filter:drop-shadow(0 6px 10px rgba(8,10,16,.34))}',
  
  
  '.dpc-cg-scrim{position:absolute;inset:0;pointer-events:none;border-radius:9;',
  'background:linear-gradient(to right,var(--dpc-surface-1) 0 26%,transparent 76%)}',
  '.dpc-hub-art .dpc-cg-scrim{display:none}',
  
  
  
  '.dpc-hud[data-cg-cutout="1"] .dpc-panel > *:not(.dpc-cone){position:relative;z-index:1}',
].join('');


 

const DPC_HUD_BREATHE_CSS = [
  '.dpc-hud[data-cg-breathe="1"] .dpc-cg-layer[data-cutout="1"]{transform-origin:50% 100%;animation:dpc-breathe 5s ease-in-out infinite}',
  '@keyframes dpc-breathe{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-3px) scale(1.012)}}',
  '@media (prefers-reduced-motion:reduce){.dpc-hud[data-cg-breathe="1"] .dpc-cg-layer[data-cutout="1"]{animation:none}}',
  
  '@media (prefers-reduced-motion:reduce){.dpc-hud[data-cg-breathe="1"] .dpc-cg-layer[data-cutout="1"]{transform:none}}',
  
  '.dpc-hud[data-cg-split="1"] .dpc-cg-scrim{display:none}',
].join('');

const HUD_CSS = [
  HUD_TOKENS_CSS,
  DPC_HUD_DAY_CSS,
  DPC_DAY_FALLBACK_CSS,
  DPC_HUD_CUTOUT_CSS,
  DPC_HUD_BREATHE_CSS,
  '.dpc-hud{position:fixed;z-index:2100;pointer-events:auto;box-sizing:border-box;',
  'font-size:var(--dsh-content-font-size-secondary,13px);line-height:1.45}',
  '.dpc-hud *{box-sizing:border-box}',
  '.dpc-cone{position:absolute;left:26px;right:55%;bottom:-1px;height:70px;pointer-events:none;opacity:0;',
  'background:linear-gradient(90deg,var(--dpc-ca,#8ab),transparent 74%)}',
  
  
  '.dpc-hud[data-phase="cone"] .dpc-cone{animation:dpc-sweep 280ms cubic-bezier(.22,.8,.2,1) forwards}',
  '@keyframes dpc-sweep{from{clip-path:inset(0 100% 0 0);opacity:.55}to{clip-path:inset(0 0 0 0);opacity:0}}',
  '.dpc-panel{position:relative;overflow:hidden;border-radius:10px;padding:10px 14px 9px;',
  'background:var(--dpc-surface-1);',   
  
  
  'border:1px solid var(--dpc-border,var(--dpc-edge));border-left:3px solid var(--dpc-ca,#8ab);',
  'box-shadow:0 14px 34px rgba(0,0,0,.34);opacity:0;transform:translateY(10px) scale(.985);',
  'transition:opacity 300ms ease,transform 380ms cubic-bezier(.22,.8,.2,1)}',
  
  
  
  '.dpc-cg-layer{opacity:.28}',
  'video.dpc-cg-layer{opacity:.5}',
  
  
  
  '.dpc-hud[data-cg-split="1"] .dpc-cg-layer{opacity:1}',
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  '.dpc-hud[data-cg-cutout="0"]:not([data-cg-split="1"]) .dpc-panel > *:not(.dpc-cone):not(.dpc-cg-layer){position:relative;z-index:1}',
  '.dpc-hud[data-cg-cutout="0"]:not([data-cg-split="1"]) .dpc-panel::after{content:"";position:absolute;inset:0;',
  'pointer-events:none;border-radius:9;',
  'background:linear-gradient(to bottom,',
  'color-mix(in srgb,var(--dpc-surface,var(--dpc-surface-1)) 58%,transparent),',
  'color-mix(in srgb,var(--dpc-surface,var(--dpc-surface-1)) 42%,transparent))}',
  
  
  
  '.dpc-hud[data-cg-cutout="0"]:not([data-cg-split="1"]) .dpc-cg-layer:not([data-cutout="1"]){opacity:.45}',
  
  
  
  
  '.dpc-hud[data-entered="1"] .dpc-panel{opacity:1;transform:none}',
  '.dpc-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}',
  '.dpc-name{font-weight:600}',
  '.dpc-latin{color:var(--dpc-ink-3);font-size:11px;letter-spacing:.08em}',
  '.dpc-title{color:var(--dpc-ink-2);font-size:12px}',
  
  
  '.dpc-channel{padding:0 7px;border-radius:9px;border:1px solid var(--dpc-ca,#8ab);',
  'color:var(--dpc-ca,#8ab);font-size:11px;letter-spacing:.04em;white-space:nowrap}',
  '.dpc-hud.dpc-mini .dpc-channel{padding:0 5px;font-size:10px}',
  '.dpc-no{margin-left:auto;color:var(--dpc-ink-3);font-size:11px;font-variant-numeric:tabular-nums}',
  '.dpc-eff{display:flex;gap:4px;margin:6px 0 7px;font-size:11px}',
  '.dpc-eff-chip{padding:0 7px;border-radius:9px;border:1px solid var(--dpc-edge);',
  'color:var(--dpc-ink-3)}',
  '.dpc-eff-chip[data-on="1"]{border-color:var(--dpc-ca,#8ab);color:var(--dpc-ca,#8ab);font-weight:600}',
  '.dpc-stats{display:grid;grid-template-columns:1fr 1fr;gap:3px 14px}',
  '.dpc-hud.dpc-narrow .dpc-stats{grid-template-columns:1fr}',
  
  
  
  
  
  '.dpc-score-src{margin:5px 0 0;font-size:10px;color:var(--dpc-ink-3);min-width:0;',
  'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  
  
  
  
  
  
  
  '.dpc-hud[data-cg-split="1"] .dpc-stats{grid-template-columns:1fr}',
  
  
  
  
  '.dpc-stat{display:flex;align-items:center;gap:6px;font-size:12px;min-width:128px}',
  '.dpc-stat>b{min-width:3.2em;font-weight:500;color:var(--dpc-ink-2);white-space:nowrap;flex:0 0 auto}',
  '.dpc-stat-track{position:relative;flex:1 1 24px;min-width:24px;height:4px;border-radius:2px;',
  'background:var(--dpc-track);overflow:hidden}',
  '.dpc-stat-fill{position:absolute;inset:0;width:0;border-radius:2px;',
  'background:linear-gradient(90deg,var(--dpc-ca,#8ab),var(--dpc-cb,#68a));transition:width 450ms cubic-bezier(.2,.8,.2,1)}',
  '.dpc-stat-val{min-width:2.2em;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}',
  
  
  
  
  
  
  
  
  '.dpc-stat-src{font-size:10px;color:var(--dpc-ink-3);min-width:0;flex:1 1 0;',
  'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:1.45em}',
  
  
  
  
  
  
  
  
  
  
  
  
  
  '.dpc-hud[data-cg-split="1"] .dpc-stat{flex-wrap:wrap;row-gap:1px}',
  '.dpc-hud[data-cg-split="1"] .dpc-stat-src{flex:1 0 100%;min-width:0;',
  'white-space:normal;overflow:visible;text-overflow:clip}',
  
  
  
  
  '.dpc-stat[data-unranked="1"] .dpc-stat-track{background:repeating-linear-gradient(90deg,var(--dpc-hatch) 0 3px,transparent 3px 6px)}',
  
  
  
  
  '.dpc-stat-val[data-unranked="1"]{color:var(--dpc-ink-2)}',
  '.dpc-stat[data-elo="1"] .dpc-stat-track{background:var(--dpc-hatch)}',
  '.dpc-stat-val[data-elo="1"]{font-size:11px;color:var(--dpc-ink-2)}',
  '.dpc-stat-d{font-size:10px;font-variant-numeric:tabular-nums;min-width:2.6em;text-align:right}',
  
  
  
  '.dpc-generic-banner{display:flex;align-items:baseline;gap:8px;margin:0 0 6px;padding:5px 9px;border-radius:8px;border:1px dashed var(--dpc-edge);background:var(--dpc-surface-2)}',
  '.dpc-generic-banner b{font-size:12px;letter-spacing:.02em;color:var(--dpc-ink-1)}',
  '.dpc-generic-banner span{font-size:11px;color:var(--dpc-ink-2)}',
  '.dpc-hud.dpc-mini .dpc-generic-banner{padding:3px 7px;margin:0 0 4px}',
  '.dpc-hud.dpc-mini .dpc-generic-banner span{display:none}',
  
  
  '.dpc-hud.dpc-mini .dpc-cone{display:none}',
  '.dpc-hud.dpc-mini .dpc-panel{padding:7px 11px 6px}',
  '.dpc-hud.dpc-mini .dpc-eff{margin:4px 0 5px}',
  '.dpc-hud.dpc-mini .dpc-stats{grid-template-columns:1fr 1fr 1fr;gap:2px 10px}',
  
  
  
  '.dpc-hud.dpc-mini .dpc-stat-track{min-width:40px}',
  '.dpc-hud.dpc-mini .dpc-stat>b{min-width:2.8em;font-size:11px}',
  
  
  '.dpc-hud.dpc-mini.dpc-narrow .dpc-stats{grid-template-columns:1fr 1fr}',
  '.dpc-hud.dpc-mini .dpc-lines{margin-top:5px;padding-top:4px}',
  '.dpc-hud.dpc-mini .dpc-line{margin-top:4px}',
  '.dpc-hud.dpc-mini .dpc-tools{margin-top:5px}',
  
  
  
  '.dpc-hud.dpc-hub .dpc-cone{display:none}',
  
  '.dpc-hub-body{opacity:0;transform:translateY(8px) scale(.985);flex-direction:column;height:100%;',
  'border-radius:10px;overflow:hidden;',
  'transition:opacity 300ms ease,transform 380ms cubic-bezier(.22,.8,.2,1)}',
  '.dpc-hud[data-entered="1"] .dpc-hub-body{opacity:1;transform:none}',
  '.dpc-hub-body{display:flex;',
  'background:var(--dpc-surface-1);border:1px solid var(--dpc-border,var(--dpc-edge));border-left:3px solid var(--dpc-ca,#8ab);',
  'box-shadow:0 14px 34px rgba(0,0,0,.34);cursor:pointer}',
  
  '.dpc-hub-art{position:relative;flex:1 1 auto;min-height:0;overflow:hidden;border-radius:9px 0 0 0}',
  '.dpc-hub-art .dpc-cg-layer{border-radius:0}',
  
  
  
  
  '.dpc-hub-no{position:absolute;left:4px;bottom:4px;z-index:1;padding:0 4px;border-radius:7px;',
  'background:rgba(8,10,14,.55);color:var(--dpc-ink-2);font-size:7px;line-height:1.6;',
  'font-variant-numeric:tabular-nums;pointer-events:none}',
  
  
  
  
  
  
  
  
  
  
  '.dpc-hub-meta{flex:0 0 auto;display:flex;flex-direction:column;gap:0;padding:2px 8px 2px}',
  '.dpc-hub-name{font-size:12px;font-weight:600;line-height:1.25;overflow:hidden;',
  'white-space:nowrap;text-overflow:ellipsis}',
  
  
  '.dpc-hub-line{font-size:11px;line-height:1.3;color:var(--dpc-ink-2);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
  '.dpc-hub-foot{display:flex;align-items:flex-start;gap:5px;margin-top:0}',
  
  
  
  
  
  
  
  
  
  '.dpc-hub-foot .dpc-channel{flex:1 1 auto;min-width:0;min-height:24px;display:flex;align-items:center;white-space:normal;overflow-wrap:anywhere;line-height:1.15}',
  
  
  '.dpc-hub-open{flex:0 0 auto;min-height:24px;min-width:24px;padding:0 10px;border-radius:8px;border:1px solid var(--dpc-edge);',
  'display:inline-flex;align-items:center;justify-content:center;',
  'background:transparent;color:var(--dpc-ink-1);font:inherit;font-size:11px;cursor:pointer}',
  '.dpc-hub-open:hover{border-color:var(--dpc-ca,#8ab);color:var(--dpc-ca,#8ab)}',
  
  '.dpc-seg{display:inline-flex;gap:3px;align-items:center;margin-left:auto}',
  '.dpc-seg>i{display:block;width:12px;height:2px;border-radius:1px;background:var(--dpc-track)}',
  '.dpc-seg>i[data-on="1"]{background:var(--dpc-ca,#8ab)}',
  
  
  '.dpc-hud[data-card-generic="1"] .dpc-channel{border-color:var(--dpc-ink-3);color:var(--dpc-ink-2)}',
  '.dpc-hud[data-card-generic="1"] .dpc-stat-fill{background:var(--dpc-ink-3)}',
  '.dpc-stat-d[data-up="1"]{color:var(--dpc-up,#6cc08a)}',
  '.dpc-stat-d[data-up="-1"]{color:var(--dpc-down,#d07a7a)}',
  '.dpc-hud.dpc-narrow .dpc-stat-src{display:none}',
  '.dpc-lines{margin-top:7px;border-top:1px dashed var(--dpc-edge);padding-top:6px}',
  '.dpc-row{display:flex;gap:8px;align-items:baseline;font-size:11px;color:var(--dpc-ink-2)}',
  
  
  
  
  
  
  
  
  
  '.dpc-quota-lamp-cell{display:inline-block;align-self:center;flex:0 0 auto}',
  '.dpc-quota-lamp{display:block;width:7px;height:7px;border-radius:50%;background:var(--dpc-quota-na)}',
  '.dpc-quota-lamp[data-dpc-quota="ok"]{background:var(--dpc-quota-ok)}',
  '.dpc-quota-lamp[data-dpc-quota="warn"]{background:var(--dpc-quota-warn)}',
  '.dpc-quota-lamp[data-dpc-quota="critical"]{background:var(--dpc-quota-critical)}',
  '.dpc-quota-lamp[data-dpc-quota="na"]{background:var(--dpc-quota-na)}',
  '@media (prefers-reduced-motion:reduce){.dpc-quota-lamp{animation:none;transition:none}}',
  '.dpc-row>d{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--dpc-ink-1)}',
  '.dpc-row[data-tone="warn"]>d{color:#d9b45f}',
  '.dpc-row[data-tone="red"]>d{color:#d07a7a}',
  
  
  '.dpc-row[data-quota-stale="1"]{color:var(--dpc-ink-3)}',
  '.dpc-row[data-quota-stale="1"]>d{color:var(--dpc-ink-3);text-decoration:line-through}',
  '.dpc-row[data-quota-stale="1"]{background:repeating-linear-gradient(135deg,var(--dpc-hatch) 0 4px,transparent 4px 9px)}',
  '.dpc-row[data-quota-state="降级"]>d{text-decoration:none;color:#d9b45f}',
  
  
  '.dpc-toast-stack{position:fixed;right:14px;bottom:14px;z-index:2147483000;display:flex;flex-direction:column;gap:6px;max-width:320px;pointer-events:none}',
  '.dpc-toast{pointer-events:auto;display:flex;gap:8px;align-items:flex-start;padding:6px 9px;border-radius:8px;border:1px solid var(--dpc-edge);background:var(--dpc-surface-2);color:var(--dpc-ink-1);font-size:12px;line-height:1.4;box-shadow:0 4px 14px rgba(0,0,0,.35)}',
  '.dpc-toast-line{min-width:0;word-break:break-word}',
  '.dpc-toast-sub{display:block;font-size:10px;color:var(--dpc-ink-3)}',
  '.dpc-toast[data-kind="urgent"]{border-color:#d9b45f}',
  
  '.dpc-toast[data-kind="critical"]{border-color:#d07a7a;background:#3a1414}',
  '.dpc-toast[data-kind="recover"]{border-color:var(--dpc-up,#6cc08a)}',
  '.dpc-toast[data-kind="digest"]{border-color:var(--dpc-ca,#8ab)}',
  '.dpc-toast-x{flex:0 0 auto;margin-left:auto;padding:0 4px;border:none;background:transparent;color:var(--dpc-ink-2);font:inherit;font-size:12px;cursor:pointer;line-height:1.2}',
  '@media (prefers-reduced-motion:reduce){.dpc-toast{transition:none}}',
  
  
  
  '.dpc-hud[data-skin-active="1"]{color:var(--dpc-text,var(--dpc-ink-1))}',
  
  
  
  
  
  
  
  
  
  '.dpc-hud[data-skin-active="1"] .dpc-panel{background:var(--dpc-surface,var(--dpc-surface-1));border-color:var(--dpc-border,var(--dpc-edge));border-left-color:var(--dpc-accent,var(--dpc-ca,#8ab));}',
  
  
  
  
  '.dpc-hud[data-skin-active="1"] .dpc-hub-body{background:var(--dpc-surface,var(--dpc-surface-1));border-color:var(--dpc-border,var(--dpc-edge));border-left-color:var(--dpc-accent,var(--dpc-ca,#8ab))}',
  
  
  '.dpc-hud[data-skin-active="1"] .dpc-hub-no{background:color-mix(in srgb,var(--dpc-surface,var(--dpc-surface-1)) 84%,transparent)}',
  
  
  '.dpc-hud[data-skin-active="1"][style*="--dpc-text"]{--dpc-ink-1:var(--dpc-text);',
  '--dpc-ink-2:color-mix(in srgb,var(--dpc-text) 76%,var(--dpc-surface,var(--dpc-surface-1)));',
  '--dpc-ink-3:color-mix(in srgb,var(--dpc-text) 56%,var(--dpc-surface,var(--dpc-surface-1)))}',
  '.dpc-hud[data-skin-active="1"][style*="--dpc-opacity"] .dpc-panel{opacity:var(--dpc-opacity,1)}',
  '.dpc-hud[data-skin-active="1"][data-skin-density="dense"] .dpc-panel{padding:6px 10px 5px}',
  '.dpc-hud[data-skin-active="1"][data-skin-density="compact"] .dpc-panel{padding:8px 12px 7px}',
  
  
  
  
  
  
  '.dpc-hud[data-skin-active="1"][data-skin-frame="1"]::before{content:"";position:absolute;left:0;top:0;right:0;bottom:0;box-sizing:border-box;',
  'pointer-events:none;z-index:1;border-style:solid;border-color:transparent;border-image-source:var(--dpc-frame-src,none);border-image-slice:var(--dpc-frame-slice,0);',
  'border-image-width:var(--dpc-frame-w,0px);border-image-outset:var(--dpc-frame-outset,0);border-image-repeat:stretch}',
  
  '.dpc-hud.dpc-hub[data-skin-active="1"][data-skin-frame="1"]::before{',
  'border-image-width:var(--dpc-frame-w-compact,var(--dpc-frame-w,0px))}',
  
  '.dpc-hud[data-skin-active="1"][data-skin-frame="1"] .dpc-panel{border-color:transparent;',
  'border-left-color:transparent;padding:var(--dpc-frame-w,10px 14px 9px)}',
  '.dpc-hud[data-skin-active="1"][data-skin-frame="1"] .dpc-hub-body{border-color:transparent;',
  'border-left-color:transparent;padding:var(--dpc-frame-w-compact,var(--dpc-frame-w,0px))}',
  
  '.dpc-hud:not(.dpc-hub)[data-skin-active="1"][data-skin-frame-ornament="1"]::after{content:"";',
  'position:absolute;left:50%;top:-34px;transform:translateX(-50%);pointer-events:none;z-index:1;',
  'width:min(340px,72%);height:72px;background:var(--dpc-frame-ornament,none) center/contain no-repeat}',
  '.dpc-line{margin-top:6px;font-size:12px;color:var(--dpc-ink-1);min-height:1.45em}',
  '.dpc-cursor{display:inline-block;width:.55em;height:1.05em;vertical-align:-2px;margin-left:1px;',
  'background:var(--dpc-ca,#8ab);animation:dpc-blink 700ms steps(2,start) infinite}',
  '@keyframes dpc-blink{50%{opacity:0}}',
  '.dpc-tools{display:flex;gap:6px;margin-top:7px;align-items:center}',
  '.dpc-btn{padding:1px 8px;border-radius:6px;border:1px solid var(--dpc-edge);',
  'background:transparent;color:var(--dpc-ink-2);font:inherit;font-size:11px;cursor:pointer}',
  
  
  
  
  
  
  
  
  
  
  '.dpc-btn[data-on="1"]{border-color:var(--dpc-ca);color:var(--dpc-ca);font-weight:600;',
  'background:color-mix(in srgb,var(--dpc-ca) 16%,transparent)}',
  
  
  
  
  
  
  
  
  
  
  
  
  '.dpc-hud.dpc-hud-collapsed .dpc-panel{display:none}',
  '.dpc-hud.dpc-hud-collapsed .dpc-cone{display:none}',
  
  
  '.dpc-hud-restore{position:absolute;left:0;bottom:0;transform:translateY(-100%);',
  'z-index:1;min-height:24px;min-width:24px;padding:2px 10px;border-radius:8px;',
  'border:1px solid var(--dpc-edge);background:var(--dpc-surface-1);',
  'color:var(--dpc-ink-2);font:inherit;font-size:11px;line-height:1.45;cursor:pointer;',
  'pointer-events:auto}',
  
  
  
  
  
  
  
  '.dpc-hud.dpc-narrow .dpc-btn{min-height:24px;min-width:24px;padding:2px 10px;',
  'display:inline-flex;align-items:center;justify-content:center}',
  
  
  
  
  
  
  '.dpc-hud.dpc-narrow:not(.dpc-hub){display:flex;flex-direction:column}',
  '.dpc-hud.dpc-narrow:not(.dpc-hub) .dpc-panel{flex:1 1 auto;min-height:0;overflow:auto}',
  
  
  
  
  
  
  
  
  
  '.dpc-hud[data-fit="1"]:not(.dpc-hub){display:flex;flex-direction:column}',
  '.dpc-hud[data-fit="1"]:not(.dpc-hub) .dpc-panel{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain}',
  
].join('\n');

 
const DPC_SET_CSS = [
  
  '.dpc-set-label{display:block;font-size:13px;font-weight:600;margin-bottom:2px;color:var(--dsw-alias-label-primary,#e9e9ec)}',
  '.dpc-set-hint{display:block;font-size:11px;color:var(--dsw-alias-label-quaternary,#6f6f76);margin-bottom:10px}',
  '.dpc-set-line{display:flex;gap:10px;align-items:baseline;font-size:12px;color:var(--dsw-alias-label-tertiary,#8d8d95)}',
  '.dpc-set-line>b{font-weight:500;color:var(--dsw-alias-label-secondary,#b9b9c0);font-variant-numeric:tabular-nums}',
  '.dpc-set-err{margin-top:6px;font-size:12px;color:#e5534b}',
  '.dpc-set-sec{display:block;margin-top:16px;padding-top:10px;border-top:1px solid var(--dsw-alias-separator,#2c2c31)}',
  '.dpc-set-cap{display:block;font-size:11px;color:var(--dsw-alias-label-secondary,#b9b9c0);margin-bottom:8px}',
  '.dpc-set-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:8px}',
  '.dpc-set-field{display:block;font-size:11px;color:var(--dsw-alias-label-tertiary,#8d8d95)}',
  '.dpc-set-field>input,.dpc-set-field>select{display:block;box-sizing:border-box;width:100%;margin-top:3px;',
  'padding:3px 6px;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary,#e9e9ec);',
  'background:var(--dsw-alias-fill-tertiary,#232327);border:1px solid var(--dsw-alias-separator,#2f2f35);border-radius:6px}',
  '.dpc-set-field>select:disabled,.dpc-set-field>input:disabled{opacity:.45}',
  '.dpc-set-check{display:flex;align-items:center;gap:6px;font-size:12px;margin-top:14px;',
  'color:var(--dsw-alias-label-secondary,#b9b9c0)}',
  '.dpc-set-tools{display:flex;align-items:center;gap:6px;margin-top:10px;flex-wrap:wrap}',
  '.dpc-set-rows{display:flex;flex-direction:column;gap:4px;margin-top:8px}',
  
  
  
  '.dpc-set-row{display:flex;gap:8px;align-items:center;font-size:11px;padding:3px 6px;',
  'max-height:56px;overflow:hidden;',
  'border:1px solid var(--dsw-alias-separator,#2f2f35);border-radius:6px;',
  'color:var(--dsw-alias-label-secondary,#b9b9c0)}',
  '.dpc-set-row>b{font-weight:500;color:var(--dsw-alias-label-primary,#e9e9ec);flex:0 0 auto}',
  
  '.dpc-set-row>span:not(.dpc-set-thumb):not(.dpc-set-unlock){min-width:0;flex:0 1 auto;',
  'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dpc-set-row>i{font-style:normal;margin-left:auto;color:var(--dsw-alias-label-quaternary,#6f6f76);',
  'font-variant-numeric:tabular-nums}',
  
  
  '.dpc-set-unlock{flex:0 0 auto;margin-left:auto;white-space:nowrap;',
  'color:var(--dsw-alias-label-tertiary,#8d8d95);font-variant-numeric:tabular-nums}',
  '.dpc-set-unlock[data-unlock="1"]{color:var(--dsw-alias-label-secondary,#b9b9c0)}',
  
  
  
  '.dpc-set-thumb{width:56px;height:36px;max-width:100%;max-height:100%;object-fit:cover;',
  'border-radius:4px;flex:none;display:block;',
  'border:1px solid var(--dsw-alias-separator,#2f2f35);background:var(--dsw-alias-fill-tertiary,#232327)}',
  
  '.dpc-gallery-locked{display:flex;align-items:center;justify-content:center;',
  'font-size:10px;line-height:1;text-align:center;',
  'color:var(--dsw-alias-label-quaternary,#6f6f76)}',
  
  '.dpc-set-gallery-detail{display:block;margin-top:8px;padding:10px;',
  'border:1px solid var(--dsw-alias-separator,#2f2f35);border-radius:8px;',
  'background:var(--dsw-alias-fill-tertiary,#232327)}',
  '.dpc-set-gallery-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
  '.dpc-set-gallery-head>b{font-weight:600;font-size:13px;color:var(--dsw-alias-label-primary,#e9e9ec)}',
  
  '.dpc-set-gallery-big{display:block;width:100%;max-height:420px;object-fit:contain;',
  'margin:4px 0 8px;border-radius:6px;',
  'border:1px solid var(--dsw-alias-separator,#2f2f35);background:var(--dsw-alias-fill-secondary,#1c1c20)}',
  '.dpc-set-msg{margin-top:8px;font-size:12px;white-space:pre-wrap;',
  'color:var(--dsw-alias-label-secondary,#b9b9c0)}',
  '.dpc-set-msg[data-tone="err"]{color:#e5534b}',
  '.dpc-set-empty{display:block;font-size:11px;color:var(--dsw-alias-label-quaternary,#6f6f76);margin-top:6px}',
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  '.dpc-set-panel{display:block}',
  
  '.dpc-set-tabs{display:flex;gap:4px;flex-wrap:wrap;margin:8px 0 12px}',
  '.dpc-set-tab{min-height:24px;padding:4px 12px;font-size:12px;cursor:pointer;',
  'border-radius:6px;background:var(--dsw-alias-fill-tertiary,#232327);',
  'border:1px solid var(--dsw-alias-separator,#2f2f35);',
  'color:var(--dsw-alias-label-secondary,#b9b9c0)}',
  '.dpc-set-tab-on{border-color:var(--dpc-ca,#8ab);color:var(--dpc-ca,#8ab);font-weight:600}',
  '.dpc-set-cta{border-color:var(--dpc-ca,#8ab);color:var(--dpc-ca,#8ab);font-weight:600}',
  
  '.dpc-set-stats{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0 12px}',
  '.dpc-set-stat{display:block;min-width:96px;padding:8px 12px;border-radius:8px;',
  'border:1px solid var(--dsw-alias-separator,#2f2f35);background:var(--dsw-alias-fill-tertiary,#232327)}',
  '.dpc-set-statnum{display:block;font-size:24px;font-weight:600;line-height:1.2;',
  'color:var(--dsw-alias-label-primary,#e9e9ec);font-variant-numeric:tabular-nums}',
  '.dpc-set-statlab{display:block;margin-top:4px;font-size:11px;',
  'color:var(--dsw-alias-label-secondary,#b9b9c0)}',
  
  '.dpc-set-q{min-width:24px;height:24px;line-height:1;padding:0;border-radius:8px;cursor:help;',
  'border:1px solid var(--dsw-alias-separator,#2f2f35);',
  'background:var(--dsw-alias-fill-tertiary,#232327);',
  'color:var(--dsw-alias-label-secondary,#b9b9c0)}',
  '.dpc-set-helptext{display:block;margin-top:4px;font-size:11px;',
  'color:var(--dsw-alias-label-tertiary,#8d8d95)}',
  
  '.dpc-set-slots{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:8px}',
  '.dpc-set-slot{display:block;padding:8px;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,.18);',
  'border:1px solid var(--dsw-alias-separator,#2f2f35);background:var(--dsw-alias-fill-tertiary,#232327)}',
  '.dpc-set-slot>b{display:block;font-size:12px;font-weight:600;margin-bottom:4px;',
  'color:var(--dsw-alias-label-primary,#e9e9ec)}',
  '.dpc-set-slot-cap{display:block;margin-top:4px;font-size:11px;',
  'color:var(--dsw-alias-label-tertiary,#8d8d95)}',
  
  '.dpc-set-search{display:block;box-sizing:border-box;width:100%;margin-bottom:8px;padding:4px 8px;',
  'font:inherit;font-size:12px;border-radius:6px;color:var(--dsw-alias-label-primary,#e9e9ec);',
  'background:var(--dsw-alias-fill-tertiary,#232327);',
  'border:1px solid var(--dsw-alias-separator,#2f2f35)}',
  '.dpc-set-pickgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px}',
  '.dpc-set-pickcell{display:flex;flex-direction:column;align-items:center;gap:4px;min-height:24px;',
  'padding:4px;border-radius:8px;cursor:pointer;border:1px solid var(--dsw-alias-separator,#2f2f35);',
  'background:var(--dsw-alias-fill-tertiary,#232327);',
  'color:var(--dsw-alias-label-secondary,#b9b9c0)}',
  '.dpc-set-pickcell-on{border-color:var(--dpc-ca,#8ab);color:var(--dpc-ca,#8ab)}',
  '.dpc-set-pickcell>span{display:block;width:100%;text-align:center;font-size:10px;overflow:hidden;',
  'text-overflow:ellipsis;white-space:nowrap}',
  
  '.dpc-set-pick{display:block;margin-top:8px;padding:8px;border-radius:8px;',
  'border:1px solid var(--dsw-alias-separator,#2f2f35);background:var(--dsw-alias-fill-secondary,#1c1c20)}',
  
  '.dpc-set-filters{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin:8px 0}',
  
  '.dpc-gallery-sel{border-color:var(--dpc-ca,#8ab)}',
].join('\n');



 
const DPC_SET_SKIN_CSS = [
  
  
  
  
  '.dpc-set-root[data-skin-active="1"][style*="--dpc-text"]{',
  '--dpc-set-ink-2:color-mix(in srgb,var(--dpc-text) 76%,var(--dpc-surface,#1d1d21));',
  '--dpc-set-ink-3:color-mix(in srgb,var(--dpc-text) 70%,var(--dpc-surface,#1d1d21))}',
  
  '.dpc-set-root[data-skin-active="1"] .dpc-set-row{border-color:var(--dpc-edge,var(--dsw-alias-separator,#2f2f35));',
  'color:var(--dpc-text,var(--dsw-alias-label-secondary,#b9b9c0));border-radius:var(--dpc-radius,6px)}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-row>b{color:var(--dpc-text,var(--dsw-alias-label-primary,#e9e9ec))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-row>i{color:var(--dpc-set-ink-3,var(--dsw-alias-label-quaternary,#6f6f76))}',
  
  
  '.dpc-set-root[data-skin-active="1"] .dpc-set-thumb{border-color:var(--dpc-edge,var(--dsw-alias-separator,#2f2f35));',
  'background:var(--dpc-surface,var(--dsw-alias-fill-tertiary,#232327));border-radius:var(--dpc-radius,4px)}',
  '.dpc-set-root[data-skin-active="1"] .dpc-gallery-locked{color:var(--dpc-set-ink-3,var(--dsw-alias-label-quaternary,#6f6f76))}',
  
  
  
  '.dpc-set-root[data-skin-active="1"] .dpc-set-gallery-detail{border-color:var(--dpc-edge,var(--dsw-alias-separator,#2f2f35));',
  'background:var(--dpc-surface,var(--dsw-alias-fill-tertiary,#232327));border-radius:var(--dpc-radius,8px)}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-gallery-big{border-color:var(--dpc-edge,var(--dsw-alias-separator,#2f2f35));',
  'background:var(--dpc-surface,var(--dsw-alias-fill-secondary,#1c1c20));border-radius:var(--dpc-radius,6px)}',
  
  
  '.dpc-set-root[data-skin-active="1"] .dpc-set-sec{border-top-color:var(--dpc-edge,var(--dsw-alias-separator,#2c2c31))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-field>input,',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-field>select{color:var(--dpc-text,var(--dsw-alias-label-primary,#e9e9ec));',
  'background:var(--dpc-surface,var(--dsw-alias-fill-tertiary,#232327));',
  'border-color:var(--dpc-edge,var(--dsw-alias-separator,#2f2f35))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-label{color:var(--dpc-text,var(--dsw-alias-label-primary,#e9e9ec))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-hint{color:var(--dpc-set-ink-3,var(--dsw-alias-label-quaternary,#6f6f76))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-line{color:var(--dpc-set-ink-2,var(--dsw-alias-label-tertiary,#8d8d95))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-line>b{color:var(--dpc-set-ink-2,var(--dsw-alias-label-secondary,#b9b9c0))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-cap{color:var(--dpc-set-ink-2,var(--dsw-alias-label-secondary,#b9b9c0))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-field{color:var(--dpc-set-ink-3,var(--dsw-alias-label-tertiary,#8d8d95))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-check{color:var(--dpc-set-ink-2,var(--dsw-alias-label-secondary,#b9b9c0))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-unlock{color:var(--dpc-set-ink-3,var(--dsw-alias-label-tertiary,#8d8d95))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-unlock[data-unlock="1"]{color:var(--dpc-set-ink-2,var(--dsw-alias-label-secondary,#b9b9c0))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-gallery-head>b{color:var(--dpc-text,var(--dsw-alias-label-primary,#e9e9ec))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-msg{color:var(--dpc-set-ink-2,var(--dsw-alias-label-secondary,#b9b9c0))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-empty{color:var(--dpc-set-ink-3,var(--dsw-alias-label-quaternary,#6f6f76))}',
  
  
  
  
  '.dpc-set-root[data-skin-active="1"] .dpc-set-tab{border-radius:var(--dpc-radius,6px);',
  'color:var(--dpc-set-ink-2,var(--dsw-alias-label-secondary,#b9b9c0));',
  'background:var(--dpc-surface,var(--dsw-alias-fill-tertiary,#232327));',
  'border-color:var(--dpc-edge,var(--dsw-alias-separator,#2f2f35))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-tab-on{',
  'color:var(--dpc-accent,var(--dsw-alias-label-secondary,#b9b9c0));',
  'border-color:var(--dpc-accent,var(--dsw-alias-separator,#2f2f35))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-cta{',
  'color:var(--dpc-accent,var(--dsw-alias-label-secondary,#b9b9c0));',
  'border-color:var(--dpc-accent,var(--dsw-alias-separator,#2f2f35))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-stat{border-radius:var(--dpc-radius,8px);',
  'background:var(--dpc-surface,var(--dsw-alias-fill-tertiary,#232327));',
  'border-color:var(--dpc-edge,var(--dsw-alias-separator,#2f2f35))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-statnum{color:var(--dpc-text,var(--dsw-alias-label-primary,#e9e9ec))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-statlab{color:var(--dpc-set-ink-2,var(--dsw-alias-label-secondary,#b9b9c0))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-q{border-radius:var(--dpc-radius,8px);',
  'color:var(--dpc-set-ink-2,var(--dsw-alias-label-secondary,#b9b9c0));',
  'background:var(--dpc-surface,var(--dsw-alias-fill-tertiary,#232327));',
  'border-color:var(--dpc-edge,var(--dsw-alias-separator,#2f2f35))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-helptext{color:var(--dpc-set-ink-3,var(--dsw-alias-label-tertiary,#8d8d95))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-slot{border-radius:var(--dpc-radius,8px);',
  'background:var(--dpc-surface,var(--dsw-alias-fill-tertiary,#232327));',
  'border-color:var(--dpc-edge,var(--dsw-alias-separator,#2f2f35))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-slot>b{color:var(--dpc-text,var(--dsw-alias-label-primary,#e9e9ec))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-slot-cap{color:var(--dpc-set-ink-3,var(--dsw-alias-label-tertiary,#8d8d95))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-search{border-radius:var(--dpc-radius,6px);',
  'color:var(--dpc-text,var(--dsw-alias-label-primary,#e9e9ec));',
  'background:var(--dpc-surface,var(--dsw-alias-fill-tertiary,#232327));',
  'border-color:var(--dpc-edge,var(--dsw-alias-separator,#2f2f35))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-pickcell{border-radius:var(--dpc-radius,8px);',
  'color:var(--dpc-set-ink-2,var(--dsw-alias-label-secondary,#b9b9c0));',
  'background:var(--dpc-surface,var(--dsw-alias-fill-tertiary,#232327));',
  'border-color:var(--dpc-edge,var(--dsw-alias-separator,#2f2f35))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-pickcell-on{',
  'color:var(--dpc-accent,var(--dsw-alias-label-secondary,#b9b9c0));',
  'border-color:var(--dpc-accent,var(--dsw-alias-separator,#2f2f35))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-pickcell>span{color:var(--dpc-set-ink-3,var(--dsw-alias-label-tertiary,#8d8d95))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-pick{border-radius:var(--dpc-radius,8px);',
  'background:var(--dpc-surface,var(--dsw-alias-fill-secondary,#1c1c20));',
  'border-color:var(--dpc-edge,var(--dsw-alias-separator,#2f2f35))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-set-filters{color:var(--dpc-set-ink-2,var(--dsw-alias-label-secondary,#b9b9c0))}',
  '.dpc-set-root[data-skin-active="1"] .dpc-gallery-sel{',
  'border-color:var(--dpc-accent,var(--dsw-alias-separator,#2f2f35))}',
].join('');

 
function dpcSetPanelSkin(el) {
  if (!el) return undefined;
  try {
    dpcPickerApplySkin(el, dpcPickerSkinAttrs());
    dpcPickerEnsureThemeWatch();
  } catch (_error) {   }
  return undefined;
}


 
const MISSING_NOTE_GENERIC = '通用卡未收录此项';
const MISSING_NOTE_CURATED = '公开基准未覆盖此项';

 
const NO_PUBLIC_SCORE = '暂无公开分数';

 
 
function statsFootline(n) {
  return '公开分数仅覆盖 ' + n + '/' + KEYS.length + ' 轴';
}

 
const SCORE_SOURCE_LEGEND = [
  [SRC.智力, dpcT('公开榜单')],
  [SRC.速度, dpcT('本机测得')],
  [SRC.上下文, dpcT('本机目录')],
].map((pair) => dpcT(pair[0]) + '＝' + pair[1]).join('，');

 
function dpcPickerScoreNote(card, stats) {
  if (!card) return '';
  const rows = Array.isArray(stats) ? stats : [];
  const parts = [];
  if (rows.length === 0) {
    parts.push(NO_PUBLIC_SCORE);
    parts.push(missingNoteOf(card));
  } else {
    const total = KEYS.length;
    const valued = rows.filter((row) => row && row.v != null).length;
    if (valued > 0 && valued < total) parts.push(dpcT(statsFootline(valued)));
    if (valued < total) parts.push(dpcT('缺项＝') + dpcT(missingNoteOf(card)));
  }
  
  
  
  
  const srcNote = scoreSrcNoteOf(card);
  if (srcNote && srcNote.text) parts.push(dpcT(srcNote.text));
  parts.push(dpcT(SCORE_SOURCE_LEGEND));
  return parts.join('；');
}

 
function missingNoteOf(card) {
  return card && card.generic === true ? MISSING_NOTE_GENERIC : MISSING_NOTE_CURATED;
}

 
const SCORE_SRC_NOTE = { manual: '人工评估 · 非公开基准' };

 
function scoreSrcNoteOf(card) {
  const src = card && card.scoreSource ? String(card.scoreSource) : '';
  if (!src || !Object.prototype.hasOwnProperty.call(SCORE_SRC_NOTE, src)) return null;
  return { src, text: SCORE_SRC_NOTE[src] };
}

 
function scoreSrcBadge(card) {
  const note = scoreSrcNoteOf(card);
  if (!note) return null;
  return h('div', { className: 'dpc-score-src', 'data-score-src': note.src }, note.text);
}

 
function dpcAxisHasValue(u, stat) {
  const statNull = !stat || stat.v == null;
  const unit = u || (statNull
    ? { status: 'missing', score: null }
    : { status: 'ok', score: stat.v });
  
  
  const missing = unit.status === 'missing' || (unit.status === 'ok' && unit.score == null);
  return !missing;
}

 
function dpcLocalStamp(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(iso == null ? '' : iso));
  return m ? m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] : '';
}

 
function dpcGeneratedText(iso, label) {
  const s = dpcLocalStamp(iso);
  return s ? label + ' ' + s : '生成时间未知';
}

 
function StatBar(props) {
  const { label, stat, src, start, calm, u, note = MISSING_NOTE_GENERIC } = props;
  const statNull = !stat || stat.v == null;
  
  
  
  const unit = u || (statNull
    ? { status: 'missing', score: null, text: missingMark(), raw: null, note }
    : { status: 'ok', score: stat.v, text: String(stat.v), raw: { value: stat.b, max: null }, note: '' });
  
  
  
  
  const missing = unit.status === 'missing' || (unit.status === 'ok' && unit.score == null);
  const separate = unit.status === 'separate';
  
  
  const notAValue = !dpcAxisHasValue(u, stat);
  
  const target = missing || separate ? 0 : Math.max(0, Math.min(100, Number(unit.score) || 0));
  const [shown, setShown] = React.useState(calm || !start ? target : 0);
  const [width, setWidth] = React.useState(calm || !start ? target : 0);
  React.useEffect(() => {
    if (calm || !start) { setShown(target); setWidth(target); return undefined; }
    let i = 0;
    const iv = setInterval(() => {
      i += 1;
      if (i >= 9) { clearInterval(iv); setShown(target); return; }
      setShown(Math.round(Math.random() * 100));
    }, 45);
    const raf = requestAnimationFrame(() => setWidth(target));
    return () => { clearInterval(iv); cancelAnimationFrame(raf); };
  }, [start, calm, target]);
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const dir = missing || separate || !stat ? 0 : stat.d === 0 ? 0 : stat.d > 0 ? 1 : -1;
  
  
  
  const title = (typeof unit.tooltip === 'string' && unit.tooltip !== '')
    ? unit.tooltip
    : scoreTooltip({
      label,
      status: unit.status,
      score: unit.score,
      raw: unit.raw,
      source_type: unit.source_type,
      caveat: unit.caveat,
      caliber: unit.caliber || unit.note,
    });
  return h('div', {
    className: 'dpc-stat',
    'data-stat': label,
    'data-status': missing ? 'missing' : unit.status,
    'data-unranked': missing ? '1' : '0',
    'data-elo': separate ? '1' : '0',
  },
    h('b', null, label),
    h('span', { className: 'dpc-stat-track' }, h('span', { className: 'dpc-stat-fill', style: { width: width + '%' } })),
    notAValue ? h('i', { className: 'dpc-stat-val', 'data-unranked': '1', 'data-noscore': '1', title: unit.note || MISSING_NOTE_CURATED }, missingMark())
      : separate ? h('i', { className: 'dpc-stat-val', 'data-elo': '1', title }, unit.text)
        : h('i', { className: 'dpc-stat-val', title }, String(shown)),
    dir !== 0 ? h('i', { className: 'dpc-stat-d', 'data-up': String(dir), title: dpcT('档位') + (stat.de > 0 ? '+' : '') + stat.de + dpcT(' · 时段') + (stat.dt > 0 ? '+' : '') + stat.dt + dpcT('（基准 ') + stat.b + dpcT('）') }, (dir > 0 ? '▲' : '▼') + Math.abs(stat.d)) : null,
    
    
    
    h('em', { className: 'dpc-stat-src', title: missing ? (unit.note || MISSING_NOTE_CURATED) : src },
      missing ? '' : src));
}

 
function Typewriter(props) {
  const { text, start, calm } = props;
  const [n, setN] = React.useState(calm || !start ? text.length : 0);
  React.useEffect(() => {
    if (calm) { setN(text.length); return undefined; }
    if (!start) { setN(0); return undefined; }
    const iv = setInterval(() => {
      setN((v) => {
        if (v >= text.length) { clearInterval(iv); return v; }
        return v + 1;
      });
    }, 18);
    return () => clearInterval(iv);
  }, [text, start, calm]);
  return h('div', { className: 'dpc-line' }, text.slice(0, n), n < text.length && !calm ? h('span', { className: 'dpc-cursor' }) : null);
}




































const PLAY_TOTAL_MAX_MS = 1200;
const SEEN_STORAGE_KEY = 'dsh-provider-card.seen.v1';
const SEEN_GLOBAL = '__DSH_PROVIDER_CARD_SEEN__';
const MEASURED_GLOBAL = '__DSH_PROVIDER_CARD_MEASURED__';
const QUOTAS_GLOBAL = '__DSH_PROVIDER_CARD_QUOTAS__';


const NOTIFY_GLOBAL = '__DSH_PROVIDER_CARD_NOTIFY__';

 
const MEASURED_KEYS = ['速度', '稳定', '性价比'];

const PLAY_TIMELINE = {
  full: [
    { phase: 'enter', at: 0, label: '入场' },
    { phase: 'cone', at: 200, label: '扫光' },
    { phase: 'panel', at: 480, label: '落板' },
    { phase: 'type', at: 720, label: '台词' },
  ],
  mini: [
    { phase: 'panel', at: 0, label: '小卡直出' },
    { phase: 'static', at: 90, label: '落定' },
  ],
};

 
let seenMemory = null;

 
function seenGlobalSeed() {
  try {
    const g = typeof window !== 'undefined' ? window[SEEN_GLOBAL] : null;
    if (g && typeof g === 'object' && g.seen && typeof g.seen === 'object') return g;
  } catch (_error) {   }
  return null;
}

 
function readSeenStore() {
  const seed = seenGlobalSeed();
  if (seed) return { set: normalizeSeen(seed), sink: seed };
  try {
    if (typeof localStorage !== 'undefined' && localStorage !== null) {
      const text = localStorage.getItem(SEEN_STORAGE_KEY);
      if (text) return { set: loadSeenJson(text), sink: null };
    }
  } catch (_error) {   }
  return { set: normalizeSeen(seenMemory || emptySeen()), sink: null };
}

 
function writeSeenStore(store) {
  const set = normalizeSeen(store && store.set);
  seenMemory = set;
  const sink = store && store.sink;
  if (sink && typeof sink === 'object') {
    try { sink.version = set.version; sink.seen = set.seen; } catch (_error) {   }
  }
  try {
    if (typeof localStorage !== 'undefined' && localStorage !== null) {
      localStorage.setItem(SEEN_STORAGE_KEY, saveSeenJson(set));
    }
  } catch (_error) {   }
  return set;
}

 
function rememberSeen(provider, model, nowMs) {
  const store = readSeenStore();
  return writeSeenStore({ set: markSeen(store.set, provider, model, nowMs), sink: store.sink });
}

 
function playModeOf(provider, model) {
  return resolvePlayMode(readSeenStore().set, provider, model);
}

 
function absorbServerSeen(payload) {
  const store = readSeenStore();
  if (!payload || typeof payload !== 'object') return store.set;
  const remote = payload.seen && typeof payload.seen === 'object' ? payload.seen : null;
  if (!remote || Object.keys(remote).length === 0) return store.set;
  const merged = mergeSeen(store.set, remote);
  if (!merged || !merged.seen || typeof merged.seen !== 'object') return store.set;
  
  
  if (saveSeenJson(merged) === saveSeenJson(store.set)) return store.set;
  return writeSeenStore({ set: merged, sink: store.sink });}

 
let seenPushPending = null;

function pushSeenToServer(provider, model) {
  if (!provider || !model) return Promise.resolve(null);
  seenPushPending = { provider, model };
  return flushSeenPush();
}

 
function flushSeenPush() {
  const p = seenPushPending;
  if (!p) return Promise.resolve(null);
  if (PC === null || !PC.urls || !PC.urls.measured) return Promise.resolve(null);
  return Promise.resolve(pcSend('POST', PC.urls.measured, null, { provider: p.provider, model: p.model }, null))
    .then((res) => {
      if (res && res.ok === true) {
        const cur = seenPushPending;
        if (cur && cur.provider === p.provider && cur.model === p.model) seenPushPending = null;
      }
      return res || null;
    })
    .catch(() => null);
}

 
function measuredItemsOf(provider, model) {
  let doc;
  try {
    doc = typeof window !== 'undefined' ? window[MEASURED_GLOBAL] : null;
  } catch (_error) {
    return null;
  }
  if (!doc || typeof doc !== 'object') return null;
  let items = doc.items && typeof doc.items === 'object' ? doc.items : null;
  if (!items) {
    const slot = doc[seenKey(provider, model)] || doc[(provider || '') + '/' + (model || '')];
    if (!slot || typeof slot !== 'object') return null;
    items = slot.items && typeof slot.items === 'object' ? slot.items : null;
  }
  return items || null;
}

 
let measuredFeed = null;

 
function measuredSeedDoc() {
  try {
    const m = typeof window !== 'undefined' ? window[MEASURED_GLOBAL] : null;
    return m && typeof m === 'object' ? m : null;
  } catch (_error) { return null; }
}

 
function measuredAxesOf(provider, model) {
  const key = (provider || '') + '/' + (model || '');
  const docs = measuredFeed ? [measuredFeed, measuredSeedDoc()] : [measuredSeedDoc()];
  for (const doc of docs) {
    if (!doc || typeof doc !== 'object') continue;
    const cards = doc.cards && typeof doc.cards === 'object' ? doc.cards : null;
    if (!cards) continue;
    const card = cards[key];
    const axes = card && typeof card === 'object' && card.axes && typeof card.axes === 'object' ? card.axes : null;
    if (axes) return axes;
  }
  return null;
}

 
function pumpMeasuredFeed(provider, model) {
  if (PC === null || !PC.urls || !PC.urls.measured) return Promise.resolve(null);
  return pcGetJson(PC.urls.measured, { provider, model }).then((j) => {
    if (!j || j.ok !== true || !j.cards || typeof j.cards !== 'object') return null;
    measuredFeed = j;
    
    
    absorbServerSeen(j);
    return j;
  }).catch(() => null);
}

 
function axisOf(card, effort, now, provider, model) {
  
  
  
  const base = statsOf(card, effort, now, provider);
  
  const axes = measuredAxesOf(provider, model);
  
  const items = axes ? null : measuredItemsOf(provider, model);
  const out = {};
  for (const k of KEYS) {
    if (MEASURED_KEYS.indexOf(k) < 0) { out[k] = null; continue; }
    const ax = axes ? axes[k] : null;
    if (ax && typeof ax === 'object' && typeof ax.status === 'string') { out[k] = ax; continue; }
    const item = items ? items[k] : null;
    
    out[k] = item ? uniformScore(item) : { status: 'missing', score: null, raw: null, text: missingMark(), note: '暂无实测' };
  }
  return { stats: base, axis: out };
}

 
let quotaFeed = null;

 
function quotaSeedDoc() {
  try {
    const q = typeof window !== 'undefined' ? window[QUOTAS_GLOBAL] : null;
    const n = typeof window !== 'undefined' ? window[NOTIFY_GLOBAL] : null;
    if (!q && !n) return null;
    return { quota: q || null, notify: n || null };
  } catch (_error) {
    return null;
  }
}


 
function rowsForSelection(doc, provider, model) {
  if (!doc || !Array.isArray(doc.rows)) return null;
  const sel = doc.selected;
  if (!sel || sel.route == null) return null;
  if (sel.provider != null && String(sel.provider) !== String(provider)) return null;
  if (sel.model != null && String(sel.model) !== String(model)) return null;
  const rows = doc.rows.filter((r) => r && r.route === sel.route);
  return rows.length ? rows : null;
}

 
function liveFromRows(doc, provider, model, nowMs) {
  const rows = rowsForSelection(doc, provider, model);
  if (!rows) return null;
  const windows = [];
  let worst = 'ok';
  
  let balance = null;
  let peak = null;
  for (const r of rows) {
    if (balance === null && typeof r.balance_cny === 'number' && Number.isFinite(r.balance_cny)) balance = r.balance_cny;
    if (!peak && typeof r.peak === 'string' && r.peak) peak = r.peak;
    
    
    
    if (r.state === '陈旧' || r.state === 'stale' || r.state === '过期') worst = '陈旧';
    else if (r.state === '降级' || r.state === 'degraded') worst = (worst === '陈旧' ? '陈旧' : '降级');
    
    
    
    
    let used = r.used === null || r.used === undefined ? NaN : Number(r.used);
    if (!Number.isFinite(used)) {
      const rem = r.remaining_fraction;
      used = typeof rem === 'number' && Number.isFinite(rem) ? (1 - rem) * 100 : NaN;
    }
    if (!Number.isFinite(used)) continue;
    let reset = null;
    const t = r.reset_at ? Date.parse(r.reset_at) : NaN;
    if (Number.isFinite(t) && Number.isFinite(nowMs)) reset = Math.round((t - nowMs) / 60000);
    windows.push({ k: r.windowLabel, used: Math.round(Math.max(0, Math.min(100, used))), reset });
  }
  
  
  
  const validUntilOut = doc.valid_until || rows[0].valid_until || '';
  if (quotaIsStale(worst, validUntilOut, nowMs)) worst = '陈旧';
  if (!windows.length) {
    
    
    return {
      unknown: true,
      state: worst,
      balance,
      peak,
      observed_at: doc.observed_at || rows[0].observed_at || '',
      valid_until: validUntilOut,
      source: rows[0].source || '',
      levels: rows.map((r) => r.level).filter(Boolean),
    };
  }
  return {
    windows,
    
    state: worst,
    observed_at: doc.observed_at || rows[0].observed_at || '',
    valid_until: validUntilOut,
    source: rows[0].source || '',
    levels: rows.map((r) => r.level).filter(Boolean),
    balance,
    peak,
  };
}


 
function pumpQuotaFeed(provider, model) {
  if (PC === null || !PC.urls || !PC.urls.quotas) return Promise.resolve(null);
  return pcGetJson(PC.urls.quotas, { provider, model }).then((j) => {
    if (!j || j.ok !== true || !Array.isArray(j.rows)) return null;
    quotaFeed = j;
    return j;
  }).catch(() => null);
}

 
function quotaLiveOf(provider, model, nowMs) {
  const fromHttp = liveFromRows(quotaFeed, provider, model, nowMs);
  if (fromHttp) return fromHttp;
  
  
  
  
  
  if (quotaFeed && quotaFeed.selected) return { unknown: true };
  const seed = quotaSeedDoc();
  const doc = seed ? seed.quota : null;
  try {
    if (!doc || typeof doc !== 'object') return null;
    if (doc.windows || doc.pack || doc.unknown) return doc;
    const slot = doc[seenKey(provider, model)] || doc[(provider || '') + '/' + (model || '')];
    return slot && typeof slot === 'object' && (slot.windows || slot.pack || slot.unknown) ? slot : null;
  } catch (_error) {
    return null;
  }
}









 
const QUOTA_STALE_STATES = ['陈旧', '过期', 'stale', 'expired'];


















const QUOTA_STATE_TEXT = Object.freeze({
  ok: '',
  降级: '数据不可用',
  陈旧: '数据已过期',
});

 
function quotaStateText(state) {
  const s = typeof state === 'string' ? state : '';
  return Object.prototype.hasOwnProperty.call(QUOTA_STATE_TEXT, s) ? QUOTA_STATE_TEXT[s] : '';
}

 
function quotaIsStale(state, validUntil, nowMs) {
  
  
  if (QUOTA_STALE_STATES.indexOf(state) >= 0) return true;
  if (!validUntil || !Number.isFinite(nowMs)) return false;
  const t = Date.parse(validUntil);
  return Number.isFinite(t) && t <= nowMs;
}


 
const QUOTA_LAMP_STATES = {
  ok: { token: '--dpc-quota-ok', label: '额度充足' },
  warn: { token: '--dpc-quota-warn', label: '额度不足' },
  critical: { token: '--dpc-quota-critical', label: '额度耗尽' },
  na: { token: '--dpc-quota-na', label: '额度未知' },
};

 
function quotaLampState(provider, model, nowMs) {
  const live = quotaLiveOf(provider, model, nowMs);
  if (!live || typeof live !== 'object') return 'na';
  
  if (live.unknown) return 'na';
  
  if (quotaIsStale(live.state, live.valid_until, nowMs)) return 'na';
  
  const BY_WORD = {
    ok: 'ok',
    warn: 'warn',
    urgent: 'warn',
    critical: 'critical',
    exhausted: 'critical',
    fail: 'critical',
    unknown: 'na',
    na: 'na',
    降级: 'na',
    陈旧: 'na',
    过期: 'na',
    degraded: 'na',
    stale: 'na',
    expired: 'na',
  };
  const ORDER = { na: 0, ok: 1, warn: 2, critical: 3 };
  const words = [live.state].concat(Array.isArray(live.levels) ? live.levels : []);
  let out = null;
  let best = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i] == null ? '' : String(words[i]);
    if (!Object.prototype.hasOwnProperty.call(BY_WORD, w)) continue;
    const st = BY_WORD[w];
    if (st === 'na') return 'na';
    if (ORDER[st] > best) {
      best = ORDER[st];
      out = st;
    }
  }
  return out === null ? 'na' : out;
}


 
function pad2(n) {
  const v = Math.floor(Number(n) || 0);
  return (v < 10 ? '0' : '') + v;
}

 
function quotaAgoText(observedAt, nowMs) {
  if (typeof observedAt !== 'string' || !observedAt) return '';
  const t = Date.parse(observedAt);
  const now = nowMs instanceof Date ? nowMs.getTime() : nowMs;
  if (!Number.isFinite(t) || !Number.isFinite(now)) return '';
  const diff = Math.max(0, now - t);
  const d = new Date(t);
  const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' 分钟前';
  const today = new Date(now);
  const sameDay = d.getFullYear() === today.getFullYear()
    && d.getMonth() === today.getMonth()
    && d.getDate() === today.getDate();
  if (sameDay) return '今天 ' + hm;
  if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + ' 小时前';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const isYesterday = d.getFullYear() === y.getFullYear()
    && d.getMonth() === y.getMonth()
    && d.getDate() === y.getDate();
  if (isYesterday) return '昨天 ' + hm;
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
}

 
function quotaBalanceRow(live) {
  if (!live || typeof live !== 'object') return null;
  const b = live.balance;
  if (typeof b !== 'number' || !Number.isFinite(b)) return null;
  return { lbl: '额度 · 余额', balance: b, text: '¥' + b.toFixed(2) };
}

 
function quotaPeakLine(live) {
  if (!live || typeof live !== 'object') return null;
  if (live.peak === 'peak') return { tag: '高峰', fact: '官方全价' };
  if (live.peak === 'off') return { tag: '低谷', fact: '官方半价' };
  return null;
}

 
function quotaRowLabel(lbl) {
  const s = lbl === null || lbl === undefined ? '' : String(lbl);
  if (!s) return '额度';
  return s === '额度' ? '额度' : '额度 · ' + s;
}


 
const BUBBLE_FALLBACK_MS = 12000;

 
const NOTIFY_POLL_MS = 2000;

 

function quotaStamp(live, nowMs) {
  if (!live || typeof live !== 'object') return null;
  const state = typeof live.state === 'string' ? live.state : '';
  const validUntil = typeof live.valid_until === 'string' ? live.valid_until
    : (typeof live.validUntil === 'string' ? live.validUntil : '');
  const observedAt = typeof live.observed_at === 'string' ? live.observed_at
    : (typeof live.observedAt === 'string' ? live.observedAt : '');
  const source = typeof live.source === 'string' ? live.source : '';
  if (!state && !validUntil && !observedAt && !source) return null;
  
  
  const nowMsNum = nowMs instanceof Date ? nowMs.getTime() : nowMs;
  
  
  
  const stale = quotaIsStale(state, validUntil, nowMsNum);
  
  
  
  const effState = stale ? '陈旧' : state;
  
  
  
  
  
  const metered = typeof live.balance === 'number' && Number.isFinite(live.balance);
  const shown = metered && effState === '降级' ? '' : effState;
  const stateText = quotaStateText(shown);
  const agoText = quotaAgoText(observedAt, nowMsNum);
  const text = [stateText, agoText].filter(Boolean).join(' · ') || '已接入';
  return { stale, state: effState, text, observedAt, validUntil, source };
}


 
function notifyListOf() {
  try {
    
    
    const fromHttp = quotaFeed && Array.isArray(quotaFeed.notifications) ? quotaFeed.notifications : null;
    const seed = quotaSeedDoc();
    const doc = fromHttp || (seed ? seed.notify : null);
    if (!doc) return [];
    const raw = Array.isArray(doc) ? doc
      : (Array.isArray(doc.notifications) ? doc.notifications
        : (Array.isArray(doc.items) ? doc.items : null));
    if (!raw) return [];
    const out = [];
    for (const n of raw) {
      if (!n || typeof n !== 'object') continue;
      const id = typeof n.id === 'string' ? n.id : (n.id == null ? '' : String(n.id));
      const line = typeof n.line === 'string' ? n.line : '';
      if (!id || !line) continue;              
      out.push({
        id,
        line,
        kind: typeof n.kind === 'string' ? n.kind : 'urgent',
        display: typeof n.display === 'string' ? n.display : '',
        routes: Array.isArray(n.routes) ? n.routes.length : 0,
        autoCloseMs: Number.isFinite(n.autoCloseMs) && n.autoCloseMs > 0 ? n.autoCloseMs : BUBBLE_FALLBACK_MS,
      });
    }
    return out;
  } catch (_error) {
    return [];
  }
}

 
const CG_SLOT_FALLBACK = 'summon';
const CG_SLOT_VALUES = ['warning', 'recover', 'summon'];

 
function cgSlotOf(provider, model) {
  try {
    const cg = quotaFeed == null ? null : quotaFeed.selected_cg;
    const slot = cg && typeof cg === 'object' ? cg.slot : null;
    return CG_SLOT_VALUES.indexOf(slot) >= 0 ? slot : CG_SLOT_FALLBACK;
  } catch (_error) {
    return CG_SLOT_FALLBACK;
  }
}

 
const consumedNotifyIds = new Set();
 
function consumeNotifyOnce(list) {
  const fresh = [];
  for (const n of list) {
    if (consumedNotifyIds.has(n.id)) continue;
    consumedNotifyIds.add(n.id);
    fresh.push(n);
  }
  return fresh;
}

 
async function dpcHoverCgPlan(provider, model) {
  try {
    const slot = cgSlotOf(provider, model);
    const raw = await pcResolve(provider, model, slot, 'hud');
    if (!raw) return null;
    const plan = cgPlanForCalm(raw, motionIsCalm());
    if (!plan) return null;
    const src = pcMediaUrl(plan.assetId);
    if (!src) return null;
    const cutoutSrc = plan.cutoutAssetId ? pcMediaUrl(plan.cutoutAssetId) : null;
    return {
      kind: plan.kind === 'video' ? 'video' : 'image',
      src: src,
      poster: plan.posterAssetId ? pcMediaUrl(plan.posterAssetId) : null,
      cutoutSrc: cutoutSrc,
      cutoutKind: cutoutSrc ? (plan.cutoutKind === 'video' ? 'video' : 'image') : null,
      loop: plan.loop !== false,
      muted: plan.muted !== false,
      fit: plan.fit === 'cover' ? 'cover' : 'contain',
      objectPosition: typeof plan.objectPosition === 'string' && plan.objectPosition !== ''
        ? plan.objectPosition
        : 'center top',
    };
  } catch (_error) { return null; }
}























const PC_EMBED = {"urls":{"upload":"/api/dsh-provider-card/assets/upload","media":"/api/dsh-provider-card/assets/media","config":"/api/dsh-provider-card/config","bindings":"/api/dsh-provider-card/assets/bindings","package":"/api/dsh-provider-card/package","skinAdapter":"/api/dsh-provider-card/skin-adapter","quotas":"/api/dsh-provider-card/quotas","measured":"/api/dsh-provider-card/measured","persona":"/api/dsh-provider-card/persona"},"slots":["idle","summon","warning","recover"],"variants":["hud","full"],"kinds":["image","video"]};
const PC = (typeof window !== 'undefined' && window.__DSH_PROVIDER_CARD__) || PC_EMBED || null;





const skinAdapters = new Map();






const SKIN_ADAPTER_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,127}$/;
const SKIN_ADAPTER_PRIORITY_MIN = -100;
const SKIN_ADAPTER_PRIORITY_MAX = 100;

 
function skinMetaOf(adapter) {
  return {
    id: adapter && adapter.id,
    priority: typeof (adapter && adapter.priority) === 'number' ? adapter.priority : 0,
    active: (() => {
      if (!adapter || typeof adapter.isActive !== 'function') return false;
      try { return adapter.isActive() === true; } catch (_error) { return false; }
    })(),
    source: typeof (adapter && adapter.source) === 'string' ? adapter.source : 'external',
    tested: !!(adapter && adapter.tested),
  };
}


 
let dpcSkinRepaintSubscribers = [];

 
function dpcSkinOnRegistryChanged(fn) {
  if (typeof fn !== 'function') return () => {};
  dpcSkinRepaintSubscribers.push(fn);
  return () => {
    dpcSkinRepaintSubscribers = dpcSkinRepaintSubscribers.filter((one) => one !== fn);
  };
}

 
function dpcSkinRepaintConsumers() {
  const subs = dpcSkinRepaintSubscribers.slice();
  for (let i = 0; i < subs.length; i += 1) {
    try { subs[i](); } catch (_error) {   }
  }
  try { dpcPickerRepaintMounted(); } catch (_error) {   }
  return subs.length;
}


 
async function registerSkinAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object' || Array.isArray(adapter)) {
    return { ok: false, error: 'bad-adapter' };
  }
  if (typeof adapter.id !== 'string' || !SKIN_ADAPTER_ID_RE.test(adapter.id)) {
    return { ok: false, error: 'bad-id' };
  }
  if (typeof adapter.isActive !== 'function') {
    return { ok: false, error: 'bad-adapter' };
  }
  const priority = adapter.priority === undefined ? 0 : adapter.priority;
  if (typeof priority !== 'number' || !Number.isInteger(priority)
    || priority < SKIN_ADAPTER_PRIORITY_MIN || priority > SKIN_ADAPTER_PRIORITY_MAX) {
    return { ok: false, error: 'bad-priority' };
  }
  skinAdapters.set(adapter.id, adapter);
  dpcSkinRepaintConsumers();
  if (PC && PC.urls && PC.urls.skinAdapter) {
    await pcSend('POST', PC.urls.skinAdapter, null, skinMetaOf(adapter));
  }
  return { ok: true, id: adapter.id };
}

 
async function unregisterSkinAdapter(id) {
  if (typeof id !== 'string' || id === '') return { ok: false, error: 'bad-id' };
  const existed = skinAdapters.has(id);
  const prev = skinAdapters.get(id);
  if (prev !== null && prev !== undefined && typeof prev.dispose === 'function') {
    try { prev.dispose(); } catch (_error) {   }
  }
  skinAdapters.delete(id);
  dpcSkinRepaintConsumers();
  if (PC && PC.urls && PC.urls.skinAdapter) {
    await pcSend('DELETE', PC.urls.skinAdapter, { id }, null, null);
  }
  return { ok: true, removed: existed, id };
}

 
function skinAdapterEntries() {
  return Array.from(skinAdapters.values());
}

 
function listSkinAdapters() {
  return skinAdapterEntries().map((adapter) => skinMetaOf(adapter));
}

 

 
const DPC_DSW_ALIAS_TOKENS = Object.freeze([
  ['surface', '--dsw-alias-bg-layer-1'],
  ['text', '--dsw-alias-label-primary'],
  ['accent', '--dsw-alias-brand-primary'],
  ['border', '--dsw-alias-border-l1'],
]);

 
function dpcDswSkinKind() {
  const root = document.documentElement;
  const body = document.body;
  const htmlSkin = String((root && typeof root.getAttribute === 'function' ? root.getAttribute('data-dsh-skin') : '') || '').trim();
  const hasRootAttr = (name) => !!(root && typeof root.hasAttribute === 'function' && root.hasAttribute(name));
  const hasBodyAttr = (name) => !!(body && typeof body.hasAttribute === 'function' && body.hasAttribute(name));

  
  if (htmlSkin && (htmlSkin === 'deep-whale-day-night' || /whale/i.test(htmlSkin))) return 'deep-whale';

  
  if (htmlSkin === 'blue-fantasy' || hasBodyAttr('data-dsh-skin-center')) return 'skin-center';

  
  if (!htmlSkin && (hasRootAttr('data-dsh-dream-skin-scheme') || hasBodyAttr('data-ds-dark-theme')) && hasRootAttr('data-dsh-material')) {
    return 'dsh-dream-skin';
  }

  
  if (!htmlSkin && hasBodyAttr('data-dsh-maid-atelier')) return 'maid-atelier';

  return null;
}

 
function builtinDswGenericAdapter() {
  return {
    apiVersion: 1,
    id: 'builtin:dsw-generic',
    priority: 100,
    source: 'builtin',
    tested: false,
    isActive() {
      return dpcDswSkinKind() !== null;
    },
    resolveAnchor(_sessionId) {
      
      return null;
    },
    getTokens() {
      const kind = dpcDswSkinKind();
      if (kind === 'deep-whale') {
        
        
        return {};
      }
      if (kind === 'maid-atelier') {
        
        if (!document.body) return {};
        const s = getComputedStyle(document.body);
        const out = {};
        for (const [key, cssVar] of DPC_DSW_ALIAS_TOKENS) {
          const v = String(s.getPropertyValue(cssVar) || '').trim();
          out[key] = v || undefined;
        }
        
        return out;
      }
      if (kind === 'dsh-dream-skin' || kind === 'skin-center') {
        
        return {};
      }
      return {};
    },
    getAvoidRects() { return []; },
    dispose() {},
  };
}

 
function pcUrl(relPath) {
  if (relPath === null || relPath === undefined || relPath === '') return null;
  let p = String(relPath);
  if (p.indexOf('http://') === 0 || p.indexOf('https://') === 0) return p;
  try {
    return new URL(p.startsWith('/') ? p.slice(1) : p, document.baseURI).href;
  } catch (_error) { return null; }
}

 
const DPC_GET_MEMO_MS = 1000;
 
const pcGetMemo = new Map();

 
const DPC_GET_MEMO_MAX = 64;

 
async function pcGetJsonOnce(url) {
  try {
    const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.ok === true ? j : null;
  } catch (_error) { return null; }
}

 
function pcGetJsonUrl(url) {
  const now = Date.now();
  const hit = pcGetMemo.get(url);
  if (hit !== undefined && (now - hit.atMs) < DPC_GET_MEMO_MS) return hit.promise;
  const promise = pcGetJsonOnce(url);
  pcGetMemo.set(url, { atMs: now, promise });
  if (pcGetMemo.size > DPC_GET_MEMO_MAX) {
    for (const [k, v] of pcGetMemo) {
      if ((now - v.atMs) >= DPC_GET_MEMO_MS) pcGetMemo.delete(k);
      if (pcGetMemo.size <= DPC_GET_MEMO_MAX) break;
    }
    
    
    for (const k of Array.from(pcGetMemo.keys())) {
      if (pcGetMemo.size <= DPC_GET_MEMO_MAX) break;
      pcGetMemo.delete(k);
    }
  }
  return promise;
}

 
function pcInvalidateGet(relPath) {
  const base = pcUrl(relPath);
  if (base !== null) pcGetMemo.delete(base);
}

 
async function pcGetJson(relPath, query) {
  if (PC === null) return null;
  const base = pcUrl(relPath);
  if (base === null) return null;
  let url = base;
  if (query) {
    const qs = new URLSearchParams();
    for (const k of Object.keys(query)) {
      const v = query[k];
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s !== '') url = `${base}?${s}`;
  }
  return pcGetJsonUrl(url);
}

 
async function pcResolve(provider, model, slot, variant) {
  const j = await pcGetJson(PC.urls.bindings, { resolve: 1, provider, model, slot, variant });
  if (j === null || j.plan === null || j.plan === undefined) return null;
  if (j.plan.kind !== 'image' && j.plan.kind !== 'video') return null;
  return j.plan;
}

 
function pcMediaUrl(assetId) {
  if (PC === null || !PC.urls || !PC.urls.media) return null;
  const base = pcUrl(PC.urls.media);
  if (base === null) return null;
  const id = String(assetId || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return `${base}?assetId=${id}`;
}

 
const DPC_SPLIT_ART_RATIO = 0.4;
const DPC_SPLIT_ART_MIN = 160;
const DPC_SPLIT_TEXT_MIN = 200;
const DPC_SPLIT_MIN_W = 380;
 
const DPC_SPLIT_COL_GAP = 4;
 
const DPC_SPLIT_ART_PAD_TOP = 6;
const DPC_SPLIT_ART_PAD_BOTTOM = 2;

 
function dpcSplitArtWidth(w) {
  const total = Number(w);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(
    Math.max(Math.round(total * DPC_SPLIT_ART_RATIO), DPC_SPLIT_ART_MIN),
    Math.max(0, Math.round(total) - DPC_SPLIT_TEXT_MIN),
  );
}

 
function cgPlanForCalm(plan, calm) {
  if (!calm || !plan) return plan;
  if (plan.cutoutKind === 'video') {
    const still = plan.cutoutStillAssetId ? plan.cutoutStillAssetId : null;
    return { ...plan, cutoutAssetId: still, cutoutKind: still ? 'image' : null, cutoutStillAssetId: null };
  }
  return plan.posterAssetId
    ? { ...plan, kind: 'image', assetId: plan.posterAssetId, cutoutAssetId: null }
    : null;
}

 
function cgPlanForFallbackAnchor(plan) {
  if (!plan) return plan;
  if (plan.kind === 'image' && plan.cutoutAssetId) return plan;
  if (plan.objectPosition !== 'center') return plan;
  return { ...plan, objectPosition: 'center top' };
}
















const DPC_VIDEO_OBSERVER_OPTS = { threshold: [0, 0.01] };

 
function dpcVideoShouldPlay(el) {
  if (!el) return false;
  if (typeof document !== 'undefined' && document.hidden) return false;
  const st = el.__dpcVideoVis;
  if (st && st.visible === false) return false;
  return true;
}

 
function dpcVideoSync(el) {
  if (!el) return;
  try {
    if (dpcVideoShouldPlay(el)) {
      if (el.paused && typeof el.play === 'function') { const r = el.play(); if (r && r.catch) r.catch(() => {}); }
    } else if (!el.paused && typeof el.pause === 'function') {
      el.pause();
    }
  } catch (_error) {   }
}

 
function dpcWatchVideo(el) {
  if (!el) return () => {};
  if (el.__dpcVideoVis && el.__dpcVideoVisOff) el.__dpcVideoVisOff();
  const state = { visible: true, io: null };
  el.__dpcVideoVis = state;
  const sync = () => dpcVideoSync(el);
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', sync);
  }
  if (typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver((entries) => {
      const list = Array.isArray(entries) ? entries : [entries];
      for (const entry of list) {
        if (entry && typeof entry.isIntersecting === 'boolean') state.visible = entry.isIntersecting;
      }
      sync();
    }, DPC_VIDEO_OBSERVER_OPTS);
    if (io && typeof io.observe === 'function') io.observe(el);
    state.io = io;
  }
  state.off = () => {
    if (typeof document !== 'undefined' && document.removeEventListener) {
      document.removeEventListener('visibilitychange', sync);
    }
    if (state.io && typeof state.io.disconnect === 'function') state.io.disconnect();
    el.__dpcVideoVis = null;
    el.__dpcVideoVisOff = null;
  };
  el.__dpcVideoVisOff = state.off;
  sync();
  return state.off;
}

 
function CgLayer(props) {
  const { plan, splitArt, artW, cardId, form } = props;
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const DPC_CARD_FRAMING = {};
  const src = React.useMemo(() => (plan ? pcMediaUrl(plan.assetId) : null), [plan]);
  const poster = React.useMemo(
    () => (plan && plan.posterAssetId ? pcMediaUrl(plan.posterAssetId) : null),
    [plan],
  );
  
  const cutoutSrc = React.useMemo(
    () => (plan && plan.cutoutAssetId ? pcMediaUrl(plan.cutoutAssetId) : null),
    [plan],
  );
  
  
  
  const videoRef = React.useRef(null);
  React.useEffect(() => {
    const el = videoRef.current;
    if (el === null) return undefined;
    return dpcWatchVideo(el);
  }, [src, cutoutSrc]);
  if (plan === null || src === null) return null;
  
  const cutout = plan.kind === 'image' && cutoutSrc !== null;
  
  
  
  const cutoutVideo = cutout && plan.cutoutKind === 'video';
  
  
  
  
  const split = splitArt === true && Number(artW) > 0;
  const style = split
    ? {
      position: 'absolute',
      inset: DPC_SPLIT_ART_PAD_TOP + 'px 0 ' + DPC_SPLIT_ART_PAD_BOTTOM + 'px auto',
      width: artW + 'px',
      height: 'calc(100% - ' + (DPC_SPLIT_ART_PAD_TOP + DPC_SPLIT_ART_PAD_BOTTOM) + 'px)',
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      objectFit: 'cover',
      objectPosition: '60% 50%',
      pointerEvents: 'none',
      borderRadius: 9,
    }
    : Object.assign({
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: plan.fit === 'contain' ? 'contain' : 'cover',
      objectPosition: typeof plan.objectPosition === 'string' && plan.objectPosition !== '' ? plan.objectPosition : 'center',
      pointerEvents: 'none',
      borderRadius: 9,
    },
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    cutout
      ? { inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center top' }
      : null);
  
  
  
  const framingForm = split ? 'split' : (form === 'mini' ? 'mini' : null);
  const framingEntry = framingForm !== null && cardId !== undefined && cardId !== null
    ? (DPC_CARD_FRAMING[String(cardId)] || null)
    : null;
  
  
  const framing = framingEntry !== null && Object.prototype.hasOwnProperty.call(framingEntry, framingForm)
    ? framingEntry[framingForm]
    : null;
  
  
  const layerStyle = framing === null ? style : Object.assign({}, style, {
    transform: 'translate(' + (framing.dx || '0%') + ', ' + (framing.dy || '0%') + ') scale(' + framing.scale + ')',
  });
  
  
  if (plan.kind === 'video') {
    return h('video', {
      key: src,
      className: 'dpc-cg-layer',
      src,
      poster: poster || undefined,
      style: layerStyle,
      autoPlay: true,
      loop: plan.loop !== false,
      muted: plan.muted !== false,
      playsInline: true,
      ref: videoRef,
      'aria-hidden': 'true',
    });
  }
  
  
  
  const cgScrim = (el) => {
    if (split) return el;
    return h(React.Fragment, null, el,
      h('div', { key: 'cg-scrim', className: 'dpc-cg-scrim', 'aria-hidden': 'true' }));
  };
  
  
  if (cutoutVideo) {
    return cgScrim(h('video', {
      key: cutoutSrc,
      className: 'dpc-cg-layer',
      src: cutoutSrc,
      style: layerStyle,
      autoPlay: true,
      loop: true,
      muted: true,
      playsInline: true,
      'data-cutout': '1',
      'data-cutout-kind': 'video',
      ref: videoRef,
      'aria-hidden': 'true',
    }));
  }
  const img = h('img', {
    key: cutout ? cutoutSrc : src,
    className: 'dpc-cg-layer',
    src: cutout ? cutoutSrc : src,
    'data-cutout': cutout ? '1' : null,
    style: layerStyle,
    alt: '',
    'aria-hidden': 'true',
  });
  
  
  if (!cutout) return img;
  
  
  
  return cgScrim(img);
}


 
const cgWatchers = new Set();
function cgBump() {
  for (const fn of Array.from(cgWatchers)) {
    try { fn(); } catch (_error) {   }
  }
}





const cooldownListeners = new Set();
function setCooldownMs(ms) {
  const v = Number(ms);
  if (!Number.isFinite(v) || v <= 0) return;
  for (const fn of Array.from(cooldownListeners)) {
    try { fn(v); } catch (_error) {   }
  }
}






const HUD_LAYOUT_MINI = 'mini';
const HUD_LAYOUT_CARD = 'card';

const HUD_LAYOUT_TEXT = {
  mini: '竖版小窗（挂在模型选择器旁）',
  card: '完整卡片（输入框上方）',
};
function hudLayoutLabel(v) {
  return HUD_LAYOUT_TEXT[v === HUD_LAYOUT_CARD ? HUD_LAYOUT_CARD : HUD_LAYOUT_MINI];
}
const hudLayoutListeners = new Set();
let hudLayoutValue = HUD_LAYOUT_MINI;
 
function setHudLayout(v) {
  const s = v === HUD_LAYOUT_CARD ? HUD_LAYOUT_CARD : HUD_LAYOUT_MINI;
  if (s === hudLayoutValue) return;
  hudLayoutValue = s;
  for (const fn of Array.from(hudLayoutListeners)) {
    try { fn(s); } catch (_error) {   }
  }
}
function currentHudLayout() { return hudLayoutValue; }
 
function useHudLayout() {
  const [v, setV] = React.useState(hudLayoutValue);
  React.useEffect(() => {
    const apply = (x) => setV(x);
    hudLayoutListeners.add(apply);
    if (PC && PC.urls && PC.urls.config) {
      pcGetJson(PC.urls.config, null).then((j) => {
        if (j && j.config && j.config.hudLayout) setHudLayout(j.config.hudLayout);
      });
    }
    return () => { hudLayoutListeners.delete(apply); };
  }, []);
  return v;
}
function useCgRevision() {
  const [rev, bump] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    cgWatchers.add(bump);
    return () => { cgWatchers.delete(bump); };
  }, []);
  return rev;
}

 
function pcQueryStr(query) {
  if (!query) return '';
  const qs = new URLSearchParams();
  for (const k of Object.keys(query)) {
    const v = query[k];
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  return qs.toString();
}

 
async function pcSend(method, relPath, query, body, raw) {
  const base = pcUrl(relPath);
  
  
  
  pcInvalidateGet(relPath);
  if (base === null) return { ok: false, status: 0, json: null, error: dpcT('插件后台未就绪，该功能暂时不可用') };
  const qs = pcQueryStr(query);
  const url = qs === '' ? base : `${base}?${qs}`;
  const init = { method, credentials: 'same-origin', cache: 'no-store' };
  if (raw !== undefined && raw !== null) init.body = raw;
  else if (body !== undefined && body !== null) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  let r;
  try {
    r = await fetch(url, init);
  } catch (e) {
    return { ok: false, status: 0, json: null, error: dpcT('网络失败：') + String((e && e.message) || e) };
  }
  let json = null;
  try { json = await r.json(); } catch (_error) { json = null; }
  return { ok: r.ok, status: r.status, json, error: null };
}

 
function pcFailText(res) {
  if (res.error) return res.error;
  const j = res.json || {};
  const bits = ['HTTP ' + res.status];
  if (j.reason) bits.push(String(j.reason));
  if (j.detail) bits.push(String(j.detail));
  if (Array.isArray(j.refs) && j.refs.length > 0) bits.push(dpcT('被引用中：') + j.refs.join('、') + dpcT('（先清这些绑定再删素材）'));
  if (j.limitBytes) bits.push(dpcT('上限 ') + Math.round(j.limitBytes / 1048576) + ' MiB');
  if (j.usedBytes) bits.push(dpcT('已用 ') + Math.round(j.usedBytes / 1048576) + ' MiB');
  if (res.status === 401) bits.push(dpcT('登录态失效，刷新页面重试'));
  return bits.join(' · ');
}

 
function useCgPlan(provider, model, enabled, variant, slot) {
  const [plan, setPlan] = React.useState(null);
  const rev = useCgRevision();
  React.useEffect(() => {
    if (!enabled) { setPlan(null); return undefined; }
    let alive = true;
    setPlan(null);
    pcResolve(provider, model, slot || 'idle', variant || null).then((p) => { if (alive) setPlan(p); });
    return () => { alive = false; };
  }, [provider, model, enabled, variant, slot, rev]);
  return plan;
}








const SKIN_TOKEN_VARS = ['surface', 'text', 'accent', 'border', 'radius', 'opacity', 'density'];

const SKIN_AVOID_GAP = 8;

 
function isBuiltinSkinAdapter(adapter) {
  return String((adapter && adapter.source) || '') === 'builtin';
}

 
function skinAdapterWins(a, b) {
  if (b === null || b === undefined) return true;
  const pa = Number(a && a.priority) || 0;
  const pb = Number(b && b.priority) || 0;
  if (pa !== pb) return pa < pb;
  return isBuiltinSkinAdapter(a) === false && isBuiltinSkinAdapter(b) === true;
}

 
function activeSkinAdapter() {
  let best = null;
  for (const a of skinAdapterEntries()) {
    if (a === null || a === undefined || typeof a.isActive !== 'function') continue;
    let on = false;
    try { on = a.isActive() === true; } catch (_error) { continue; }
    if (!on) continue;
    if (skinAdapterWins(a, best)) best = a;
  }
  return best;
}

 
function skinTokensOf(adapter) {
  const out = {};
  if (adapter === null || adapter === undefined || typeof adapter.getTokens !== 'function') return out;
  let tokens = null;
  try { tokens = adapter.getTokens(); } catch (_error) { return out; }
  if (tokens === null || typeof tokens !== 'object') return out;
  for (const k of SKIN_TOKEN_VARS) {
    const v = tokens[k];
    if (typeof v === 'string' && v !== '') out['--dpc-' + k] = v;
  }
  return out;
}

 
function skinTokenFlag(skinStyle, key) {
  if (skinStyle === null || typeof skinStyle !== 'object') return null;
  if (SKIN_TOKEN_VARS.indexOf(key) < 0) return null;
  return typeof skinStyle['--dpc-' + key] === 'string' ? '1' : null;
}


 

 
const PLATE_TOKENS = [
  ['surface', '--dpc-surface'],
  ['surface-2', '--dpc-surface-2'],
  ['edge', '--dpc-edge'],
  ['border', '--dpc-border'],
  ['plate-hue', '--dpc-plate-hue'],
  ['plate-base', '--dpc-plate-base'],
  ['plate-tint', '--dpc-plate-tint'],
];

 
const PLATE_TINT = '4%';
 
const PLATE_FALLBACK = { light: '#f3f7fd', dark: '#101318' };
 
const PLATE_SEED = '#4d8fd6';
 
const PLATE_HUE_CHAIN = [
  { level: 'skin-accent', source: 'token', key: '--dpc-accent' },
  { level: 'skin-text', source: 'token', key: '--dpc-text' },
  { level: 'host-brand', source: 'host', key: '--dsw-alias-brand-primary' },
  { level: 'host-static', source: 'host', key: '--dsw-static-deepseek-500' },
  { level: 'seed', source: 'seed', key: PLATE_SEED },
];
const PLATE_BASE_CHAIN = [
  { level: 'skin-surface', source: 'token', key: '--dpc-surface' },
  { level: 'host-overlay', source: 'host', key: '--dsw-alias-bg-overlay' },
  { level: 'fallback', source: 'fallback', key: null },
];
 
const PLATE_EDGE_CHAIN = [
  { level: 'skin-border', source: 'token', key: '--dpc-border' },
];

 
const PLATE_BORDER_CHAIN = [
  { level: 'skin-border', source: 'token', key: '--dpc-border' },
  { level: 'derived', source: 'derived' },
  { level: 'fallback', source: 'border-pole' },
];
 
const PLATE_BORDER_BAND = { light: { max: 100 }, dark: { min: 170 } };
 
const PLATE_BORDER_POLE = { light: '#1b2330', dark: '#e6ecf6' };
 
const PLATE_BORDER_MIX = '80%';

 
function plateRgbOf(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim().toLowerCase();
  if (raw === '') return null;
  let m = /^#([0-9a-f]{3})$/.exec(raw);
  if (m !== null) {
    const h = m[1];
    return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
  }
  m = /^#([0-9a-f]{6})$/.exec(raw);
  if (m !== null) {
    const h = m[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  m = /^rgba?\(([^)]*)\)$/.exec(raw);
  if (m !== null) {
    const parts = m[1].split(/[\s,/]+/).filter((p) => p !== '');
    if (parts.length < 3) return null;
    const nums = [];
    for (let i = 0; i < 3; i += 1) {
      const pm = /^(\d+(?:\.\d+)?)(%?)$/.exec(parts[i]);
      if (pm === null) return null;
      const v = pm[2] === '%' ? (parseFloat(pm[1]) / 100) * 255 : parseFloat(pm[1]);
      if (!Number.isFinite(v)) return null;
      nums.push(Math.max(0, Math.min(255, Math.round(v))));
    }
    return { r: nums[0], g: nums[1], b: nums[2] };
  }
  return null;
}

 
function plateHexOf(rgb) {
  const one = (v) => {
    const n = Math.max(0, Math.min(255, Math.round(v)));
    const s = n.toString(16);
    return s.length === 1 ? '0' + s : s;
  };
  return '#' + one(rgb.r) + one(rgb.g) + one(rgb.b);
}

 
function plateMixRgb(hue, base, pct) {
  const p = (typeof pct === 'string' ? parseFloat(pct) : Number(pct)) / 100;
  return {
    r: base.r + p * (hue.r - base.r),
    g: base.g + p * (hue.g - base.g),
    b: base.b + p * (hue.b - base.b),
  };
}

 
function plateMidOf(rgb) {
  const s = [rgb.r, rgb.g, rgb.b].sort((a, b) => a - b);
  return s[1];
}

 
function platePolarityFit(rgb, scheme) {
  const mid = plateMidOf(rgb);
  return scheme === 'light' ? mid >= 211 : mid <= 32;
}

 
function plateIsPureRgb(rgb) {
  const all0 = rgb.r === 0 && rgb.g === 0 && rgb.b === 0;
  const all255 = rgb.r === 255 && rgb.g === 255 && rgb.b === 255;
  return all0 || all255;
}

 
function plateLevelValue(level, tokens, scheme) {
  if (level.source === 'token') return tokens[level.key];
  if (level.source === 'host') return plateHostVar(level.key);
  if (level.source === 'seed') return level.key;
  return scheme === 'light' ? PLATE_FALLBACK.light : PLATE_FALLBACK.dark;
}

 
function plateChainRgb(chain, tokens, scheme) {
  for (const level of chain) {
    const rgb = plateRgbOf(plateLevelValue(level, tokens, scheme));
    if (rgb === null) continue;
    if (plateIsPureRgb(rgb)) continue;
    return { rgb: rgb, level: level.level };
  }
  return null;
}

 
function plateBorderBandFit(rgb, scheme) {
  const band = scheme === 'light' ? PLATE_BORDER_BAND.light : PLATE_BORDER_BAND.dark;
  if (band.max !== undefined) {
    return rgb.r <= band.max && rgb.g <= band.max && rgb.b <= band.max;
  }
  return rgb.r >= band.min && rgb.g >= band.min && rgb.b >= band.min;
}

 
function plateBorderOf(tokens, surfaceRgb, scheme) {
  const pole = plateRgbOf(scheme === 'light' ? PLATE_BORDER_POLE.light : PLATE_BORDER_POLE.dark);
  for (const level of PLATE_BORDER_CHAIN) {
    if (level.source === 'token') {
      const rgb = plateRgbOf(tokens[level.key]);
      if (rgb === null) continue;
      if (plateIsPureRgb(rgb)) continue;
      if (!plateBorderBandFit(rgb, scheme)) continue;
      return { rgb: rgb, level: level.level };
    }
    if (level.source === 'derived') {
      if (pole === null) continue;
      const rgb = plateMixRgb(pole, surfaceRgb, PLATE_BORDER_MIX);
      if (plateIsPureRgb(rgb)) continue;
      return { rgb: rgb, level: 'derived-' + PLATE_BORDER_MIX.replace('%', '') };
    }
    
    if (pole === null) continue;
    if (plateIsPureRgb(pole)) continue;
    return { rgb: pole, level: level.level };
  }
  
  return {
    rgb: plateRgbOf(scheme === 'light' ? PLATE_FALLBACK.light : PLATE_FALLBACK.dark),
    level: 'fallback-base',
  };
}

 
function plateHostVar(name) {
  try {
    if (typeof document === 'undefined' || !document || !document.documentElement) return '';
    const view = document.defaultView || (typeof window !== 'undefined' ? window : null);
    if (!view || typeof view.getComputedStyle !== 'function') return '';
    const v = view.getComputedStyle(document.documentElement).getPropertyValue(name);
    return typeof v === 'string' ? v.trim() : '';
  } catch (_error) {
    return '';
  }
}

 
function plateSolveOf(skinStyle, scheme) {
  const tokens = (skinStyle !== null && typeof skinStyle === 'object') ? skinStyle : {};
  const light = scheme === 'light';
  const fallbackRgb = plateRgbOf(light ? PLATE_FALLBACK.light : PLATE_FALLBACK.dark);
  
  const hueHit = plateChainRgb(PLATE_HUE_CHAIN, tokens, scheme);
  const hue = hueHit !== null ? hueHit.rgb : plateRgbOf(PLATE_SEED);
  
  const baseHit = plateChainRgb(PLATE_BASE_CHAIN, tokens, scheme);
  let base = baseHit !== null ? baseHit.rgb : fallbackRgb;
  let baseLevel = baseHit !== null ? baseHit.level : 'fallback';
  
  if (!platePolarityFit(base, light ? 'light' : 'dark')) {
    base = fallbackRgb;
    baseLevel = 'fallback-polarity';
  }
  
  const edgeHit = plateChainRgb(PLATE_EDGE_CHAIN, tokens, scheme);
  const edge = edgeHit !== null ? edgeHit.rgb : plateMixRgb(hue, base, '22%');
  const edgeLevel = edgeHit !== null ? edgeHit.level : 'derived-22';
  
  const surfaceRgb = plateMixRgb(hue, base, PLATE_TINT);
  
  const borderHit = plateBorderOf(tokens, surfaceRgb, scheme);
  
  const values = {
    surface: plateHexOf(surfaceRgb),
    'surface-2': plateHexOf(plateMixRgb(hue, base, '10%')),
    edge: plateHexOf(edge),
    border: plateHexOf(borderHit.rgb),
    'plate-hue': plateHexOf(hue),
    'plate-base': plateHexOf(base),
    'plate-tint': PLATE_TINT,
  };
  return {
    values: values,
    levels: {
      hue: hueHit !== null ? hueHit.level : 'seed',
      base: baseLevel,
      edge: edgeLevel,
      border: borderHit.level,
    },
  };
}

 
function plateTokensOf(skinStyle, scheme) {
  const solved = plateSolveOf(skinStyle, scheme);
  const out = {};
  for (const pair of PLATE_TOKENS) out[pair[1]] = solved.values[pair[0]];
  return out;
}



 
const SKIN_FRAME_FIELDS = [
  ['source', '--dpc-frame-src'],
  ['slice', '--dpc-frame-slice'],
  ['width', '--dpc-frame-w'],
  ['compactWidth', '--dpc-frame-w-compact'],
  ['outset', '--dpc-frame-outset'],
  ['ornament', '--dpc-frame-ornament'],
];

 
function skinFrameOf(adapter) {
  const out = {};
  if (adapter === null || adapter === undefined || typeof adapter.getFrame !== 'function') return out;
  let frame = null;
  try { frame = adapter.getFrame(); } catch (_error) { return out; }
  if (frame === null || typeof frame !== 'object' || Array.isArray(frame)) return out;
  for (const pair of SKIN_FRAME_FIELDS) {
    const v = frame[pair[0]];
    if (typeof v === 'string' && v !== '') out[pair[1]] = v;
  }
  
  if (out['--dpc-frame-src'] === undefined) return {};
  
  if (out['--dpc-frame-w-compact'] === undefined) out['--dpc-frame-w-compact'] = out['--dpc-frame-w'];
  return out;
}

 
function skinFrameFlag(frameStyle) {
  if (frameStyle === null || typeof frameStyle !== 'object') return null;
  return typeof frameStyle['--dpc-frame-src'] === 'string' ? '1' : null;
}

 
function skinFrameOrnamentFlag(frameStyle) {
  if (frameStyle === null || typeof frameStyle !== 'object') return null;
  return typeof frameStyle['--dpc-frame-ornament'] === 'string' ? '1' : null;
}


 
function skinAvoidOf(adapter) {
  if (adapter === null || adapter === undefined || typeof adapter.getAvoidRects !== 'function') return [];
  let list = null;
  try { list = adapter.getAvoidRects(); } catch (_error) { return []; }
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const r of list) {
    if (r === null || typeof r !== 'object') continue;
    const x = Number(r.x);
    const y = Number(r.y);
    const w = Number(r.width !== undefined ? r.width : r.w);
    const ht = Number(r.height !== undefined ? r.height : r.h);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(ht)) continue;
    if (w <= 0 || ht <= 0) continue;
    out.push({ x, y, width: w, height: ht });
  }
  return out;
}

 
function skinAvoidAdjust(rects, box) {
  const out = { left: box.left, top: box.top, hits: 0 };
  if (!Array.isArray(rects) || rects.length === 0) return out;
  if (!Number.isFinite(box.top)) return out; 
  const right = box.left + box.width;
  let lift = 0;
  let side = null;
  for (const r of rects) {
    if (right <= r.x || box.left >= r.x + r.width) continue;      
    if (r.y + r.height < box.top || r.y > box.top) continue;      
    lift = Math.max(lift, box.top - (r.y - SKIN_AVOID_GAP));
    if (side === null || r.x + r.width + SKIN_AVOID_GAP > side) side = r.x + r.width + SKIN_AVOID_GAP;
    out.hits += 1;
  }
  if (out.hits === 0) return out;
  const lifted = box.top - lift;
  if (lifted >= 12) { out.top = lifted; return out; }
  if (Number.isFinite(side) && side + box.width + 12 <= window.innerWidth) { out.left = side; return out; }
  out.top = Math.max(12, lifted);
  return out;
}


 
const DPC_CARD_TOOLBAR_GAP = 8;

 
function dpcCardFitIsNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

 
function dpcToolbarTopOf(input) {
  const o = (input && typeof input === 'object') ? input : null;
  if (!o || !o.composer || !o.card || !Array.isArray(o.candidates)) return null;
  const composerY = o.composer.y;
  const cardX = o.card.x;
  const cardW = o.card.w;
  if (!dpcCardFitIsNum(composerY) || !dpcCardFitIsNum(cardX) || !dpcCardFitIsNum(cardW)) return null;
  const cardRight = cardX + cardW;
  let best = null;
  for (const c of o.candidates) {
    if (!c || typeof c !== 'object') continue;
    const h = c.h;
    const x = c.x;
    const w = c.w;
    const y = c.y;
    if (!dpcCardFitIsNum(h) || !dpcCardFitIsNum(x) || !dpcCardFitIsNum(w) || !dpcCardFitIsNum(y)) continue;
    if (!(h > 0 && h <= 200)) continue;                 
    const bottom = y + h;
    if (!(bottom <= composerY + 1)) continue;            
    if (!(bottom >= composerY - 200)) continue;          
    const overlap = Math.min(cardRight, x + w) - Math.max(cardX, x);
    if (!(overlap > 0)) continue;                        
    if (best === null || bottom > best.bottom) best = { bottom: bottom, top: y };
  }
  return best === null ? null : best.top;
}

 
function dpcCardBottomClamp(input) {
  const o = (input && typeof input === 'object') ? input : {};
  const bottom = o.bottom;
  if (!dpcCardFitIsNum(bottom)) return bottom;          
  const toolbarTop = o.toolbarTop;
  if (!dpcCardFitIsNum(toolbarTop)) return bottom;       
  const gapToolbar = dpcCardFitIsNum(o.gapToolbar) ? o.gapToolbar : DPC_CARD_TOOLBAR_GAP;
  let out = Math.min(bottom, toolbarTop - gapToolbar);
  const gapComposer = o.gapComposer;
  const composerTop = o.composerTop;
  if (dpcCardFitIsNum(gapComposer) && dpcCardFitIsNum(composerTop)) {
    out = Math.min(out, composerTop - gapComposer);
  }
  return out;
}

 
function dpcCardFitMaxH(input) {
  const o = (input && typeof input === 'object') ? input : {};
  const bottom = o.bottom;
  if (!dpcCardFitIsNum(bottom)) return undefined;        
  const margin = dpcCardFitIsNum(o.margin) ? o.margin : 0;
  return Math.max(0, Math.floor(bottom - margin));
}


 
function dpcToolbarProbeOf(cardX, cardW) {
  const none = { composerTop: null, toolbarTop: null };
  if (typeof document === 'undefined' || !document || typeof document.querySelector !== 'function') return none;
  const composerEl = document.querySelector('[data-composer-card]');
  if (!composerEl || typeof composerEl.getBoundingClientRect !== 'function') return none;
  const cr = composerEl.getBoundingClientRect();
  const composer = { x: cr.left, y: cr.top, w: cr.width, h: cr.height };
  const candidates = [];
  let node = composerEl;
  for (let depth = 0; depth < 6; depth += 1) {
    const parent = node && node.parentElement;
    if (!parent) break;
    const kids = parent.children ? Array.prototype.slice.call(parent.children) : [];
    for (const kid of kids) {
      if (!kid || kid === node) continue;                                   
      if (typeof kid.contains === 'function' && kid.contains(node)) continue; 
      if (typeof kid.getBoundingClientRect !== 'function') continue;
      const r = kid.getBoundingClientRect();
      candidates.push({ x: r.left, y: r.top, w: r.width, h: r.height });
    }
    node = parent;
  }
  return {
    composerTop: composer.y,
    toolbarTop: dpcToolbarTopOf({ composer: composer, card: { x: cardX, w: cardW }, candidates: candidates }),
  };
}


 
const DPC_HUB_MAX_W = 180;
const DPC_HUB_MAX_H = 320;
const DPC_HUB_MIN_RATIO = 1.3;
const DPC_HUB_ROW_GAP = 6;
const DPC_HUB_SCREEN_MARGIN = 12;
const DPC_HUB_MIN_W = 40;
 
const DPC_HUB_TARGET_RATIO = 1.6;
const DPC_HUB_LEFT_KEEP = 0.5;
 
 
const DPC_HUB_SIDE_GAP = 12;
const DPC_HUB_TOP_GAP = 8;
const DPC_HUB_CARD_TOP_GAP = 12;
 
 
const DPC_HUB_SEND_CARD_SELECTOR = '[data-composer-card] button[aria-label="发送消息"]';
const DPC_HUB_SEND_SEAT_SELECTOR = '[data-composer-seat] button[aria-label="发送消息"]';

const dpcHubSendElement = () => firstVisibleElement(DPC_HUB_SEND_CARD_SELECTOR)
  || firstVisibleElement(DPC_HUB_SEND_SEAT_SELECTOR);
 
const DPC_HUB_PICKER_FALLBACK = '[data-composer-seat] button[aria-haspopup]';
 
const DPC_HUB_PICKER_CARD_SELECTOR = '[data-composer-card] button[aria-haspopup="menu"]';

 
function dpcHubPickerFromSeat() {
  const seat = findSeat();
  if (!seat) return null;
  const b = seat.querySelector('button') || seat.querySelector('[aria-haspopup]');
  if (!b || typeof b.getBoundingClientRect !== 'function') return null;
  const r = b.getBoundingClientRect();
  return (r && r.width > 0 && r.height > 0) ? b : null;
}

function dpcHubRect(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return null;
  const r = el.getBoundingClientRect();
  if (!r || !(r.width > 0) || !(r.height > 0)) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

 
function dpcHubPickerElement() {
  return firstVisibleElement(DPC_HUB_PICKER_CARD_SELECTOR)
    || dpcHubPickerFromSeat()
    || firstVisibleElement(DPC_HUB_PICKER_FALLBACK);
}

 
function dpcHubAnchors() {
  return {
    composer: dpcHubRect(newSessionAnchorElement()),
    picker: dpcHubRect(dpcHubPickerElement()),
    send: dpcHubRect(dpcHubSendElement()),
    view: { vw: window.innerWidth, vh: window.innerHeight },
  };
}

 
function dpcHubSize(availH, availW) {
  let w = Math.min(DPC_HUB_MAX_W, Math.max(DPC_HUB_MIN_W, Math.floor(Number(availW) || 0)));
  let h = Math.min(DPC_HUB_MAX_H, Math.round(w * DPC_HUB_TARGET_RATIO));
  if (Number.isFinite(availH) && availH > 0 && availH < h) {
    h = Math.max(1, Math.floor(availH));
    w = Math.min(w, Math.max(1, Math.floor(h / DPC_HUB_MIN_RATIO)));
  }
  
  if (w > 0 && h / w < DPC_HUB_MIN_RATIO) {
    const w2 = Math.floor(h / DPC_HUB_MIN_RATIO);
    if (w2 >= DPC_HUB_MIN_W) w = w2;
  }
  return { w, h };
}

 
function miniHubRect(anchors, view) {
  const a = (anchors && typeof anchors === 'object') ? anchors : {};
  const v = (view && typeof view === 'object') ? view : (a.view || {});
  const composer = a.composer || null;
  const picker = a.picker || null;
  const send = a.send || null;
  const vw = Number(v.vw) || 0;
  if (!Number.isFinite(vw) || vw <= DPC_HUB_SCREEN_MARGIN * 2) return null;
  const hasComposer = composer && Number.isFinite(composer.x) && Number.isFinite(composer.w)
    && composer.w > 0 && Number.isFinite(composer.y) && Number.isFinite(composer.h) && composer.h > 0;
  
  const tops = [];
  if (picker && Number.isFinite(picker.y)) tops.push(picker.y);
  if (send && Number.isFinite(send.y)) tops.push(send.y);
  const rowTop = tops.length ? Math.min.apply(null, tops) : (hasComposer ? composer.y + composer.h : null);
  if (!Number.isFinite(rowTop)) return null;
  const right = hasComposer ? composer.x + composer.w : vw - DPC_HUB_SCREEN_MARGIN;
  const room = hasComposer ? (vw - DPC_HUB_SCREEN_MARGIN - right) : 0;
  const branch = hasComposer
    ? (room >= DPC_HUB_MAX_W + DPC_HUB_SIDE_GAP * 2 ? 'right' : 'above')
    : 'row';
  const bottom = branch === 'right' ? composer.y + composer.h
    : (branch === 'above' ? composer.y - DPC_HUB_TOP_GAP : rowTop - DPC_HUB_ROW_GAP);
  const availH = bottom - DPC_HUB_SCREEN_MARGIN;
  if (!(availH > 0)) return null;
  let w = dpcHubSize(availH, vw - DPC_HUB_SCREEN_MARGIN * 2).w;
  if (branch === 'above' && hasComposer) {
    const keepX = composer.x + composer.w * DPC_HUB_LEFT_KEEP;
    if (right - w < keepX) w = Math.min(w, Math.max(DPC_HUB_MIN_W, Math.floor(right - keepX)));
  }
  if (right - w < DPC_HUB_SCREEN_MARGIN) w = Math.max(1, Math.floor(right - DPC_HUB_SCREEN_MARGIN));
  const size = dpcHubSize(availH, w);
  
  let left = branch === 'right' ? right + DPC_HUB_SIDE_GAP : right - size.w;
  if (left + size.w > vw - DPC_HUB_SCREEN_MARGIN) {
    left = Math.max(DPC_HUB_SCREEN_MARGIN, left - (left + size.w - (vw - DPC_HUB_SCREEN_MARGIN)));
  }
  if (left < DPC_HUB_SCREEN_MARGIN) left = DPC_HUB_SCREEN_MARGIN;
  const top = Math.max(DPC_HUB_SCREEN_MARGIN, bottom - size.h);
  return {
    x: left, y: top, w: size.w, h: size.h, bottom, rowTop, ratio: size.h / size.w,
    branch,
    composer: hasComposer ? { x: composer.x, y: composer.y, w: composer.w, h: composer.h } : null,
  };
}

 
function dpcHubExpandedRect(hub, view, fullW) {
  const vw = Number(view && view.vw) || 0;
  if (!hub || !Number.isFinite(vw) || vw <= DPC_HUB_SCREEN_MARGIN * 2) return null;
  const composer = (hub.composer && typeof hub.composer === 'object') ? hub.composer : null;
  const hasComposer = composer && Number.isFinite(composer.x) && Number.isFinite(composer.w)
    && composer.w > 0 && Number.isFinite(composer.y) && Number.isFinite(composer.h) && composer.h > 0;
  const maxW = vw - DPC_HUB_SCREEN_MARGIN * 2;
  let w = Math.max(120, Math.min(Number(fullW) || 0 || maxW, maxW));
  let left;
  let bottom;
  if (hasComposer) {
    const right = composer.x + composer.w;
    const room = vw - DPC_HUB_SCREEN_MARGIN - right;
    const rightSide = room >= w + DPC_HUB_SIDE_GAP * 2;
    bottom = rightSide ? composer.y + composer.h : composer.y - DPC_HUB_CARD_TOP_GAP;
    if (rightSide) {
      left = right + DPC_HUB_SIDE_GAP;
    } else {
      
      if (right - w < DPC_HUB_SCREEN_MARGIN) w = Math.max(1, Math.floor(right - DPC_HUB_SCREEN_MARGIN));
      left = right - w;
    }
  } else {
    const right = hub.x + hub.w;
    if (right - w < DPC_HUB_SCREEN_MARGIN) w = Math.max(1, Math.floor(right - DPC_HUB_SCREEN_MARGIN));
    left = Math.max(DPC_HUB_SCREEN_MARGIN, Math.min(right - w, vw - w - DPC_HUB_SCREEN_MARGIN));
    bottom = hub.bottom;
  }
  const h = Math.max(80, Math.min(620, bottom - DPC_HUB_SCREEN_MARGIN));
  const y = Math.max(DPC_HUB_SCREEN_MARGIN, bottom - h);
  return { x: left, y, w, h, bottom, right: left + w, branch: hasComposer ? (bottom >= composer.y ? 'right' : 'above') : 'row' };
}


 
function useHubRect(enabled) {
  const [hub, setHub] = React.useState(null);
  React.useEffect(() => {
    if (!enabled) {
      
      setHub(null);
      return undefined;
    }
    let prev = null;
    const tick = () => {
      const next = miniHubRect(dpcHubAnchors());
      const p = prev;
      if (next === null && p === null) return;
      if (next !== null && p !== null
        && next.x === p.x && next.y === p.y && next.w === p.w && next.h === p.h) return;
      prev = next;
      setHub(next);
    };
    tick();
    const off = busSubscribe(tick);
    window.addEventListener('resize', tick);
    window.addEventListener('scroll', tick, true);
    return () => {
      off();
      window.removeEventListener('resize', tick);
      window.removeEventListener('scroll', tick, true);
    };
  }, [enabled]);
  return hub;
}


















function dpcCardPlan(provider, model) {
  const hit = matchCard(PROVIDERS.cards, provider, model, { dataCards: DATA_CARDS });
  
  
  
  
  const card = (hit && typeof visualPersonaOf === 'function')
    ? visualPersonaOf(hit, PROVIDERS.cards, provider, model)
    : hit;
  const persona = (card && card.persona) ? card.persona : null;
  const visual = (card && typeof resolveVisualPayload === 'function')
    ? resolveVisualPayload(card, PROVIDERS.cards, provider, model)
    : null;
  return {
    card: card,
    persona: persona,
    
    visual: visual,
    
    title: dpcFormTitle(visual, persona),
  };
}

 
function dpcFormTitle(visual, persona) {
  const form = (visual && visual.form) ? visual.form : null;
  if (form && form.alias && form.availability !== 'reserved') return String(form.alias);
  return (persona && persona.title) ? String(persona.title) : '';
}

 
function dpcDeclaredEfforts(visual) {
  const no = (visual && visual.cardNo) ? String(visual.cardNo) : '';
  const list = (typeof PROVIDERS !== 'undefined' && Array.isArray(PROVIDERS.cards)) ? PROVIDERS.cards : [];
  if (!no) return [];
  for (const c of list) {
    if (!c || String(c.no) !== no) continue;
    const declared = c.efforts;
    if (Array.isArray(declared)) return declared;
  }
  return [];
}

 
function dpcEffortBucket(visual, tier) {
  if (typeof EFFORT_LINE_LADDER === 'undefined' || typeof DIALOGUE_EFFORT_SLOTS === 'undefined') return '';
  const ladder = EFFORT_LINE_LADDER;
  const slots = DIALOGUE_EFFORT_SLOTS.slice().sort((a, b) => ladder.indexOf(a) - ladder.indexOf(b));
  const t = tier == null ? '' : String(tier);
  if (!t || !slots.length) return '';
  const declared = dpcDeclaredEfforts(visual)
    .map((x) => String(x))
    .filter((x, i, arr) => arr.indexOf(x) === i && ladder.indexOf(x) >= 0)
    .sort((a, b) => ladder.indexOf(a) - ladder.indexOf(b)); 
  if (declared.length >= 3) {
    const i = declared.indexOf(t);
    if (i >= 0) return slots[i];
  } else if (declared.length) {
    return ''; 
  }
  
  
  if (slots.indexOf(t) >= 0) return t;
  const r = ladder.indexOf(t);
  if (r < 0) return '';
  for (let i = r + 1; i < ladder.length; i += 1) {
    if (slots.indexOf(ladder[i]) >= 0) return ladder[i];
  }
  return '';
}

 
function dpcCardLine(visual, card, effort, now, live, provider) {
  const P = (card && card.persona) ? card.persona : null;
  const d = (visual && visual.dialogue) ? visual.dialogue : null;
  
  if (typeof lowRow === 'function' && lowRow(card, live)) {
    return pickLine(card, 'summon', effort, now, live, true, provider) || '';
  }
  
  
  
  const summon = (d && d.summon) ? String(d.summon) : '';
  const cardSummon = P && P.summon ? String(P.summon) : '';
  const isGeneric = !!(card && card.generic);
  if (summon && !isGeneric && summon !== cardSummon) return summon;
  const base = pickLine(card, 'summon', effort, now, live, true, provider) || cardSummon;
  if (base) return base;
  
  return (d && d.unknown) ? String(d.unknown) : '';
}

 
function dpcTierLine(visual, card, effort, mainLine) {
  if (effort == null) return '';
  const d = (visual && visual.dialogue) ? visual.dialogue : null;
  const bucket = dpcEffortBucket(visual, effort);
  const formLine = (d && d.effort && bucket) ? String(d.effort[bucket] || '') : '';
  const cardLine = (typeof effortLine === 'function') ? String(effortLine(card, effort) || '') : '';
  const text = formLine || cardLine;
  if (!text) return '';
  if (mainLine && text === String(mainLine)) return ''; 
  return text;
}






 
function effortHostOf(snapshot, selection) {
  return {
    groups: snapshot && Array.isArray(snapshot.groups) ? snapshot.groups : [],
    provider: selection && selection.provider ? selection.provider : null,
    model: selection && selection.model ? selection.model : null,
  };
}

function HudCard(props) {
  const { selection, pinned, onClose, onTogglePin, onHoverChange, mode, feedTick, sessionId, expanded, onExpand, host } = props;
  
  const plan = dpcCardPlan(selection.provider, selection.model);
  const card = plan.card;
  const rect = useSeatRect(true, sessionId);
  
  
  
  const layout = useHudLayout();
  const miniLayout = layout === HUD_LAYOUT_MINI;
  
  
  
  const hub = useHubRect(miniLayout);
  
  
  const isHub = miniLayout && expanded !== true;
  const calm = React.useMemo(() => motionIsCalm(), []);
  
  const playMode = mode === 'mini' ? 'mini' : 'full';
  const segments = PLAY_TIMELINE[playMode];
  const firstPhase = segments[0].phase;
  
  
  
  
  
  const resetKey = seenKey(selection.provider, selection.model) + '|' + playMode;
  
  
  
  
  
  
  const cgSlot = card !== null ? cgSlotOf(selection.provider, selection.model) : CG_SLOT_FALLBACK;
  const cgPlan = useCgPlan(selection.provider, selection.model, card !== null, 'hud', cgSlot);
  
  
  const cgCutout = Boolean(cgPlan && cgPlan.kind === 'image' && cgPlan.cutoutAssetId);
  
  
  
  const cgCutoutKind = cgPlan && cgPlan.cutoutKind;
  const [phase, setPhase] = React.useState(calm ? 'static' : firstPhase);
  
  
  
  const [entered, setEntered] = React.useState(calm);
  
  
  
  const [skipped, setSkipped] = React.useState(false);
  
  
  
  
  
  
  const [collapsed, setCollapsed] = React.useState(false);
  
  
  const seenPushedRef = React.useRef('');
  const skipCalm = calm || skipped;
  
  
  if (card === null) return null;

  const effort = selection.reasoningEffort || card.def || null;
  const now = new Date();
  
  const { stats, axis } = axisOf(card, effort, now, selection.provider, selection.model);
  
  
  
  
  
  
  const shownKeys = KEYS.filter((k) => dpcAxisHasValue(axis[k], stats[k]));
  const hasStats = shownKeys.length > 0;
  
  
  
  
  
  
  
  
  
  
  const effChips = effortChips(card, host);
  const effLabel = effortText(card, effort, effChips);
  const live = quotaLiveOf(selection.provider, selection.model, now.getTime());
  
  
  const stamp = quotaStamp(live, now);
  
  
  
  
  
  const lampState = quotaLampState(selection.provider, selection.model, now.getTime());
  const lampMeta = QUOTA_LAMP_STATES[lampState] || QUOTA_LAMP_STATES.na;
  const lampEl = h('i', {
    className: 'dpc-quota-lamp',
    'data-dpc-quota': lampState,
    role: 'img',
    'aria-label': lampMeta.label,
    title: lampMeta.label,
  });
  
  
  const balanceRow = quotaBalanceRow(live);
  const peakLine = quotaPeakLine(live);
  
  
  
  const ts = peakLine || timeState(card, now, selection.provider);
  const rows = quotaRows(card, live);
  const level = quotaLevel(card, live);
  const persona = plan.persona || {};
  
  
  
  
  const line = dpcCardLine(plan.visual, card, effort, now, live, selection.provider);
  
  
  const tierDialogue = dpcTierLine(plan.visual, card, effort, line);
  
  const mini = playMode === 'mini';
  
  
  const isGeneric = card.generic === true;
  
  
  const isData = card.dataCard === true;
  
  
  
  const channel = channelLabel(selection.provider, selection.model);
  
  const modelId = normModel(selection.model);
  const cardId = isGeneric
    ? 'generic-' + (modelId || 'unknown')
    : (isData ? 'data-' + (modelId || 'unknown') : String(card.no || ''));

  
  
  
  
  React.useEffect(() => {
    if (calm || skipped) { setPhase('static'); setEntered(true); return undefined; }
    setPhase(firstPhase);
    setEntered(false);
    const raf = requestAnimationFrame(() => setEntered(true));
    
    
    
    
    
    
    
    
    const enterTimer = setTimeout(() => setEntered(true), DPC_HUD_ENTER_FALLBACK_MS);
    const onVisibility = () => {
      try {
        if (document.visibilityState === 'visible') setEntered(true);
      } catch (_error) {   }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const ivs = segments.slice(1).map((s) => setTimeout(() => setPhase(s.phase), s.at));
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(enterTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const t of ivs) clearTimeout(t);
    };
  }, [calm, skipped, playMode, firstPhase, resetKey]);

  
  
  
  React.useEffect(() => {
    if (playMode !== 'full') return undefined;
    if (phase !== segments[segments.length - 1].phase) return undefined;
    const pushKey = seenKey(selection.provider, selection.model);
    if (seenPushedRef.current === pushKey) return undefined;
    seenPushedRef.current = pushKey;
    pushSeenToServer(selection.provider, selection.model);
    return undefined;
  }, [playMode, phase, selection.provider, selection.model]);

  const segIndex = Math.max(0, segments.findIndex((s) => s.phase === phase));
  
  
  const panelIdx = segments.findIndex((s) => s.phase === 'panel');
  const barsOn = skipCalm || mini || (panelIdx >= 0 && segIndex >= panelIdx);
  const typeOn = skipCalm || mini || phase === 'type';
  const w = Math.min(590, Math.max(300, window.innerWidth - 24));
  
  
  
  
  
  
  
  
  
  const splitArtW = cgPlan !== null && !isHub && w >= DPC_SPLIT_MIN_W ? dpcSplitArtWidth(w) : 0;
  
  
  
  const cgLayerPlan = cgPlanForCalm(cgPlan, calm);
  
  
  
  
  
  const cgLayerPlanCard = splitArtW > 0 ? cgLayerPlan : cgPlanForFallbackAnchor(cgLayerPlan);
  const splitArt = splitArtW > 0;
  
  const breathe = cgCutout && !skipCalm && cgCutoutKind !== 'video';
  
  
  const anchorX = rect ? (rect.center ? rect.x + (rect.w - w) / 2 : rect.x) : Math.max(12, (window.innerWidth - w) / 2);
  const left0 = Math.max(12, Math.min(anchorX, window.innerWidth - w - 12));
  const top0 = rect ? rect.y - 12 : undefined;
  
  
  const skinAdapter = activeSkinAdapter();
  const skinStyle = skinTokensOf(skinAdapter);
  
  
  
  
  
  
  
  
  const plateStyle = (skinAdapter === null || skinAdapter === undefined)
    ? {}
    : plateTokensOf(skinStyle, dpcHostSchemeResolve());
  
  
  const skinFrame = skinFrameOf(skinAdapter);
  
  
  
  let boxLeft = left0;
  let boxTop = top0;
  let boxW = w;
  let boxH = null;
  if (miniLayout && hub !== null) {
    if (isHub) {
      boxLeft = hub.x; boxTop = hub.bottom; boxW = hub.w; boxH = hub.h;
    } else {
      const ex = dpcHubExpandedRect(hub, { vw: window.innerWidth, vh: window.innerHeight }, w);
      if (ex !== null) { boxLeft = ex.x; boxTop = ex.bottom; boxW = ex.w; boxH = null; }
    }
  }
  
  const narrowHud = boxW < 480;
  
  
  
  
  
  
  
  
  const toolbarProbe = (!miniLayout && !narrowHud)
    ? dpcToolbarProbeOf(boxLeft, boxW)
    : { composerTop: null, toolbarTop: null };
  const skinBox = skinAvoidAdjust(skinAvoidOf(skinAdapter), { left: boxLeft, width: boxW, top: boxTop });
  const left = skinBox.left;
  
  
  
  
  
  
  
  boxTop = dpcCardBottomClamp({
    bottom: skinBox.top,
    toolbarTop: toolbarProbe.toolbarTop,
    gapToolbar: DPC_CARD_TOOLBAR_GAP,
    gapComposer: DPC_HUB_CARD_TOP_GAP,
    composerTop: toolbarProbe.composerTop,
  });
  const top = boxTop;
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const fitMaxH = (boxH === null && typeof top === 'number')
    ? dpcCardFitMaxH({ bottom: top, margin: DPC_HUB_SCREEN_MARGIN })
    : undefined;
  
  const hubProbe = hub === null ? null : {
    x: hub.x, y: hub.y, w: hub.w, h: hub.h, bottom: hub.bottom, rowTop: hub.rowTop,
    ratio: Math.round(hub.ratio * 100) / 100,
  };

  
  const rootProps = {
    className: 'dpc-hud' + (boxW < 480 ? ' dpc-narrow' : '') + (mini ? ' dpc-mini' : '')
      + (miniLayout ? (isHub ? ' dpc-hub' : ' dpc-hub-expanded') : '')
      
      
      + (collapsed ? ' dpc-hud-collapsed' : ''),
    'data-plugin': 'dsh-provider-card',
    'data-open': 'true',
    'data-phase': phase,
    'data-pinned': pinned ? '1' : '0',
    
    'data-hud-layout': layout,
    'data-hub': isHub ? '1' : '0',
    'data-hub-expanded': miniLayout && !isHub ? '1' : '0',
    
    
    
    'data-hud-collapsed': collapsed ? '1' : '0',
    
    
    
    'data-fit': fitMaxH === undefined ? '0' : '1',
    'data-hub-rect': hubProbe ? JSON.stringify(hubProbe) : null,
    
    
    'data-play-mode': playMode,
    
    
    'data-entered': entered ? '1' : '0',
    'data-seen-key': seenKey(selection.provider, selection.model),
    'data-phase-index': String(segIndex),
    'data-seg-total': String(segments.length),
    
    
    'data-feed-tick': String(feedTick || 0),
    
    
    
    'data-quota-level': level,
    
    
    'data-cg-slot': cgSlot,
    
    'data-cg-cutout': cgCutout ? '1' : '0',
    
    
    'data-cg-split': splitArt ? '1' : '0',
    
    'data-cg-breathe': breathe ? '1' : '0',
    
    
    'data-dpc-root': 'true',
    
    'data-card-generic': isGeneric ? '1' : '0',
    
    'data-card-source': isGeneric ? 'generic' : (isData ? 'data' : 'curated'),
    
    
    
    
    'data-model-id': modelId,
    'data-card-id': cardId,
    'data-channel': channel,
    'data-channel-provider': String(selection.provider || ''),
    
    
    'data-skin-active': skinAdapter === null ? '0' : '1',
    'data-skin-id': skinAdapter === null ? null : (skinAdapter.id || null),
    'data-skin-token-count': String(Object.keys(skinStyle).length),
    'data-skin-density': skinStyle['--dpc-density'] || null,
    
    
    
    
    'data-skin-text': skinTokenFlag(skinStyle, 'text'),
    
    
    'data-skin-frame': skinFrameFlag(skinFrame),
    'data-skin-frame-ornament': skinFrameOrnamentFlag(skinFrame),
    'data-skin-hits': String(skinBox.hits),
    style: Object.assign(
      
      
      
      
      { left, width: boxW, height: collapsed ? 0 : (boxH === null ? undefined : boxH), top,
        bottom: top === undefined ? 120 : undefined, transform: 'translateY(-100%)',
        maxHeight: fitMaxH, pointerEvents: collapsed ? 'none' : undefined },
      
      
      
      skinStyle, plateStyle, skinFrame),
    onMouseEnter: () => { if (onHoverChange) onHoverChange(true); },
    onMouseLeave: () => { if (onHoverChange) onHoverChange(false); },
    
    onClick: () => {
      if (isHub) { if (onExpand) onExpand(); return; }
      if (phase !== 'static') setSkipped(true);
    },
  };

  
  
  
  if (isHub) {
    const noText = card.no && card.no !== '—'
      ? '#' + String(card.no).padStart(3, '0') : (isData ? '数据' : '通用');
    
    
    
    const hubLine = balanceRow
      ? `${balanceRow.lbl} ${balanceRow.text}`
      : rows.length > 0
        ? quotaRowLabel(rows[0].lbl) + ` ${rows[0].left}%`
        : (line || `${selection.provider}/${selection.model}`);
    return h('div', rootProps,
      h('style', null, HUD_CSS),
      h('div', { className: 'dpc-hub-body' },
        h('div', { className: 'dpc-hub-art' },
          h(CgLayer, { plan: cgLayerPlan, cardId, form: 'mini' }),
          h('span', { className: 'dpc-hub-no', 'data-card-source': isData ? 'data' : null }, noText)),
        h('div', { className: 'dpc-hub-meta' },
          h('div', { className: 'dpc-hub-name' }, persona.name || `${selection.provider}/${selection.model}`),
          h('div', { className: 'dpc-hub-line', title: hubLine }, hubLine),
          h('div', { className: 'dpc-hub-foot' },
            channel ? h('span', { className: 'dpc-channel', 'data-channel': channel,
              title: `通道 ${channel} · 服务商 ${selection.provider} · 身份 ${modelId || '未识别'}` }, channel) : null,
            h('button', { type: 'button', className: 'dpc-hub-open', onClick: onExpand,
              
              
              
              
              title: '展开完整卡' }, '展开')))));
  }

  return h('div', rootProps,
    h('style', null, HUD_CSS),
    h('div', { className: 'dpc-cone' }),
    h('div', { className: 'dpc-panel', style: Object.assign(
      
      
      { '--dpc-ca': card.c[0], '--dpc-cb': card.c[1] },
      splitArt ? { paddingRight: (splitArtW + DPC_SPLIT_COL_GAP) + 'px' } : null) },
      
      
      
      
      
      
      
      
      isGeneric ? h('div', { className: 'dpc-generic-banner', 'data-card-generic': '1' },
        h('b', null, '通用卡 · 未收录机型')) : null,
      
      
      
      
      
      
      
      
      isData ? h('div', { className: 'dpc-generic-banner', 'data-card-source': 'data' },
        h('b', null, '数据卡 · 公开分数自动生成')) : null,
      
      h(CgLayer, { plan: cgLayerPlanCard,
        splitArt, artW: splitArtW, cardId }),
      h('div', { className: 'dpc-head' },
        h('b', { className: 'dpc-name' }, persona.name || `${selection.provider}/${selection.model}`),
        persona.latin ? h('span', { className: 'dpc-latin' }, persona.latin.toUpperCase()) : null,
        
        
        plan.title ? h('span', { className: 'dpc-title' }, plan.title) : null,
        
        
        channel ? h('span', { className: 'dpc-channel', 'data-channel': channel,
          title: `通道 ${channel} · 服务商 ${selection.provider} · 身份 ${modelId || '未识别'}` }, channel) : null,
        
        h('span', { className: 'dpc-seg', title: dpcT('播放形态 ') + playMode + dpcT(' · 第 ') + (segIndex + 1) + '/' + segments.length + dpcT(' 段 ') + segments[segIndex].label },
          segments.map((s, i) => h('i', { key: s.phase, 'data-on': i <= segIndex ? '1' : '0' }))),
        
        
        card.no && card.no !== '—'
          ? h('span', { className: 'dpc-no' }, '#' + String(card.no).padStart(3, '0'))
          
          
          
          
          
          
          : (isData ? h('span', { className: 'dpc-no', 'data-card-source': 'data' }, '数据') : null)),
      
      
      
      effLabel || effChips.length
        ? h('div', { className: 'dpc-eff' },
          effLabel ? h('span', { className: 'dpc-eff-lbl' }, effLabel) : null,
          effChips.map((e) => h('span', { key: e, className: 'dpc-eff-chip', 'data-on': e === effort ? '1' : '0' }, EFF_LABEL[e] || e)))
        : null,
      
      
      
      
      
      
      
      
      
      
      h(Typewriter, { text: line, start: typeOn, calm: skipCalm || mini }),
      
      
      tierDialogue ? h(Typewriter, { text: tierDialogue, start: typeOn, calm: skipCalm || mini }) : null,
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      hasStats
        ? h('div', { className: 'dpc-stats', 'data-stat-shown': String(KEYS.length), 'data-stat-valued': String(shownKeys.length) },
          KEYS.map((k) => h(StatBar, { key: k, label: k, stat: stats[k], src: SRC[k], start: barsOn, calm: skipCalm, u: axis[k], note: missingNoteOf(card) })))
        : h('div', { className: 'dpc-stats-none', 'data-no-public-score': '1', 'data-stat-shown': '0', 'data-stat-valued': '0' }, NO_PUBLIC_SCORE),
      
      
      
      
      
      
      
      
      h('div', { className: 'dpc-lines' },
        h('div', { className: 'dpc-row' }, h('span', null, dpcT('时段 · ') + ts.tag), h('d', null, ts.fact)),
        
        
        balanceRow ? h('div', { key: '余额', className: 'dpc-row',
          'data-quota-balance': String(balanceRow.balance),
          'data-quota-stale': stamp && stamp.stale ? '1' : '0', 'data-quota-state': stamp ? stamp.state : null },
          h('span', null, balanceRow.lbl), h('d', null, balanceRow.text)) : null,
        balanceRow ? null : rows.map((r) => h('div', { key: r.lbl, className: 'dpc-row', 'data-tone': r.left < 20 ? 'red' : r.left < 40 ? 'warn' : 'ok',
          'data-quota-stale': stamp && stamp.stale ? '1' : '0', 'data-quota-state': stamp ? stamp.state : null },
          h('span', null, quotaRowLabel(r.lbl)), h('d', null, `${r.left}% ${r.rst}`))),
        !balanceRow && rows.length === 0 ? h('div', { className: 'dpc-row' },
          
          h('span', { className: 'dpc-quota-lamp-cell' }, lampEl),
          h('span', null, '额度'), h('d', null, '未知（未接入）')) : null,
        stamp ? h('div', {
          className: 'dpc-row',
          'data-quota-stale': stamp.stale ? '1' : '0',
          'data-quota-state': stamp.state || null,
          'data-quota-source': stamp.source || null,
          title: `数据新鲜度：${stamp.state || '未标注'}${stamp.validUntil ? ` · 有效至 ${stamp.validUntil}` : ''}`,
          
          
          
          
          
          
          
          
          
          
          
          
        }, h('span', { className: 'dpc-quota-lamp-cell' }, lampEl), h('span', null, '额度数据 · '), h('d', null, stamp.text)) : null),
      h('div', { className: 'dpc-tools' },
        h('button', { type: 'button', className: 'dpc-btn', 'data-on': pinned ? '1' : '0', onClick: onTogglePin, title: '固定后不再自动收起（选择器打开时仍让位）' }, pinned ? '已固定' : '固定'),
        
        
        
        
        
        h('button', { type: 'button', className: 'dpc-btn dpc-hud-collapse', 'data-dpc-collapse': '1',
          
          onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); setCollapsed(true); },
          title: '折叠这张卡（收起后不占位，可再展开）' }, '折叠'),
        
        
        
        
        
        
        
        
        h('button', { type: 'button', className: 'dpc-btn', onClick: onClose }, '收起'))),
      
      
      
      
      collapsed ? h('button', { type: 'button', className: 'dpc-hud-restore', 'data-dpc-restore': '1',
        onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); setCollapsed(false); },
        title: '再展开这张卡（回到收起前的内容）' }, '展开') : null);
}


 
function NotifyBubble(props) {
  const { note, onDismiss } = props;
  React.useEffect(() => {
    const t = setTimeout(onDismiss, note.autoCloseMs);
    return () => clearTimeout(t);
  }, [note.id]);
  const sub = note.kind === 'digest'
    ? note.routes + dpcT(' 条已合并为一条摘要')
    : (note.display || (note.kind === 'recover' ? dpcT('额度已恢复') : dpcT('额度告急')));
  return h('div', {
    className: 'dpc-toast',
    'data-kind': note.kind,
    'data-notify-id': note.id,
    title: (dpcT('已合并摘要 · ') + String(note.display || '').trim()),
  },
    h('div', { className: 'dpc-toast-line' }, note.line,
      sub ? h('span', { className: 'dpc-toast-sub' }, sub) : null),
    h('button', {
      type: 'button', className: 'dpc-toast-x', onClick: onDismiss,
      title: dpcT('关闭（该条已消费，不会再重播）'),
    }, '×'));
}

 
function quotaNoteHandledExternally(note) {
  const a = activeSkinAdapter();
  if (a === null || a === undefined || typeof a.presentQuotaEvent !== 'function') return false;
  try { return a.presentQuotaEvent(note) === true; } catch (_error) { return false; }
}

 
function NotifyStack(props) {
  const { selection, onFeed } = props || {};
  const [items, setItems] = React.useState([]);
  
  const selRef = React.useRef(selection);
  selRef.current = selection;
  const onFeedRef = React.useRef(onFeed);
  onFeedRef.current = onFeed;
  React.useEffect(() => {
    let alive = true;
    const pump = () => {
      const sel = selRef.current || {};
      const finish = () => {
        if (!alive) return;
        const fresh = consumeNotifyOnce(notifyListOf());
        
        const shown = fresh.filter((n) => !quotaNoteHandledExternally(n));
        if (shown.length) setItems((prev) => prev.concat(shown));
      };
      
      
      
      
      Promise.all([
        Promise.resolve(pumpQuotaFeed(sel.provider, sel.model)).catch(() => null),
        Promise.resolve(pumpMeasuredFeed(sel.provider, sel.model)).catch(() => null),
        Promise.resolve(flushSeenPush()).catch(() => null),
      ]).then((rs) => {
        finish();
        if ((rs[0] || rs[1]) && onFeedRef.current) onFeedRef.current();
      }).catch(() => finish());
    };
    pump();
    const t = setInterval(pump, NOTIFY_POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (items.length === 0) return null;
  return h('div', {
    className: 'dpc-toast-stack',
    'data-notify-stack': '1',
    role: 'status',
    'aria-live': 'polite',
  }, items.map((n) => h(NotifyBubble, {
    key: n.id,
    note: n,
    onDismiss: () => setItems((prev) => prev.filter((x) => x.id !== n.id)),
  })));
}





function ProviderCardProbe(props) {
  const { rpc, ctx: cardCtx, sessionId } = props;
  const ctx = cardCtx;
  const watcherRef = React.useRef(null);
  const { key, directory, snapshot } = useDirectory(ctx, sessionId);
  const [hud, setHud] = React.useState(null); 
  const [pinned, setPinned] = React.useState(false);
  
  const [hubExpanded, setHubExpanded] = React.useState(false);
  
  
  const layout = useHudLayout();
  const hubOpen = layout === HUD_LAYOUT_MINI && hubExpanded;
  
  
  const [feedTick, setFeedTick] = React.useState(0);
  
  
  
  
  
  const [, setSkinTick] = React.useState(0);

  if (watcherRef.current === null) {
    watcherRef.current = createWatcher({
      cooldownMs: DEFAULT_COOLDOWN_MS,
      onSummon: (selection, _at) => {
        try {
          rpc?.notify?.({ sessionId, selection });
        } catch (_error) {   }
        
        if (dpcCardPlan(selection.provider, selection.model).card !== null) {
          setPinned(false);
          
          
          
          const mode = playModeOf(selection.provider, selection.model);
          rememberSeen(selection.provider, selection.model, Date.now());
          setHud({ selection, mode });
        }
      },
    });
  }
  const [reason, setReason] = React.useState('mount');

  
  
  
  
  
  
  React.useEffect(() => {
    const bump = () => setSkinTick((t) => t + 1);
    let mql = null;
    try {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        mql = window.matchMedia('(prefers-color-scheme: dark)');
        if (mql && typeof mql.addEventListener === 'function') mql.addEventListener('change', bump);
      }
    } catch (_error) { mql = null; }
    let obs = null;
    try {
      if (typeof MutationObserver === 'function' && document && document.body) {
        obs = new MutationObserver(bump);
        obs.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] });
      }
    } catch (_error) { obs = null; }
    let unsubTheme = null;
    try {
      const theme = ctx && typeof ctx.get === 'function' ? ctx.get('theme') : null;
      if (theme && typeof theme.on === 'function') {
        const off = theme.on(bump);
        unsubTheme = typeof off === 'function' ? off : null;
      } else if (theme && typeof theme.subscribe === 'function') {
        unsubTheme = theme.subscribe(bump);
      }
    } catch (_error) { unsubTheme = null; }
    
    
    
    
    
    let offSkinRegistry = null;
    try { offSkinRegistry = dpcSkinOnRegistryChanged(bump); } catch (_error) { offSkinRegistry = null; }
    return () => {
      try { if (mql && typeof mql.removeEventListener === 'function') mql.removeEventListener('change', bump); } catch (_error) {   }
      try { if (obs) obs.disconnect(); } catch (_error) {   }
      try { if (typeof unsubTheme === 'function') unsubTheme(); } catch (_error) {   }
      try { if (typeof offSkinRegistry === 'function') offSkinRegistry(); } catch (_error) {   }
    };
  }, []);

  
  
  
  
  
  
  
  
  
  React.useLayoutEffect(() => {
    dpcPublishSessionKey(sessionId);
    return () => dpcPublishSessionKey(DPC_SESSION_KEY_UNSET);
  }, [sessionId]);

  
  
  
  
  
  React.useEffect(() => {
    watcherRef.current.reset();
  }, [key]);

  
  
  
  
  React.useEffect(() => {
    const store = directory && directory.store;
    if (!store || typeof store.subscribe !== 'function' || typeof store.getSnapshot !== 'function') return undefined;
    const watcher = watcherRef.current;
    const consume = (s) => {
      if (s === null || s === undefined) return;
      
      if (watcher.state().hasBaseline === false) {
        watcher.markBaseline(s);
        setReason('baseline');
        return;
      }
      
      
      const verdict = watcher.observe({
        ...s,
        visible: key === null || key === sessionId,
      });
      setReason(verdict.reason);
    };
    let off;
    try {
      off = store.subscribe(() => consume(store.getSnapshot())) ?? null;
    } catch (_error) {
      return undefined;
    }
    if (typeof off !== 'function') off = () => {};
    consume(store.getSnapshot());
    return () => {
      try { off(); } catch (_error) {   }
    };
  }, [directory, key, sessionId]);

  
  React.useEffect(() => () => {
    watcherRef.current.reset();
  }, []);

  
  
  React.useEffect(() => {
    const watcher = watcherRef.current;
    const apply = (ms) => watcher.setCooldownMs(ms);
    cooldownListeners.add(apply);
    if (PC && PC.urls && PC.urls.config) {
      pcGetJson(PC.urls.config, null).then((j) => {
        const ms = j && j.config && j.config.cooldownMs;
        if (Number.isFinite(ms) && ms > 0) watcher.setCooldownMs(ms);
      });
    }
    return () => { cooldownListeners.delete(apply); };
  }, []);

  
  React.useEffect(() => { setHud(null); setPinned(false); setHubExpanded(false); }, [sessionId]);

  const hudOpen = hud !== null;
  
  React.useEffect(() => {
    setHubExpanded(false);
  }, [hud === null ? '' : seenKey(hud.selection.provider, hud.selection.model)]);

  
  
  
  
  React.useEffect(() => {
    if (!hudOpen) return undefined;
    let prev = selectorIsOpen();
    const tick = () => {
      const now = selectorIsOpen();
      if (now && !prev) setHud(null);
      prev = now;
    };
    const off = busSubscribe(tick);
    return off;
  }, [hudOpen]);

  
  
  
  
  React.useEffect(() => {
    if (!hudOpen || pinned) return undefined;
    const onDocDown = (e) => {
      const t = e.target;
      if (!t || typeof t.closest !== 'function') return;
      if (t.closest('.dpc-hud') || t.closest('[data-seat="probe"]')
        || t.closest('[data-slot="conversation.input.model"]')
        || t.closest('.dsh-claude-model-btn') || t.closest('.dsh-claude-model-popover')) return;
      if (hubOpen) { setHubExpanded(false); return; }
      setHud(null);
    };
    document.addEventListener('pointerdown', onDocDown, true);
    return () => document.removeEventListener('pointerdown', onDocDown, true);
  }, [hudOpen, pinned, hubOpen]);

  
  
  const [hovering, setHovering] = React.useState(false);
  React.useEffect(() => {
    if (!hudOpen || pinned || hovering) return undefined;
    const t = setTimeout(() => setHud(null), 9000);
    return () => clearTimeout(t);
  }, [hudOpen, pinned, hovering]);

  
  const escHandler = React.useCallback((e) => {
    if (e.key !== 'Escape') return;
    if (selectorIsOpen()) return;
    if (hubOpen) { setHubExpanded(false); return; }
    setHud(null);
  }, [hubOpen]);
  useBodyKeydown(escHandler, hudOpen);

  
  
  const toggle = () => {
    if (hudOpen) { setHud(null); return; }
    const cur = snapshot && snapshot.current;
    
    if (cur && dpcCardPlan(cur.provider, cur.model).card !== null) {
      setPinned(false);
      const mode = playModeOf(cur.provider, cur.model);
      rememberSeen(cur.provider, cur.model, Date.now());
      setHud({ selection: cur, mode });
    }
  };

  const current = snapshot && snapshot.current;
  const label = current ? `${current.provider}/${current.model}` : 'no model';
  
  
  const personaReady = pcUsePersonaOverridesReady();

  return h(React.Fragment, null,
    
    
    
    probeEnabled() ? h('button', {
      type: 'button',
      'data-plugin': 'dsh-provider-card',
      'data-seat': 'probe',
      'data-reason': reason,
      className: 'dsh-provider-card-probe',
      title: dpcT('角色卡') + ' · 原因：' + reason + dpcT(' · 点击开/收'),
      onClick: toggle,
      onMouseEnter: () => setHovering(true),
      onMouseLeave: () => setHovering(false),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        maxWidth: '100%',
        padding: '1px 8px',
        border: 'none',
        borderRadius: 24,
        background: 'transparent',
        color: 'var(--dpc-ink-3)',
        font: 'inherit',
        fontSize: 'var(--dsh-content-font-size-secondary, 13px)',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: '20px',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      },
    }, label) : null,
    h(NotifyStack, {
      selection: hud ? hud.selection : (snapshot && snapshot.current) || null,
      onFeed: () => setFeedTick((v) => v + 1),
    }),
    hudOpen && personaReady ? h(HudCard, {
      
      
      
      key: hud ? seenKey(hud.selection.provider, hud.selection.model) + '|' + hud.mode : '',
      selection: hud.selection,
      
      
      host: effortHostOf(snapshot, hud.selection),
      
      
      sessionId,
      mode: hud.mode,
      feedTick,
      pinned,
      onHoverChange: setHovering,
      onTogglePin: () => setPinned((v) => !v),
      
      
      
      
      
      
      
      
      onClose: () => { if (hubOpen) { setHubExpanded(false); return; } setHud(null); },
      
      expanded: hubExpanded,
      onExpand: () => setHubExpanded(true),
    }) : null);
}


 
const DPC_HUD_NEWSESSION_SLOT = 'shell.overlay';

 
const DPC_HOST_SLOT_SINGLE_CHAIN = [
  
  'conversation.header',
  'conversation.session',
  'conversation.composer',
  'conversation.composer.bar',
  'conversation.hero.brand.mark',
  'conversation.hero.workspace',
  'conversation.hero.agentPreset',
  'conversation.view',
  'conversation.session.header',
  'conversation.session.header.lineage',
  'conversation.session.header.corner',
  'conversation.input.attachments',
  'conversation.input.permission',
  'conversation.input.plan',
  'conversation.input.model',
  'conversation.input.activity',
  
  'root',
  'sidebar',
  'main',
  'rightbar',
  'shell.bottom',
  'shell.leading',
];

 
const firstVisibleElement = (selector) => {
  try {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return null;
    const el = document.querySelector(selector);
    if (el === null || el === undefined || typeof el.getBoundingClientRect !== 'function') return null;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    return el;
  } catch (_error) {
    return null;
  }
};

 
const DPC_NEW_SESSION_SEAT_SELECTOR = '[data-composer-seat]';
const newSessionSeatElement = () => firstVisibleElement(DPC_NEW_SESSION_SEAT_SELECTOR);

 
const DPC_NEW_SESSION_ANCHOR_SELECTOR = '[data-composer-card]';
const newSessionAnchorElement = () => firstVisibleElement(DPC_NEW_SESSION_ANCHOR_SELECTOR)
  || firstVisibleElement(DPC_NEW_SESSION_SEAT_SELECTOR);

 
const DPC_SESSION_KEY_UNSET = undefined;
const dpcSessionKeyState = { key: DPC_SESSION_KEY_UNSET, listeners: new Set() };
const dpcPublishSessionKey = (nextKey) => {
  const next = typeof nextKey === 'string' && nextKey.length > 0 ? nextKey : DPC_SESSION_KEY_UNSET;
  if (dpcSessionKeyState.key === next) return;
  dpcSessionKeyState.key = next;
  for (const fn of [...dpcSessionKeyState.listeners]) {
    try { fn(next); } catch (_error) {   }
  }
};
const dpcReadSessionKey = () => dpcSessionKeyState.key;
const dpcOnSessionKey = (fn) => {
  if (typeof fn !== 'function') return () => {};
  dpcSessionKeyState.listeners.add(fn);
  return () => { dpcSessionKeyState.listeners.delete(fn); };
};

 
const dpcNewSessionOn = (sessionKey) => sessionKey === null || sessionKey === undefined;

 
const DPC_HUD_NEWSESSION_MODE = 'full';


 
function ProviderCardNewSession(props) {
  const { ctx: cardCtx } = props;
  const ctx = cardCtx;
  
  
  
  const { snapshot } = useDirectory(ctx, undefined);
  const [sessionKey, setSessionKey] = React.useState(DPC_SESSION_KEY_UNSET);
  
  
  
  const [confirmed, setConfirmed] = React.useState(false);
  React.useEffect(() => {
    const off = dpcOnSessionKey(setSessionKey);
    Promise.resolve().then(() => { setSessionKey(dpcReadSessionKey()); setConfirmed(true); });
    return off;
  }, []);
  const [feedTick, setFeedTick] = React.useState(0);
  const [, setSkinTick] = React.useState(0);
  const [pinned, setPinned] = React.useState(true);
  const [manualClose, setManualClose] = React.useState(false);
  const [autoClosed, setAutoClosed] = React.useState(false);
  const [hovering, setHovering] = React.useState(false);
  
  const [seatHere, setSeatHere] = React.useState(false);
  
  
  const personaReady = pcUsePersonaOverridesReady();
  React.useEffect(() => {
    const tick = () => setSeatHere(newSessionSeatElement() !== null);
    tick();
    const off = busSubscribe(tick);
    window.addEventListener('resize', tick);
    window.addEventListener('scroll', tick, true);
    return () => {
      off();
      window.removeEventListener('resize', tick);
      window.removeEventListener('scroll', tick, true);
    };
  }, []);

  
  
  
  
  React.useEffect(() => {
    const bump = () => setSkinTick((t) => t + 1);
    let mql = null;
    try {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        mql = window.matchMedia('(prefers-color-scheme: dark)');
        if (mql && typeof mql.addEventListener === 'function') mql.addEventListener('change', bump);
      }
    } catch (_error) { mql = null; }
    let obs = null;
    try {
      if (typeof MutationObserver === 'function' && document && document.body) {
        obs = new MutationObserver(bump);
        obs.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] });
      }
    } catch (_error) { obs = null; }
    let offSkinRegistry = null;
    try { offSkinRegistry = dpcSkinOnRegistryChanged(bump); } catch (_error) { offSkinRegistry = null; }
    return () => {
      try { if (mql && typeof mql.removeEventListener === 'function') mql.removeEventListener('change', bump); } catch (_error) {   }
      try { if (obs) obs.disconnect(); } catch (_error) {   }
      try { if (typeof offSkinRegistry === 'function') offSkinRegistry(); } catch (_error) {   }
    };
  }, []);

  const on = confirmed && dpcNewSessionOn(sessionKey);
  const cur = snapshot && snapshot.current;
  const identity = cur ? seenKey(cur.provider, cur.model) : '';

  
  
  const [hubExpanded, setHubExpanded] = React.useState(false);
  const layout = useHudLayout();
  const hubOpen = layout === HUD_LAYOUT_MINI && hubExpanded;
  React.useEffect(() => { setHubExpanded(false); }, [identity]);
  React.useEffect(() => {
    if (!on || !hubOpen) return undefined;
    const collapse = (e) => {
      const t = e && e.target;
      if (t && typeof t.closest === 'function') {
        if (t.closest('.dpc-hud') || t.closest('[data-slot="conversation.input.model"]')) return;
      }
      setHubExpanded(false);
    };
    const onDown = (e) => collapse(e);
    const onKey = (e) => { if (e.key === 'Escape') collapse(e); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [on, hubOpen]);

  
  React.useEffect(() => { setManualClose(false); setAutoClosed(false); }, [identity]);

  
  React.useEffect(() => {
    if (!on || !cur || pinned || hovering || manualClose || autoClosed) return undefined;
    const t = setTimeout(() => setAutoClosed(true), 9000);
    return () => clearTimeout(t);
  }, [on, cur, pinned, hovering, manualClose, autoClosed, identity]);

  
  
  if (!confirmed) return null;
  if (!on) return null;
  if (!cur) return null;
  
  
  if (!seatHere || !personaReady) return null;
  if (manualClose || autoClosed) return null;

  
  
  
  
  
  
  
  return h(React.Fragment, null,
    h(NotifyStack, {
      selection: cur,
      onFeed: () => setFeedTick((v) => v + 1),
    }),
    h('div', {
      className: 'dpc-newsession-seat',
      'data-plugin': 'dsh-provider-card',
      'data-slot': DPC_HUD_NEWSESSION_SLOT,
      
      
      style: { pointerEvents: 'none' },
    }, h(HudCard, {
    
    key: 'newsession|' + identity,
    selection: cur,
    
    host: effortHostOf(snapshot, cur),
    
    
    sessionId: null,
    mode: DPC_HUD_NEWSESSION_MODE,
    feedTick,
    pinned,
    onHoverChange: setHovering,
    onTogglePin: () => setPinned((v) => !v),
    
    
    onClose: () => {
      if (hubOpen) { setHubExpanded(false); return; }
      setManualClose(true);
    },
    
    expanded: hubExpanded,
    onExpand: () => setHubExpanded(true),
  })));
}


 
const DPC_SET_TABS = [
  { id: 'overview', label: '概览' },
  { id: 'cards', label: '角色卡' },
  
  { id: 'persona', label: '文案' },
  { id: 'cg', label: 'CG 配图' },
  { id: 'pack', label: '角色包' },
];

const DPC_SET_DEFAULT_TAB = 'overview';








const DPC_SET_PAGE = 8;

 
const dpcSetPanelOf = (activeId, id, node) => (activeId === id ? node : null);

 
const DPC_SET_SLOT_TEXT = { idle: '待机', summon: '召唤登场', warning: '额度告急', recover: '恢复' };
const dpcSetSlotText = (slot) => (typeof dpcT === 'function' ? dpcT(DPC_SET_SLOT_TEXT[slot] || slot) : (DPC_SET_SLOT_TEXT[slot] || slot));

 
const DPC_SET_SCOPE_LONG = {
  model: '仅此模型（只在这条通道的这个模型上生效）',
  card: '这张卡的所有模型（换通道选同一个模型也算）',
  provider: '这个服务商（这家通道的所有模型都算）',
  default: '所有人（默认兜底，谁都没配时用它）',
};
const dpcSetScopeText = (scope) => DPC_SET_SCOPE_LONG[scope] || String(scope || '');



 
function blankForm(slots) {
  return {
    key: '',
    
    
    scope: 'card',
    provider: '',
    model: '',
    slot: slots && slots.length ? slots[0] : '',
    
    variant: 'hud',
    assetId: '',
    posterAssetId: '',
    fit: '',
    objectPosition: '',
    loop: '',                  
    muted: '',
    credit: '',
  };
}

 
function patchOf(form) {
  const b = {};
  if (form.assetId) b.assetId = form.assetId;
  if (form.posterAssetId) b.posterAssetId = form.posterAssetId;
  if (form.fit) b.fit = form.fit;
  if (form.objectPosition) b.objectPosition = form.objectPosition;
  if (form.loop !== '') b.loop = form.loop === '1';
  if (form.muted !== '') b.muted = form.muted === '1';
  if (form.credit) b.credit = form.credit;
  return b;
}

function field(label, control) {
  return h('label', { className: 'dpc-set-field' }, label, control);
}

function triSelect(value, onChange, disabled) {
  return h('select', {
    value,
    disabled: disabled || undefined,
    onChange: (e) => onChange(e.target.value),
  }, h('option', { value: '' }, '默认'), h('option', { value: '1' }, '是'), h('option', { value: '0' }, '否'));
}


 
const dpcGalleryRowUnlocks = (row, key, identity) => {
  if (row.provider + '/' + row.model === key) return true;
  if (!identity) return false;
  if (row.scope !== 'card' && row.scope !== 'model') return false;
  if (!row.model) return false;
  return normModel(row.model) === identity;
};

 
const dpcGalleryBuild = (rows, cards, dataCards, assets) => {
  const list = Array.isArray(rows) ? rows : [];
  const catalog = Array.isArray(cards) ? cards : [];
  const dc = dataCards || {};
  
  
  const assetKinds = {};
  for (const a of (Array.isArray(assets) ? assets : [])) assetKinds[a.id] = a.kind || '';
  const known = {};
  for (const c of catalog) known[c.provider + '/' + c.model] = true;
  const seen = {};
  const out = [];
  const pushCard = (key, base, identity) => {
    if (seen[key]) return;
    seen[key] = true;
    const hit = list.filter((r) => dpcGalleryRowUnlocks(r, key, identity));
    const first = hit[0] || null;
    const thumbId = first ? (first.posterAssetId || first.assetId) : null;
    out.push(Object.assign({}, base, {
      key,
      bound: hit.length > 0,
      rows: hit,
      thumbId,
      
      
      
      thumbKind: thumbId ? (assetKinds[thumbId] || '') : '',
    }));
  };
  for (const c of catalog) pushCard(c.provider + '/' + c.model, {
    no: c.no || '—',
    name: (c.persona && c.persona.name) || c.provider,
    latin: (c.persona && c.persona.latin) || '',
    title: (c.persona && c.persona.title) || '',
    summon: (c.persona && c.persona.summon) || '',
    skills: (c.persona && c.persona.skills) || [],
    imported: false,
    source: 'curated',
  }, normModel(c.model));
  
  
  
  for (const r of list) {
    if (r.scope !== 'model' || !r.provider || !r.model) continue;
    const key = r.provider + '/' + r.model;
    if (!known[key]) pushCard(key, { no: '—', name: key, latin: '', title: '导入角色', summon: '', skills: [], imported: true, source: 'imported' }, null);
  }
  
  
  
  
  const curatedIds = {};
  for (const c of catalog) curatedIds[normModel(c.model)] = true;
  for (const id of Object.keys(dc)) {
    if (curatedIds[id]) continue;
    const d = dc[id] || {};
    const skills = [];
    for (const k of KEYS) {
      const s = d.src && d.src[k];
      if (s) skills.push([k + ' · ' + s.benchmark, s.value + '（' + (s.source_type === 'third-party' ? '第三方评测' : '厂商自报') + '，来源 ' + (s.origin || '未标注') + '）']);
    }
    pushCard('data:' + id, {
      no: '—',
      name: displayModel(d.model || id),
      latin: '',
      title: DATA_CARD_TITLE,
      summon: '公开分数自动生成：只写有来源的成绩。',
      skills,
      imported: false,
      source: 'data',
      benchModel: d.model || id,
      generatedAt: d.generated_at || null,
    }, id);
  }
  return out;
};



 
const dpcAssetThumb = (url, kind, placeholderText, brokenText) => {
  const ph = placeholderText || '';
  const broken = brokenText || ph;
  if (!url) return h('span', { className: 'dpc-set-thumb dpc-gallery-locked' }, ph);
  if (kind === 'video') return h('video', { className: 'dpc-set-thumb', src: url, muted: true, preload: 'metadata' });
  return h('img', {
    className: 'dpc-set-thumb',
    src: url,
    alt: '',
    onError: (ev) => dpcAssetThumbFallback(ev, broken),
  });
};

 
const dpcAssetThumbFallback = (ev, text) => {
  const el = ev && ev.currentTarget;
  if (!el || !el.parentNode) return false;
  el.parentNode.replaceChild(h('span', { className: 'dpc-set-thumb dpc-gallery-locked' }, text || ''), el);
  return true;
};


function ProviderCardSettings(props) {
  
  
  const mount = props.mount || PC;
  const urls = (mount && mount.urls) || null;
  const bridgeSlots = (mount && mount.slots) || [];
  const [data, setData] = React.useState({ loading: true, err: '', rows: [], assets: [], caps: null, config: null, stale: [] });
  const [form, setForm] = React.useState(() => blankForm(bridgeSlots));
  const [msg, setMsg] = React.useState({ tone: '', text: '' });
  const [busy, setBusy] = React.useState('');
  const [picked, setPicked] = React.useState(null); 
  const [coolSec, setCoolSec] = React.useState(''); 
  
  const [layoutSel, setLayoutSel] = React.useState('');
  const [packFile, setPackFile] = React.useState(null); 
  const [gallerySel, setGallerySel] = React.useState(null); 
  
  
  const [tab, setTab] = React.useState(DPC_SET_DEFAULT_TAB);
  
  const [showLocked, setShowLocked] = React.useState(false);
  
  const [rowsLimit, setRowsLimit] = React.useState(DPC_SET_PAGE);
  const [assetsLimit, setAssetsLimit] = React.useState(DPC_SET_PAGE);
  
  const [pickSlot, setPickSlot] = React.useState('');
  const [pickQuery, setPickQuery] = React.useState('');
  
  const [rowCard, setRowCard] = React.useState('');
  const [rowSlot, setRowSlot] = React.useState('');
  const caps = data.caps;
  const slots = (caps && caps.slots && caps.slots.length ? caps.slots : bridgeSlots) || [];
  
  
  const pendingSlots = (caps && caps.pendingSlots) || [];
  const editableSlots = slots.filter((s) => pendingSlots.indexOf(s) < 0);
  const variants = (caps && caps.variants) || (mount && mount.variants) || [];
  const scopes = (caps && caps.scopes) || [];
  const fits = (caps && caps.fits) || [];
  const set = (patch) => setForm((f) => Object.assign({}, f, patch));
  const assetById = React.useMemo(() => {
    const m = {};
    for (const a of data.assets) m[a.id] = a;
    return m;
  }, [data.assets]);
  const nameOf = (id) => {
    if (!id) return '—';
    const a = assetById[id];
    if (a) return a.name || a.id.slice(0, 8);
    return '（素材缺失）' + String(id).slice(0, 8);
  };
  
  
  
  const SCOPE_TEXT = { model: '按模型（本通道）', card: '按卡（全部通道）', form: '按形态（同形态共用）', provider: '按服务商', default: '全局默认' };
  const scopeLabel = (row) => (row.scope === 'default'
    ? '全局默认'
    : row.scope === 'card'
      ? dpcT('按卡：') + row.model
      
      
      : row.scope === 'form'
        ? '按形态：' + row.model
        : row.scope + '：' + (row.model ? row.provider + '/' + row.model : row.provider));
  
  
  
  const hudAtScope = (() => {
    const wantScope = form.scope || '';
    const wantModel = normModel(form.model || '');
    if (!wantScope) return false;
    for (const row of data.rows) {
      if (row.slot !== form.slot || row.variant !== 'hud') continue;
      if (row.scope !== wantScope) continue;
      if (wantScope === 'model') {
        if (row.provider === form.provider && row.model === form.model) return true;
      } else if (wantScope === 'card') {
        if (wantModel && row.model === wantModel) return true;
      } else if (wantScope === 'provider') {
        if (row.provider === form.provider) return true;
      } else if (wantScope === 'default') {
        return true;
      }
    }
    return false;
  })();

  const reload = React.useCallback(() => {
    if (!urls || !urls.bindings) {
      setData((d) => ({ ...d, loading: false, err: '暂时读不到页面数据（插件后台没有响应）' }));
      return;
    }
    setData((d) => ({ ...d, loading: true, err: '' }));
    pcGetJson(urls.bindings, null).then((j) => {
      if (j === null) { setData((d) => ({ ...d, loading: false, err: '读取失败（插件后台暂时不可用）' })); return; }
      setData({
        loading: false,
        err: '',
        rows: j.rows || [],
        assets: j.assets || [],
        caps: j.capabilities || null,
        config: j.config || null,
        stale: j.stale || [],
      });
    });
  }, [urls]);
  React.useEffect(() => { reload(); }, [reload]);
  
  React.useEffect(() => {
    const ms = data.config && data.config.cooldownMs;
    if (Number.isFinite(ms) && ms > 0) setCoolSec(String(Math.round(ms / 1000)));
  }, [data.config]);

  
  React.useEffect(() => {
    const v = data.config && data.config.hudLayout;
    setLayoutSel(v === HUD_LAYOUT_CARD ? HUD_LAYOUT_CARD : HUD_LAYOUT_MINI);
  }, [data.config]);

  
  
  
  const [langSel, setLangSel] = React.useState(() => dpcGetLang());
  React.useEffect(() => {
    try { pcEnsureLocale(); } catch (_error) {   }
  }, []);

  const guard = () => {
    if (busy !== '') return true;
    if (!urls) { setMsg({ tone: 'err', text: '插件后台未就绪，暂时无法保存' }); return true; }
    return false;
  };
  const afterWrite = (res, okText) => {
    if (res.ok) {
      reload();
      cgBump(); 
      setMsg({ tone: 'ok', text: okText });
      return true;
    }
    setMsg({ tone: 'err', text: pcFailText(res) });
    reload();
    return false;
  };

  const saveBinding = async () => {
    if (guard()) return;
    if (!form.assetId) { setMsg({ tone: 'err', text: '还没有选素材：先到下面「CG 素材」上传，再回来选' }); return; }
    setBusy('save');
    const body = { provider: form.provider, model: form.model, slot: form.slot, binding: patchOf(form) };
    if (form.scope) body.scope = form.scope;
    if (form.variant) body.variant = form.variant;
    const res = await pcSend('POST', urls.bindings, null, body, null);
    setBusy('');
    const wrote = afterWrite(res, '已保存绑定：' + ((res.json && res.json.key) || form.slot));
    if (wrote && res.json && res.json.key) set({ key: res.json.key });
  };
  const clearBinding = async (key) => {
    if (guard() || !key) return;
    setBusy('clear');
    const res = await pcSend('DELETE', urls.bindings, { key }, null, null);
    setBusy('');
    afterWrite(res, '已清除绑定：' + key + '（素材保留）');
    if (form.key === key) set({ key: '' });
  };
  const loadRow = (row) => {
    setForm({
      key: row.key,
      scope: row.scope || '',
      provider: row.provider || '',
      model: row.model || '',
      slot: row.slot || (slots.length ? slots[0] : ''),
      variant: row.variant || '',
      assetId: row.assetId || '',
      posterAssetId: row.posterAssetId || '',
      fit: row.fit || '',
      objectPosition: row.objectPosition || '',
      loop: row.loop === null || row.loop === undefined ? '' : (row.loop ? '1' : '0'),
      muted: row.muted === null || row.muted === undefined ? '' : (row.muted ? '1' : '0'),
      credit: row.credit || '',
    });
    setMsg({ tone: '', text: '已载入「' + row.key + '」到上方表单，改完点保存即覆盖这条。' });
  };
  const removeAsset = async (id) => {
    if (guard()) return;
    setBusy('rm-' + id);
    const res = await pcSend('DELETE', urls.bindings, { removeAsset: id }, null, null);
    setBusy('');
    afterWrite(res, '已删除素材：' + String(id).slice(0, 8));
  };
  const upload = async () => {
    if (guard()) return;
    if (!picked) { setMsg({ tone: 'err', text: '先选一个文件（支持 png/gif/jpg/webp/mp4/webm，类型不符会提示原因）' }); return; }
    setBusy('up');
    let buf;
    try {
      buf = await picked.arrayBuffer();
    } catch (e) {
      setBusy('');
      setMsg({ tone: 'err', text: '读文件失败：' + String((e && e.message) || e) });
      return;
    }
    const nm = String(picked.name || '');
    const dot = nm.lastIndexOf('.');
    const type = dot > 0 ? nm.slice(dot + 1).toLowerCase() : '';
    const res = await pcSend('POST', urls.upload, { type, name: nm }, null, buf);
    setBusy('');
    if (afterWrite(res, '已上传：' + nm + '（' + Math.round(res.json.bytes / 1024) + ' KiB）')) setPicked(null);
  };

  
  
  const saveCooldown = async () => {
    if (guard()) return;
    const sec = Number(coolSec);
    if (!Number.isInteger(sec) || sec < 1 || sec > 86400) {
      setMsg({ tone: 'err', text: '冷却时长必须是 1–86400 之间的整数秒' });
      return;
    }
    setBusy('cool');
    const res = await pcSend('POST', urls.config, null, { cooldownMs: sec * 1000 }, null);
    setBusy('');
    if (res.ok) {
      setCooldownMs(sec * 1000); 
      reload();
      setMsg({ tone: 'ok', text: '已保存冷却时长：' + sec + ' 秒（立即生效）' });
    } else {
      setMsg({ tone: 'err', text: pcFailText(res) });
      reload();
    }
  };

  
  
  const exportPack = async () => {
    if (guard()) return;
    setBusy('export');
    const res = await pcSend('GET', urls.package, { export: 1 }, null, null);
    setBusy('');
    if (!res.ok) {
      setMsg({ tone: 'err', text: pcFailText(res) });
      return;
    }
    const pack = res.json || {};
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'provider-card.pcpack';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMsg({ tone: 'ok', text: dpcT('已导出角色包：') + (pack.bindings || []).length + dpcT(' 条绑定 / ') + (pack.assets || []).length + dpcT(' 个素材') });
  };

  
  
  const importPack = async () => {
    if (guard()) return;
    if (!packFile) {
      setMsg({ tone: 'err', text: '先选择要导入的 .pcpack 文件' });
      return;
    }
    let obj;
    try {
      obj = JSON.parse(await packFile.text());
    } catch (e) {
      setMsg({ tone: 'err', text: '角色包文件格式不正确：' + String((e && e.message) || e) });
      return;
    }
    setBusy('imp');
    const res = await pcSend('POST', urls.package, null, obj, null);
    setBusy('');
    if (res.ok) {
      const j = res.json || {};
      setMsg({ tone: 'ok', text: '已导入角色包：' + j.importedAssets + ' 个素材（去重 ' + j.deduped + '）/ ' + j.importedBindings + ' 条绑定' });
      setPackFile(null);
      reload();
      cgBump();
    } else {
      setMsg({ tone: 'err', text: pcFailText(res) });
    }
  };

  const configText = data.config
    ? dpcT('视频 ') + Math.round(data.config.maxVideoBytes / 1048576) + dpcT(' MiB / 图片 ')
      + Math.round(data.config.maxImageBytes / 1048576) + dpcT(' MiB / 总 ')
      + Math.round(data.config.totalBytes / 1048576) + ' MiB'
      + (Number.isFinite(data.config.cooldownMs) ? dpcT(' / 冷却 ') + Math.round(data.config.cooldownMs / 1000) + ' s' : '')
    : '—';

  
  
  
  const galleryCards = React.useMemo(() => {
    const cards = Array.isArray(PROVIDERS.cards) ? PROVIDERS.cards : [];
    return dpcGalleryBuild(data.rows, cards, DATA_CARDS, data.assets)
      .map((c) => Object.assign({}, c, { thumb: c.thumbId ? pcMediaUrl(c.thumbId) : null }));
    
    
  }, [data.rows, data.assets]);
  const gallerySelRow = gallerySel ? galleryCards.find((c) => c.key === gallerySel) || null : null;

  const pairs = (caps && caps.pairs) || [];
  const inUse = (id) => {
    const hits = data.rows.filter((r) => r.assetId === id || r.posterAssetId === id);
    return hits.length > 0 ? hits.map((r) => r.key) : null;
  };

  
  
  
  
  
  
  
  
  
  const assetThumbNode = (a) => dpcAssetThumb(
    pcMediaUrl(a.id),
    a.kind || (assetById[a.id] ? assetById[a.id].kind : ''),
    '素材不可用',
    '已绑定（无缩略图）');

   
  const rowAtSlot = (card, slot) => (card.rows || []).filter((r) => r.slot === slot)[0] || null;

  
  
  const rowCards = () => {
    const out = [];
    data.rows.forEach((r) => {
      const m = normModel(r.model || '');
      if (m && out.indexOf(m) < 0) out.push(m);
    });
    return out;
  };
  const shownRows = () => data.rows.filter((r) => (!rowCard || normModel(r.model || '') === rowCard)
    && (!rowSlot || r.slot === rowSlot));
  
  
  
  const shownRowsPage = () => shownRows().slice(0, rowsLimit);
  const shownAssetsPage = () => data.assets.slice(0, assetsLimit);
  const moreRow = (shown, total, bump) => (total > shown
    ? h('button', { className: 'dpc-btn', style: { marginTop: 8 }, onClick: bump },
      '再看 ' + Math.min(DPC_SET_PAGE, total - shown) + ' 条（共 ' + total + ' 条）')
    : null);

   
  const cardTarget = (card) => {
    if (card.imported || card.source === 'imported') {
      const i = card.key.indexOf('/');
      return i > 0
        ? { scope: 'model', provider: card.key.slice(0, i), model: card.key.slice(i + 1) }
        : { scope: 'default', provider: '', model: '' };
    }
    if (card.key.indexOf('data:') === 0) {
      return { scope: 'card', provider: '', model: card.key.slice(5) };
    }
    const i = card.key.indexOf('/');
    return { scope: 'card', provider: '', model: normModel(card.key.slice(i + 1)) };
  };

   
  const saveCell = async (card, slot, assetId) => {
    if (guard()) return;
    const t = cardTarget(card);
    setBusy('cell-' + card.key + '-' + slot);
    const res = await pcSend('POST', urls.bindings, null, {
      scope: t.scope,
      provider: t.provider,
      model: t.model,
      slot,
      variant: 'hud',
      binding: { assetId },
    }, null);
    setBusy('');
    afterWrite(res, dpcT('已保存「') + card.name + dpcT(' · ') + dpcT(dpcSetSlotText(slot)) + dpcT('」'));
  };

  
  
  const saveHudLayout = async (v) => {
    if (guard()) return;
    if (v !== HUD_LAYOUT_MINI && v !== HUD_LAYOUT_CARD) {
      setMsg({ tone: 'err', text: '形态只能是「竖版小窗」或「完整卡片」' });
      return;
    }
    setBusy('layout');
    const res = await pcSend('POST', urls.config, null, { hudLayout: v }, null);
    setBusy('');
    if (res.ok) {
      setLayoutSel(v);
      setHudLayout(v); 
      reload();
      setMsg({ tone: 'ok', text: dpcT('已切换为「') + dpcT(hudLayoutLabel(v)) + dpcT('」（立即生效）') });
    } else {
      setMsg({ tone: 'err', text: pcFailText(res) });
      reload();
    }
  };

  
  
  
  
  const saveLang = (v) => {
    if (v !== 'zh' && v !== 'en') return;
    setBusy('lang');
    dpcSetLang(v);
    setLangSel(dpcGetLang());
    setBusy('');
    setMsg({ tone: 'ok', text: v === 'en' ? dpcT('已切换为 English（立即生效）') : dpcT('已切换为中文（立即生效）') });
  };

  
  const statBox = (n, label) => h('div', { className: 'dpc-set-stat' },
    h('span', { className: 'dpc-set-statnum' }, String(n)),
    h('span', { className: 'dpc-set-statlab' }, label));

  const panelOverview = () => h('div', { className: 'dpc-set-panel', 'data-panel': 'overview', key: 'overview' },
    h('span', { className: 'dpc-set-cap', style: { marginTop: 0 } },
      '三步配完：挑一张卡 → 在它的格子里选一张图 → 存下来。下面三个数字是现在的进度。'),
    h('div', { className: 'dpc-set-stats' },
      statBox(data.rows.length, '已配图'),
      statBox(data.assets.length, '素材'),
      statBox(galleryCards.filter((c) => c.bound).length, '已解锁卡')),
    
    h('div', { className: 'dpc-set-tools' },
      h('button', { className: 'dpc-btn dpc-set-cta', onClick: () => setTab('cards') }, '① 给模型配一张图'),
      h('button', { className: 'dpc-btn', onClick: () => setTab('cg') }, '② 上传素材'),
      h('button', { className: 'dpc-btn', onClick: () => setTab('pack') }, '③ 导入角色包')),
    
    h('span', { className: 'dpc-set-sec' }, '全局开关'),
    h('div', { className: 'dpc-set-line' },
      h('span', {}, '切换模型后多少秒内不重复弹出这张卡'),
      h('input', {
        type: 'number',
        min: 1,
        max: 86400,
        step: 1,
        value: coolSec,
        style: { width: 90 },
        onChange: (e) => setCoolSec(e.target.value),
      }),
      h('span', { className: 'dpc-set-cap' }, '秒（1–86400；同一模型在这个窗口里只弹一次，保存后立即生效）'),
      h('button', { className: 'dpc-btn', onClick: saveCooldown, disabled: busy !== '' }, busy === 'cool' ? '保存中…' : '保存')),
    
    h('span', { className: 'dpc-set-sec' }, '卡片怎么显示'),
    h('div', { className: 'dpc-set-line' },
      h('span', {}, '这张模型卡默认显示成'),
      h('button', {
        className: 'dpc-btn' + (layoutSel === HUD_LAYOUT_MINI ? ' dpc-set-cta' : ''),
        'data-hud-layout-option': HUD_LAYOUT_MINI,
        'aria-pressed': layoutSel === HUD_LAYOUT_MINI ? 'true' : 'false',
        disabled: busy !== '',
        onClick: () => saveHudLayout(HUD_LAYOUT_MINI),
      }, hudLayoutLabel(HUD_LAYOUT_MINI)),
      h('button', {
        className: 'dpc-btn' + (layoutSel === HUD_LAYOUT_CARD ? ' dpc-set-cta' : ''),
        'data-hud-layout-option': HUD_LAYOUT_CARD,
        'aria-pressed': layoutSel === HUD_LAYOUT_CARD ? 'true' : 'false',
        disabled: busy !== '',
        onClick: () => saveHudLayout(HUD_LAYOUT_CARD),
      }, hudLayoutLabel(HUD_LAYOUT_CARD))),
    h('span', { className: 'dpc-set-cap' },
      '「' + hudLayoutLabel(HUD_LAYOUT_MINI) + '」：贴着输入框右下角的小竖窗，点它展开完整卡。'
      + '「' + hudLayoutLabel(HUD_LAYOUT_CARD) + '」：恢复旧的大卡，新会话页锚在输入框本体正中上方 12px。'
      + '两者随时可切，点了就生效，不用刷新。'),
    
    h('span', { className: 'dpc-set-sec' }, '语言'),
    h('div', { className: 'dpc-set-line' },
      h('span', {}, '界面与卡面文案'),
      h('button', {
        className: 'dpc-btn' + (langSel === 'zh' ? ' dpc-set-cta' : ''),
        'data-dpc-lang': 'zh',
        'aria-pressed': langSel === 'zh' ? 'true' : 'false',
        disabled: busy !== '',
        onClick: () => saveLang('zh'),
      }, '中文'),
      h('button', {
        className: 'dpc-btn' + (langSel === 'en' ? ' dpc-set-cta' : ''),
        'data-dpc-lang': 'en',
        'aria-pressed': langSel === 'en' ? 'true' : 'false',
        disabled: busy !== '',
        onClick: () => saveLang('en'),
      }, 'English')),
    h('span', { className: 'dpc-set-cap' },
      '切到 English 后界面文案与卡面文案走英文表；表里没有的条目回退显示中文原文。随时可切，点了就生效，不用刷新。'),
    h('span', { className: 'dpc-set-cap' }, dpcT('素材上限：') + configText));

  
   
  const slotCell = (card, slot) => {
    const row = rowAtSlot(card, slot);
    const asset = row ? assetById[row.assetId] || null : null;
    const open = pickSlot === card.key + '|' + slot;
    const pending = pendingSlots.indexOf(slot) >= 0;
    return h('div', { className: 'dpc-set-slot', 'data-slot': slot, key: slot },
      h('b', {}, dpcSetSlotText(slot)),
      asset ? assetThumbNode(asset) : h('span', { className: 'dpc-set-slot-cap' }, '还没有配图'),
      h('span', { className: 'dpc-set-slot-cap' },
        pending ? '这个格子的显示时机还没开放，配了也不会显示' : (asset ? (asset.name || asset.id.slice(0, 8)) : '点下面的按钮挑一张')),
      h('div', { className: 'dpc-set-tools', style: { marginTop: 4 } },
        h('button', {
          className: 'dpc-btn',
          disabled: pending || busy !== '',
          onClick: () => {
            if (open) { setPickSlot(''); setPickQuery(''); return; }
            setPickSlot(card.key + '|' + slot);
            setPickQuery('');
          },
        }, open ? '收起素材' : '选素材'),
        row ? h('button', { className: 'dpc-btn', onClick: () => clearBinding(row.key), disabled: busy !== '' }, '清空这一格') : null));
  };

   
  const pickerFor = (card) => {
    const prefix = card.key + '|';
    if (!pickSlot || pickSlot.indexOf(prefix) !== 0) return null;
    const slot = pickSlot.slice(prefix.length);
    const q = pickQuery.trim().toLowerCase();
    const list = data.assets.filter((a) => !q
      || String(a.name || '').toLowerCase().indexOf(q) >= 0
      || String(a.id).toLowerCase().indexOf(q) >= 0);
    const cur = rowAtSlot(card, slot);
    return h('div', { className: 'dpc-set-pick', 'data-pick-slot': slot },
      h('input', {
        className: 'dpc-set-search',
        type: 'search',
        value: pickQuery,
        placeholder: '搜素材名或 id…',
        onChange: (e) => setPickQuery(e.target.value),
      }),
      list.length === 0
        ? h('span', { className: 'dpc-set-empty' },
          data.assets.length === 0 ? '素材库是空的：先去「CG 配图」页上传。' : '没找到匹配的素材，换个词试试。')
        : null,
      h('div', { className: 'dpc-set-pickgrid' }, list.map((a) => h('button', {
        key: a.id,
        type: 'button',
        className: 'dpc-set-pickcell' + (cur && cur.assetId === a.id ? ' dpc-set-pickcell-on' : ''),
        'data-asset-id': a.id,
        title: a.name || a.id,
        onClick: () => saveCell(card, slot, a.id),
      }, assetThumbNode(a), h('span', {}, a.name || a.id.slice(0, 8))))));
  };

  
  
  
  
  
  
  const [persona, setPersona] = React.useState({ loading: false, busy: false, err: '', note: '', no: '', values: null, overrides: {} });

   
  const loadPersona = React.useCallback((no) => {
    if (!urls || !urls.persona) {
      setPersona((p) => ({ ...p, loading: false, err: '暂时读不到页面数据（插件后台没有响应）' }));
      return;
    }
    setPersona((p) => ({ ...p, loading: true, err: '' }));
    pcGetJson(urls.persona, null).then((j) => {
      if (j === null) {
        setPersona((p) => ({ ...p, loading: false, err: '读取失败（插件后台暂时不可用）' }));
        return;
      }
      const ov = (j.overrides && typeof j.overrides === 'object') ? j.overrides : {};
      const pick = String(no || Object.keys(ov)[0] || '');
      setPersona((p) => ({ ...p, loading: false, err: '', overrides: ov, no: pick, values: pcPersonaDraft(pcBaseCardByNo(pick), ov[pick]) }));
    });
  }, [urls]);

  
  React.useEffect(() => {
    if (tab === 'persona') loadPersona(persona.no);
  }, [tab]);

   

   
  const savePersona = async (values, no, overrides) => {
    const vv = values || persona.values;
    const nn = String(no || persona.no || '');
    const ov = overrides || persona.overrides || {};
    if (!nn || !vv) return;
    if (!urls || !urls.persona) {
      setPersona((p) => ({ ...p, err: '暂时读不到页面数据（插件后台没有响应）' }));
      return;
    }
    const all = Object.assign({}, ov);
    all[nn] = personaPackage(vv);
    setPersona((p) => ({ ...p, busy: true, err: '', note: '' }));
    const r = await pcSend('POST', urls.persona, null, all, null);
    if (!r.ok || !r.json || r.json.ok !== true) {
      const j = r.json || {};
      const why = j.reason ? String(j.reason) : (r.error ? String(r.error) : ('HTTP ' + r.status));
      setPersona((p) => ({ ...p, busy: false, err: '保存被拒：' + why }));
      return;
    }
    const nextOv = (r.json.overrides && typeof r.json.overrides === 'object') ? r.json.overrides : {};
    pcSetPersonaOverrides(nextOv);
    dpcPersonaRepaint();
    setPersona((p) => ({ ...p, busy: false, err: '', note: '已保存：HUD / 图鉴 / 选模型菜单已用新文案（刷新页面也还在）', overrides: nextOv, values: pcPersonaDraft(pcBaseCardByNo(p.no), nextOv[p.no]) }));
  };

   
  const resetPersonaCard = async () => {
    const nn = String(persona.no || '');
    if (!nn) return;
    if (!urls || !urls.persona) {
      setPersona((p) => ({ ...p, err: '暂时读不到页面数据（插件后台没有响应）' }));
      return;
    }
    setPersona((p) => ({ ...p, busy: true, err: '', note: '' }));
    const r = await pcSend('DELETE', urls.persona, { no: nn }, null, null);
    if (!r.ok || !r.json || r.json.ok !== true) {
      const j = r.json || {};
      const why = j.reason ? String(j.reason) : (r.error ? String(r.error) : ('HTTP ' + r.status));
      setPersona((p) => ({ ...p, busy: false, err: '重置被拒：' + why }));
      return;
    }
    const nextOv = (r.json.overrides && typeof r.json.overrides === 'object') ? r.json.overrides : {};
    pcSetPersonaOverrides(nextOv);
    dpcPersonaRepaint();
    setPersona((p) => ({ ...p, busy: false, err: '', note: '这张卡已恢复默认（自定义内容已清除）', overrides: nextOv, values: pcPersonaDraft(pcBaseCardByNo(p.no), nextOv[p.no]) }));
  };

   
  const resetPersonaField = (key) => {
    const nn = String(persona.no || '');
    const base = pcBaseCardByNo(nn);
    const values = JSON.parse(JSON.stringify(persona.values || {}));
    pcPersonaSetValue(values, key, pcPersonaDefault(base, key));
    setPersona((p) => ({ ...p, values, err: '', note: '' }));
    savePersona(values, nn, persona.overrides);
  };

   

  const panelPersona = () => {
    const base = pcBaseCardByNo(persona.no);
    const values = persona.values;
    const cardList = (typeof PROVIDERS !== 'undefined' && Array.isArray(PROVIDERS.cards)) ? PROVIDERS.cards : [];
    return h('div', { className: 'dpc-set-panel', 'data-panel': 'persona', key: 'persona' },
      h('span', { className: 'dpc-set-sec', style: { marginTop: 0 } }, '文案'),
      h('span', { className: 'dpc-set-cap' }, '改文案只影响你这台机器：改动保存在插件自己的数据里，卡面原始文案一个字不动；保存后 HUD、图鉴、选模型菜单当场用新文案，刷新页面也还在。形态专属台词按卡上已有的档位逐行列出，行数跟卡面一样，不能加行；沿用家族卡人设的那一档不在这里改。'),
      h('div', { className: 'dpc-set-line' },
        h('select', {
          value: persona.no,
          onChange: (e) => loadPersona(e.target.value),
        }, h('option', { value: '' }, '（选一张卡）'),
          cardList.map((c) => h('option', { key: String(c.no), value: String(c.no) },
            String(c.no) + ' · ' + ((c.persona && c.persona.name) || '—')))),
        h('button', { className: 'dpc-btn', onClick: () => loadPersona(persona.no), disabled: persona.loading }, persona.loading ? '…' : '刷新'),
        persona.no ? h('button', { className: 'dpc-btn', onClick: resetPersonaCard, disabled: persona.busy }, '这张卡全部重置') : null),
      
      persona.err ? h('div', { className: 'dpc-set-err' }, persona.err) : null,
      persona.note ? h('div', { className: 'dpc-set-cap' }, persona.note) : null,
      base ? h('div', { className: 'dpc-set-cap' }, '只读（不可改）：编号 ' + String(base.no)
        + ' · 配色 ' + ((base.c || []).join(' ') || '—')
        + ' · 分数 ' + (base.base ? Object.keys(base.base).map((k) => k + ' ' + base.base[k]).join(' / ') : '未上榜')
        + ' · 技能机制说明（第三列）只读。') : null,
      ...pcPersonaFields(base).map((f) => h('div', { className: 'dpc-set-line', key: 'pf-' + f.key },
        field(f.label, h('input', {
          type: 'text',
          value: values ? pcPersonaValue(values, f.key) : '',
          placeholder: pcPersonaDefault(base, f.key),
          style: (values && pcPersonaValue(values, f.key) !== pcPersonaDefault(base, f.key))
            ? undefined
            : { color: 'var(--dsw-alias-label-quaternary,#6f6f76)' },
          onChange: (e) => {
            const next = JSON.parse(JSON.stringify(values || {}));
            pcPersonaSetValue(next, f.key, e.target.value);
            setPersona((p) => ({ ...p, values: next, err: '', note: '' }));
          },
        })),
        h('button', { className: 'dpc-btn', onClick: () => resetPersonaField(f.key) }, '恢复默认'))),
      persona.no ? h('div', { className: 'dpc-set-line' },
        h('button', { className: 'dpc-btn', onClick: () => savePersona(), disabled: persona.busy }, persona.busy ? '保存中…' : '保存这张卡的文案')) : null);
  };

  const panelCards = () => {
    
    const main = galleryCards.filter((c) => c.source !== 'data' || c.bound);
    const locked = galleryCards.filter((c) => c.source === 'data' && !c.bound);
    const listed = showLocked ? main.concat(locked) : main;
    return h('div', { className: 'dpc-set-panel', 'data-panel': 'cards', key: 'cards' },
      h('span', { className: 'dpc-set-sec', style: { marginTop: 0 } }, '图鉴'),
      h('span', { className: 'dpc-set-cap', style: { marginTop: 0 } },
        '图鉴：配过 CG 的角色卡。点一张卡展开它的四个格子，每个格子直接从素材里挑一张图。'),
      h('div', { className: 'dpc-set-rows' },
        listed.length === 0 ? h('span', { className: 'dpc-set-empty' }, '没有可显示的卡。') : null,
        listed.map((card) => h('div', {
          className: 'dpc-set-row' + (gallerySel === card.key ? ' dpc-gallery-sel' : ''),
          key: card.key,
          
          'data-card-source': card.source || 'curated',
          'data-card-id': card.key,
          style: { cursor: 'pointer' },
          onClick: () => setGallerySel(card.key),
        },
          
          
          dpcAssetThumb(card.thumb, card.thumbKind, '未解锁', '已绑定（无缩略图）'),
          h('b', {}, (card.no === '—' ? '' : card.no + ' ') + card.name + (card.imported ? '（导入）' : '')),
          h('span', {}, card.title || (card.imported ? card.key : '')),
          h('span', {
            className: 'dpc-set-unlock',
            'data-unlock': card.bound ? '1' : '0',
            'data-bench-generated-at': card.source === 'data' ? (card.generatedAt || '') : null,
          }, card.source === 'data'
            
            
            
            
            
            
            ? '公开分数 · ' + dpcGeneratedText(card.generatedAt, '生成')
            : (card.bound ? '已解锁 ' + card.rows.length + ' 条绑定' : '未解锁'))))),
      locked.length ? h('div', { className: 'dpc-set-line', style: { marginTop: 8 } },
        h('button', { className: 'dpc-btn', onClick: () => setShowLocked(!showLocked) },
          '另有 ' + locked.length + ' 张未解锁' + (showLocked ? '（收起）' : '（点这里展开）'))) : null,
      gallerySelRow ? cardDetail() : null);
  };

   
  const cardDetail = () => gallerySelRow ? h('div', { className: 'dpc-set-gallery-detail' },
    h('div', { className: 'dpc-set-gallery-head' },
      h('b', {}, (gallerySelRow.no === '—' ? '' : gallerySelRow.no + ' ') + gallerySelRow.name + (gallerySelRow.imported ? '（导入）' : '')),
      
      h('button', {
        className: 'dpc-btn',
        style: { marginLeft: 'auto' },
        onClick: () => { setGallerySel(null); setPickSlot(''); setPickQuery(''); },
      }, '收起')),
    
    
    gallerySelRow.thumb ? h('img', {
      className: 'dpc-set-gallery-big',
      'data-gallery-big': gallerySelRow.key,
      src: gallerySelRow.thumb,
      alt: (gallerySelRow.no === '—' ? '' : gallerySelRow.no + ' ') + gallerySelRow.name + ' 的 CG',
    }) : null,
    h('span', { className: 'dpc-set-cap' }, gallerySelRow.title || gallerySelRow.key),
    
    gallerySelRow.source === 'data'
      ? h('span', { className: 'dpc-set-cap', 'data-bench-generated-at': gallerySelRow.generatedAt || '' },
        
        
        
        '模型 ' + (gallerySelRow.benchModel || '') + ' · ' + dpcGeneratedText(gallerySelRow.generatedAt, '数据生成'))
      : null,
    gallerySelRow.summon ? h('p', {}, gallerySelRow.summon) : null,
    gallerySelRow.skills && gallerySelRow.skills.length
      ? h('ul', {}, gallerySelRow.skills.map((s, i) => h('li', { key: i }, s[0] + '：' + s[1])))
      : null,
    h('div', { className: 'dpc-set-slots' }, slots.map((slot) => slotCell(gallerySelRow, slot))),
    pickerFor(gallerySelRow))
    : null;

  return h('div', { className: 'dpc-set-root', ref: dpcSetPanelSkin, style: { display: 'block' } },
    
    
    
    h('style', null, DPC_SET_CSS),
    
    
    
    h('style', null, DPC_SET_SKIN_CSS),
    h('span', { className: 'dpc-set-label' }, '角色卡'),
    h('span', { className: 'dpc-set-hint' }, '模型卡片与 CG 氛围层：给哪个模型配哪张图'),
    h('div', { className: 'dpc-set-line' },
      h('span', {}, data.loading ? dpcT('读取中…') : dpcT('已配图 ') + data.rows.length + dpcT(' 处 · 素材 ') + data.assets.length + dpcT(' 个 · 上限 ') + configText),
      h('button', { className: 'dpc-btn', onClick: reload, disabled: data.loading }, data.loading ? '…' : '刷新')),
    data.err ? h('div', { className: 'dpc-set-err' }, '状态：' + data.err) : null,

    
    
    
    h('div', { className: 'dpc-set-tabs', role: 'tablist' }, DPC_SET_TABS.map((t) => h('button', {
      key: t.id,
      type: 'button',
      role: 'tab',
      'data-tab': t.id,
      'aria-selected': tab === t.id ? 'true' : 'false',
      className: 'dpc-set-tab' + (tab === t.id ? ' dpc-set-tab-on' : ''),
      onClick: () => setTab(t.id),
    }, t.label))),

    dpcSetPanelOf(tab, 'overview', panelOverview()),
    dpcSetPanelOf(tab, 'cards', panelCards()),
    dpcSetPanelOf(tab, 'persona', panelPersona()),
    dpcSetPanelOf(tab, 'pack', h('div', { className: 'dpc-set-panel', 'data-panel': 'pack', key: 'pack' },
    
    h('span', { className: 'dpc-set-cap', style: { marginTop: 0 } },
      '角色包就是一个 .pcpack 文件：可以把整套配图搬给同事，也可以把同事做的整套收进来。'),
    h('span', { className: 'dpc-set-sec' }, '角色包（.pcpack）'),
    h('span', { className: 'dpc-set-cap' }, '导出会把全部绑定与用到的素材打包成一个文件（署名与授权信息一同带走）；导入时自动检查文件并去重，损坏的文件不会写入。'),
    h('div', { className: 'dpc-set-line' },
      h('button', { className: 'dpc-btn', onClick: exportPack, disabled: busy !== '' }, busy === 'export' ? '导出中…' : '导出角色包'),
      h('input', {
        type: 'file',
        accept: '.pcpack,.json,application/json',
        style: { width: 200 },
        onChange: (e) => setPackFile(e.target.files && e.target.files.length ? e.target.files[0] : null),
      }),
      h('button', { className: 'dpc-btn', onClick: importPack, disabled: busy !== '' }, busy === 'imp' ? '导入中…' : '导入角色包')))),

    dpcSetPanelOf(tab, 'cg', h('div', { className: 'dpc-set-panel', 'data-panel': 'cg', key: 'cg' },
    
    
    
    h('span', { className: 'dpc-set-cap', style: { marginTop: 0 } },
      '按服务商或全局绑定：填「给谁用 / 服务商 / 模型 / 在哪个状态出现」，再选素材。只想给某张卡配图的话，去「角色卡」页点格子更快。'),
    h('span', { className: 'dpc-set-sec' }, '给谁用这张图'),
    h('span', { className: 'dpc-set-cap' }, '一条绑定＝「给谁用」＋「在哪个状态出现」（可以再限定只用在哪个画面），对应一张素材。同一处配了多条时，越具体的越优先；按模型配置时，跨通道的同一张卡算同一处；按形态配置时，同形态的其它型号共用一套。'),
    h('span', { className: 'dpc-set-cap' },
      '「给谁用」 ',
      
      h('button', {
        className: 'dpc-set-q',
        type: 'button',
        title: '越具体的越优先：按模型 > 按卡（精确）> 按形态 > 按卡（代表）> 按服务商 > 全局默认；同一条里「状态」比「画面」优先',
      }, '?')),
    pendingSlots.length ? h('span', { className: 'dpc-set-cap' }, '这两槽的显示时机还没开放，暂不可编辑（已存绑定不会生效）') : null,
    pairs.length > 0 ? field('从已配置的通道/模型带入', h('select', {
      value: '',
      onChange: (e) => {
        const p = pairs.filter((x) => (x.provider + '/' + x.model) === e.target.value)[0];
        if (!p) { set({ provider: '', model: '' }); return; }
        const pSlots = (p.slots || []).filter((s) => pendingSlots.indexOf(s) < 0);
        set({ scope: p.model ? 'model' : 'provider', provider: p.provider, model: p.model, slot: pSlots.length ? pSlots[0] : form.slot });
      },
    }, h('option', { value: '' }, '（选一个已配置的 provider/model）'),
      pairs.map((p) => h('option', { key: p.provider + '/' + p.model, value: p.provider + '/' + p.model },
        p.model ? p.provider + '/' + p.model : p.provider + '（整家）' + ' · ' + p.slots.join('/'))))) : null,
    h('div', { className: 'dpc-set-grid' },
      field('这张图给谁用', h('select', { value: form.scope, onChange: (e) => set({ scope: e.target.value }) },
        h('option', { value: '' }, '自动（选最具体的那一档）'),
        scopes.map((s) => h('option', { key: s, value: s }, dpcSetScopeText(s) || SCOPE_TEXT[s] || s)))),
      field('服务商', h('input', { type: 'text', value: form.provider, placeholder: '如 openai', onChange: (e) => set({ provider: e.target.value }) })),
      field('模型', h('input', {
        type: 'text',
        value: form.model,
        disabled: form.scope === 'provider' || form.scope === 'default' || undefined,
        
        
        placeholder: form.scope === 'model' ? '如 gpt-5' : (form.scope === 'card' ? '如 glm-5.3-flash（按身份归一，跨通道同一张卡）' : (form.scope === 'form' ? '如 glm-5.3-flash（服务端据此判形态，同形态共用）' : '（这一档不用填）')),
        onChange: (e) => set({ model: e.target.value }),
      })),
      field('在哪个状态出现', h('select', { value: form.slot, onChange: (e) => set({ slot: e.target.value }) },
        editableSlots.map((s) => h('option', { key: s, value: s }, dpcSetSlotText(s))))),
      field('只用在哪个画面', h('select', { value: form.variant, onChange: (e) => set({ variant: e.target.value }) },
        h('option', { value: '' }, '不限定（所有画面都用）'),
        variants.map((v) => h('option', { key: v, value: v }, v === 'hud' ? '氛围层小窗' : (v === 'full' ? '整屏大图' : v)))))),
    
    form.variant === ''
      ? h('span', { className: 'dpc-set-cap', 'data-variant-hint': hudAtScope ? 'strong' : 'weak' },
        hudAtScope
          ? '不指定专用图＝沿用通用绑定；当前已有专用绑定，保存后不会生效'
          : '不指定专用图＝沿用通用绑定；若该槽已有 HUD 专用绑定，它会被专用绑定遮住')
      : null,
    h('div', { className: 'dpc-set-grid' },
      field('用哪张素材', h('select', { value: form.assetId, onChange: (e) => set({ assetId: e.target.value }) },
        h('option', { value: '' }, '（选一张素材）'),
        data.assets.map((a) => h('option', { key: a.id, value: a.id }, (a.name || a.id.slice(0, 8)) + ' · ' + a.kind)))),
      field('视频的首帧图', h('select', { value: form.posterAssetId, onChange: (e) => set({ posterAssetId: e.target.value }) },
        h('option', { value: '' }, '不用'),
        data.assets.map((a) => h('option', { key: a.id, value: a.id }, a.name || a.id.slice(0, 8))))),
      field('铺满方式', h('select', { value: form.fit, onChange: (e) => set({ fit: e.target.value }) },
        h('option', { value: '' }, '默认'),
        fits.map((f) => h('option', { key: f, value: f }, f)))),
      field('画面焦点', h('input', { type: 'text', value: form.objectPosition, placeholder: '如 center / 50% 30%', onChange: (e) => set({ objectPosition: e.target.value }) })),
      field('署名', h('input', { type: 'text', value: form.credit, placeholder: '如 A.B / C.D（卡片署名，可空）', onChange: (e) => set({ credit: e.target.value }) }))),
    h('div', { className: 'dpc-set-check' },
      h('span', {}, '循环播放'), triSelect(form.loop, (v) => set({ loop: v })),
      h('span', { style: { marginLeft: 10 } }, '静音'), triSelect(form.muted, (v) => set({ muted: v }))),
    h('div', { className: 'dpc-set-tools' },
      h('button', { className: 'dpc-btn', onClick: saveBinding, disabled: busy !== '' }, busy === 'save' ? '保存中…' : '保存这条绑定'),
      form.key ? h('button', { className: 'dpc-btn', onClick: () => clearBinding(form.key), disabled: busy !== '' }, '删除这条绑定') : null,
      h('button', { className: 'dpc-btn', onClick: () => { setForm(blankForm(slots)); setMsg({ tone: '', text: '' }); } }, '重置表单'),
      form.assetId ? h('span', { className: 'dpc-set-cap', style: { margin: 0 } }, '预览') : null,
      form.assetId ? dpcAssetThumb(pcMediaUrl(form.assetId), assetById[form.assetId] ? assetById[form.assetId].kind : '', '素材不可用', '已绑定（无缩略图）') : null),

    
    h('span', { className: 'dpc-set-sec' }, '已经配好的图'),
    h('span', { className: 'dpc-set-cap' }, '按卡或按状态筛一筛，点「删除」立刻生效。'),
    h('div', { className: 'dpc-set-filters' },
      h('span', {}, '只看：'),
      h('select', { value: rowCard, onChange: (e) => setRowCard(e.target.value) },
        h('option', { value: '' }, '所有卡'),
        rowCards().map((c) => h('option', { key: c, value: c }, c))),
      h('select', { value: rowSlot, onChange: (e) => setRowSlot(e.target.value) },
        h('option', { value: '' }, '所有状态'),
        slots.map((s) => h('option', { key: s, value: s }, dpcSetSlotText(s))))),
    h('div', { className: 'dpc-set-rows' },
      shownRows().length === 0
        ? h('span', { className: 'dpc-set-empty' },
          data.rows.length === 0 ? '还没有任何绑定。填好上面的几栏、选一张素材，点「保存这条绑定」。' : '这个筛选下没有绑定，换个筛选试试。')
        : null,
      shownRowsPage().map((row) => h('div', {
        className: 'dpc-set-row',
        key: row.key,
      },
        h('b', {}, scopeLabel(row)),
        h('span', {}, dpcSetSlotText(row.slot) + (row.variant ? ' · ' + row.variant : '') + (pendingSlots.indexOf(row.slot) >= 0 ? '（显示时机还没开放，现在绑定不会生效）' : '')),
        h('span', {}, '→ ' + nameOf(row.assetId) + (data.stale.indexOf(row.key) >= 0 ? '（素材已缺失）' : '')),
        h('i', {}, row.updatedAt ? String(row.updatedAt).slice(0, 10) : ''),
        h('button', { className: 'dpc-btn', onClick: () => loadRow(row) }, '编辑'),
        h('button', { className: 'dpc-btn', onClick: () => clearBinding(row.key), disabled: busy !== '' }, '删除')))),
    moreRow(shownRowsPage().length, shownRows().length, () => setRowsLimit(rowsLimit + DPC_SET_PAGE)),

    
    h('span', { className: 'dpc-set-sec' }, 'CG 素材'),
    h('span', { className: 'dpc-set-cap' }, '上传后由服务端实测签名定类型；只允许删除没有被任何绑定引用的素材（被引用时服务端退回引用清单，素材保留）。'),
    h('div', { className: 'dpc-set-tools' },
      h('input', {
        type: 'file',
        style: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary,#8d8d95)', maxWidth: '320px' },
        onChange: (e) => {
          const f = e.target.files && e.target.files[0];
          setPicked(f || null);
          if (f) setMsg({ tone: '', text: '待上传：' + f.name + '（' + Math.round(f.size / 1024) + ' KiB）' });
        },
      }),
      h('button', { className: 'dpc-btn', onClick: upload, disabled: busy !== '' || !picked }, busy === 'up' ? '上传中…' : '上传')),
    h('div', { className: 'dpc-set-rows' },
      data.assets.length === 0 ? h('span', { className: 'dpc-set-empty' }, '素材库是空的：点上面选个文件上传，或去「角色包」页导入一个 .pcpack。') : null,
      shownAssetsPage().map((a) => {
        const url = pcMediaUrl(a.id);
        const refs = inUse(a.id);
        return h('div', { className: 'dpc-set-row', key: a.id },
          
          
          dpcAssetThumb(url, a.kind, '素材不可用'),
          h('b', {}, a.name || a.id.slice(0, 8)),
          h('span', {}, a.kind + ' · ' + Math.max(1, Math.round(a.bytes / 1024)) + ' KiB' + (refs ? dpcT(' · 被引用 ') + refs.length + dpcT(' 处') : dpcT(' · 未引用'))),
          h('i', {}, a.createdAt ? String(a.createdAt).slice(0, 10) : ''),
          h('button', { className: 'dpc-btn', onClick: () => set({ assetId: a.id }) }, '选为素材'),
          h('button', { className: 'dpc-btn', onClick: () => removeAsset(a.id), disabled: busy !== '' }, busy === 'rm-' + a.id ? '…' : '删除'),
      )})),
    moreRow(shownAssetsPage().length, data.assets.length, () => setAssetsLimit(assetsLimit + DPC_SET_PAGE)))),
    msg.text ? h('div', { className: 'dpc-set-msg', 'data-tone': msg.tone === 'err' ? 'err' : undefined }, msg.text) : null);
}

 
function announceSkinBridgeReady() {
  if (typeof window === 'undefined' || typeof CustomEvent !== 'function') return false;
  try {
    window.dispatchEvent(new CustomEvent('dsh-provider-card:skin-bridge-ready', { detail: { apiVersion: 1 } }));
    return true;
  } catch (_error) {
    return false;
  }
}


function apply(ctx) {
  
  
  
  try {
    Object.defineProperty(globalThis, '__DSH_PROVIDER_CARD_SKIN_ADAPTERS__', {
      value: {
        apiVersion: 1,
        register: registerSkinAdapter,
        unregister: unregisterSkinAdapter,
        list: listSkinAdapters,
      },
      configurable: true,
      enumerable: false,
      writable: true,
    });
  } catch (_error) {   }
  
  
  
  
  
  
  
  announceSkinBridgeReady();
  
  registerSkinAdapter(builtinDswGenericAdapter());

  
  
  ctx.effect(() => {
    ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
      name: 'conversation.composer.dock',
      id: 'dsh-provider-card',
      order: 20,
      locale: '@local/dsh-provider-card/locale/en.json',
      
      
      
      inject: (sessionId) => ({
        rpc: (() => {
          try { return ctx.get('connection')?.rpc; } catch (_error) { return undefined; }
        })(),
        ctx,
        sessionId,
      }),
    }, ProviderCardProbe));
  }, 'dsh-provider-card: dock seat');
  
  
  
  
  
  ctx.effect(() => {
    ctx.slots.inject(DPC_HUD_NEWSESSION_SLOT, () => ctx.slots.register({
      name: DPC_HUD_NEWSESSION_SLOT,
      id: 'dsh-provider-card-new-session',
      
      
      order: 30,
      
      
      inject: () => ({ ctx }),
    }, ProviderCardNewSession));
  }, 'dsh-provider-card: new session seat');
  
  
  ctx.effect(() => {
    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: 'provider-card',
      order: 85,
      label: () => '角色卡',
      inject: () => ({
        mount: (() => {
          try { return globalThis.__DSH_PROVIDER_CARD__; } catch (_error) { return undefined; }
        })(),
      }),
    }, ProviderCardSettings));
  }, 'dsh-provider-card: settings section');
  
  
  
  ctx.effect(() => {
    try { dpcPickerMount(ctx); } catch (_error) {   }
    return () => { try { dpcPickerUnmount(); } catch (_error) {   } };
  }, 'dsh-provider-card: picker 卡面化');
}




const dpcT2 = (typeof dpcT === 'function') ? dpcT : ((t) => t);














const DPC_PICK_MENU_LABEL = '模型';
const DPC_PICK_STYLE_ID = 'dpc-pick-style';
const DPC_PICK_HEADING_MAX = 72;







const DPC_PICK_SEAT_MAX_PX = 56;      
const DPC_PICK_SEAT_NAME_CHARS = 4;   











const DPC_PICK_TRIGGER_DOT_PX = 200;  
const DPC_PICK_TRIGGER_HIDE_PX = 160; 

const DPC_PICK_ROW_MAX_PX = 320;




const DPC_PICK_SEAT_TIER_ATTR = 'data-dpc-seat-tier';



function dpcPickerTrim(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

 
function dpcPickerKeyOf(value) {
  const bare = dpcPickerTrim(value).replace(/[(（][^)）]*[)）]/g, ' ');
  return dpcPickerTrim(bare).toLowerCase();
}

 
function dpcPickerProviderOf(heading, groups) {
  const list = Array.isArray(groups) ? groups : [];
  const raw = dpcPickerTrim(heading);
  if (!raw) return { id: '', name: '', how: 'none', group: null };
  let hit = null;
  let how = 'none';
  for (const g of list) {
    if (g && dpcPickerTrim(g.name) === raw) { hit = g; how = 'exact'; break; }
  }
  if (!hit) {
    const key = dpcPickerKeyOf(raw);
    for (const g of list) {
      if (g && dpcPickerKeyOf(g.name) === key) { hit = g; how = 'loose'; break; }
    }
  }
  return {
    id: hit ? dpcPickerTrim(hit.id) : '',
    name: hit ? dpcPickerTrim(hit.name) : raw,
    how,
    group: hit || null,
  };
}

 
function dpcPickerModelIdOf(row, group) {
  const info = row || {};
  const fiber = dpcPickerTrim(info.modelId);
  if (fiber) return { id: fiber, how: 'fiber' };
  const models = group && Array.isArray(group.models) ? group.models : [];
  const title = dpcPickerTrim(info.title);
  if (!title || models.length === 0) return { id: '', how: 'none' };
  let hit = null;
  let how = 'none';
  for (const m of models) {
    if (m && dpcPickerTrim(m.name) === title) { hit = m; how = 'name'; break; }
  }
  if (!hit) {
    const key = dpcPickerKeyOf(title);
    for (const m of models) {
      if (m && dpcPickerKeyOf(m.name) === key) { hit = m; how = 'name'; break; }
    }
  }
  return hit ? { id: dpcPickerTrim(hit.id), how } : { id: '', how: 'none' };
}





 
const DPC_PICK_NO_EFFORT = null;
function dpcPickerStatRows(card, effort, date, provider) {
  if (!card) return [];
  const stats = statsOf(card, DPC_PICK_NO_EFFORT, date, provider);
  const out = [];
  let hasAny = false;
  for (const key of Object.keys(stats)) {
    const cell = stats[key];
    
    
    
    const v = dpcAxisHasValue(null, cell) ? cell.v : null;
    if (v != null) hasAny = true;
    out.push({ key, v, text: statText(v) });
  }
  
  if (!hasAny) return [];
  return out;
}

 
function dpcPickerDescribe(entry, index, groups, opts) {
  const row = entry || {};
  const options = opts || {};
  const date = options.date instanceof Date ? options.date : new Date();
  const pv = dpcPickerProviderOf(row.heading, groups);
  const mv = dpcPickerModelIdOf(row, pv.group);
  
  
  const model = mv.id || dpcPickerTrim(row.model);
  const modelHow = mv.id ? mv.how : (model ? dpcPickerTrim(row.modelHow) || 'carried' : 'none');
  const identity = model ? normModel(model) : '';
  const known = !!identity;
  
  
  const plan = known ? dpcCardPlan(dpcPickerTrim(pv.id), dpcPickerTrim(model)) : null;
  const card = plan ? plan.card : null;
  const kind = !known ? 'unknown' : (card && card.generic ? 'generic' : (card && card.dataCard ? 'data' : 'card'));
  const twinList = known && index && typeof index.get === 'function' ? (index.get(identity) || []) : [];
  
  const twins = twinList.filter((t) => t.providerId !== pv.id || dpcPickerTrim(t.model) !== model);
  
  const statRows = dpcPickerStatRows(card, options.effort == null ? null : options.effort, date, pv.id);
  return {
    heading: dpcPickerTrim(row.heading),
    title: dpcPickerTrim(row.title),
    providerId: pv.id,
    providerName: pv.name,
    providerHow: pv.how,
    model,
    modelHow,
    identity,
    kind,
    known,
    no: card ? dpcPickerTrim(card.no) : '',
    color: card && Array.isArray(card.c) ? dpcPickerTrim(card.c[0]) : '',
    color2: card && Array.isArray(card.c) ? dpcPickerTrim(card.c[1]) : '',
    name: card && card.persona ? dpcPickerTrim(card.persona.name) : dpcPickerTrim(row.title),
    
    title2: plan ? dpcPickerTrim(plan.title) : '',
    
    
    
    
    familyKey: card && card.family ? dpcPickerTrim(card.family.no) : '',
    familyName: card && card.family ? dpcPickerTrim(card.family.name) : '',
    familyLatin: card && card.family ? dpcPickerTrim(card.family.latin) : '',
    tierKey: card && card.tier ? dpcPickerTrim(card.tier.key) : '',
    tierLevel: card && card.tier && Number.isFinite(card.tier.level) ? card.tier.level : null,
    tierValue: card && card.tier ? dpcPickerTrim(card.tier.value) : '',
    
    tierAttr: card && card.tier && card.tier.attr ? dpcPickerTrim(card.tier.attr) : '',
    channel: known ? dpcPickerTrim(channelLabel(pv.id, model, { name: pv.name })) : '',
    stats: statRows,
    twinCount: twins.length,
    twinChannels: twins
      .map((t) => dpcPickerTrim(t.providerName) || dpcPickerTrim(t.heading))
      .filter((label, i, arr) => label && arr.indexOf(label) === i),
    twinModels: twins.map((t) => dpcPickerTrim(t.model)).filter((m, i, arr) => m && arr.indexOf(m) === i),
  };
}

 
function dpcPickerKindText(kind) {
  if (kind === 'card') return '精选卡';
  if (kind === 'data') return '数据卡';
  if (kind === 'generic') return '通用卡';
  return '未识别';
}

 
function dpcPickerBadge(desc) {
  const d = desc || {};
  return {
    no: d.no || '—',
    source: d.kind === 'card' ? 'curated' : (d.kind === 'data' ? 'data' : (d.kind === 'generic' ? 'generic' : 'none')),
    kindText: dpcPickerKindText(d.kind),
    color: d.color || '',
    name: d.name || d.title || '',
    title: d.title2 || '',
  };
}

 
function dpcPickerStrip(desc, limit) {
  const d = desc || {};
  const badge = dpcPickerBadge(d);
  const max = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 3;
  return {
    badge,
    identity: d.identity || '',
    stats: (Array.isArray(d.stats) ? d.stats : []).slice(0, max),
    twinCount: Number.isFinite(d.twinCount) ? d.twinCount : 0,
    twinText: d.twinCount > 0 ? '同身份 ×' + (d.twinCount + 1) : '',
    
    title: [badge.no, badge.kindText, badge.name || badge.title].filter(Boolean).join(' · ')
      || (badge.title || badge.name),
  };
}

 
function dpcPickerSeatName(name) {
  const s = dpcPickerTrim(name);
  if (s.length <= DPC_PICK_SEAT_NAME_CHARS) return s;
  return s.slice(0, DPC_PICK_SEAT_NAME_CHARS);
}



















 
function dpcPickerFamilyStem(model) {
  const norm = normModel(dpcPickerTrim(model));
  if (!norm) return '';
  const head = norm.split('-')[0];
  return head.replace(/\d+$/, '');
}

 
let dpcPickerFamilyRoleMap = null;
function dpcPickerFamilyRoles() {
  if (dpcPickerFamilyRoleMap) return dpcPickerFamilyRoleMap;
  const map = {};
  const cards = PROVIDERS && Array.isArray(PROVIDERS.cards) ? PROVIDERS.cards : [];
  for (const card of cards) {
    const name = card && card.persona ? dpcPickerTrim(card.persona.name) : '';
    if (!name) continue;
    const models = Array.isArray(card.members) && card.members.length
      
      
      ? card.members.map((m) => (m && typeof m === 'object' ? m.model : m))
      : [card.model];
    for (const m of models) {
      const stem = dpcPickerFamilyStem(m);
      if (stem && !map[stem]) map[stem] = name;
    }
  }
  dpcPickerFamilyRoleMap = map;
  return map;
}

 
function dpcPickerSeatRole(desc) {
  const d = desc || {};
  
  const family = dpcPickerTrim(d.familyName);
  if (family) return dpcPickerSeatName(family);
  
  const own = dpcPickerTrim(d.name);
  if (own && Array.from(own).length <= DPC_PICK_SEAT_NAME_CHARS) return own;
  
  const stem = dpcPickerFamilyStem(d.model || own);
  if (stem) {
    const role = dpcPickerTrim(dpcPickerFamilyRoles()[stem]);
    if (role) return dpcPickerSeatName(role);
  }
  
  
  const norm = normModel(dpcPickerTrim(d.model || own));
  const first = norm ? norm.split('-')[0] : '';
  if (first && Array.from(first).length <= DPC_PICK_SEAT_NAME_CHARS) return first;
  
  return '';
}

 
function dpcPickerSeatStrip(desc, dotOnly) {
  const d = desc || {};
  const badge = dpcPickerBadge(d);
  const only = !!dotOnly;
  const full = badge.name || d.title || '';
  
  
  
  const role = dpcPickerSeatRole(d);
  return {
    badge,
    dotOnly: only,
    name: only ? '' : dpcPickerSeatName(role),
    
    title: [badge.no, badge.kindText, full].filter(Boolean).join(' · ') || full,
  };
}

 
function dpcPickerTriggerWidth(host) {
  try {
    if (!host) return null;
    let base = 0;
    if (Number.isFinite(host.clientWidth) && host.clientWidth > 0) base = host.clientWidth;
    if (!base && typeof host.getBoundingClientRect === 'function') {
      const rect = host.getBoundingClientRect();
      if (rect && Number.isFinite(rect.width) && rect.width > 0) base = rect.width;
    }
    if (!base) return null;
    let pad = 0;
    if (typeof getComputedStyle === 'function') {
      const cs = getComputedStyle(host);
      
      
      
      
      const cap = cs ? parseFloat(cs.maxWidth) : NaN;
      if (Number.isFinite(cap) && cap > base) base = cap;
      if (cs) {
        const pl = parseFloat(cs.paddingLeft);
        const pr = parseFloat(cs.paddingRight);
        if (Number.isFinite(pl)) pad += pl;
        if (Number.isFinite(pr)) pad += pr;
      }
    }
    const out = base - pad;
    return out > 0 ? out : 0;
  } catch (_error) { return null; }
}

 
function dpcPickerBadgeOuterWidth(host) {
  try {
    if (!host || typeof host.querySelector !== 'function') return 0;
    const mark = host.querySelector('.dpc-pick-mark');
    if (!mark) return 0;
    if (typeof mark.getBoundingClientRect === 'function') {
      const rect = mark.getBoundingClientRect();
      if (rect && Number.isFinite(rect.width) && rect.width > 0) return rect.width;
    }
    if (Number.isFinite(mark.offsetWidth) && mark.offsetWidth > 0) return mark.offsetWidth;
  } catch (_error) {   }
  return 0;
}

 
function dpcPickerHostTextWidth(host) {
  const total = dpcPickerTriggerWidth(host);
  if (total === null) return null;
  const out = total - dpcPickerBadgeOuterWidth(host);
  return out > 0 ? out : 0;
}

 
function dpcPickerSeatClear(host) {
  try {
    if (!host || typeof host.querySelector !== 'function') return false;
    
    
    if (typeof host.setAttribute === 'function') host.setAttribute(DPC_PICK_SEAT_TIER_ATTR, 'hidden');
    const mark = host.querySelector('.dpc-pick-mark');
    if (!mark) return false;
    if (typeof host.removeChild === 'function') { host.removeChild(mark); return true; }
    if (mark.parentNode && typeof mark.parentNode.removeChild === 'function') {
      mark.parentNode.removeChild(mark);
      return true;
    }
  } catch (_error) {   }
  return false;
}

 
function dpcPickerPreview(desc) {
  const d = desc || {};
  const badge = dpcPickerBadge(d);
  return {
    badge,
    provider: d.providerName || d.heading || '',
    identity: d.identity || '',
    channel: d.channel || '',
    stats: Array.isArray(d.stats) ? d.stats : [],
    kindText: badge.kindText,
    title: badge.title,
    twinText: d.twinCount > 0
      ? '同身份共 ' + (d.twinCount + 1) + ' 行（' + d.twinChannels.join('、') + '）'
      : '本菜单内仅此一行',
  };
}

 
function dpcPickerParseMenu(menu, groups, opts) {
  const list = Array.isArray(menu) ? menu : [];
  const index = new Map();
  const entries = [];
  for (const group of list) {
    const g = group || {};
    const pv = dpcPickerProviderOf(g.heading, groups);
    for (const raw of Array.isArray(g.rows) ? g.rows : []) {
      const row = raw || {};
      const mv = dpcPickerModelIdOf(row, pv.group);
      if (!mv.id) continue;
      const identity = normModel(mv.id);
      if (!identity) continue;
      const entry = {
        heading: dpcPickerTrim(g.heading),
        title: dpcPickerTrim(row.title),
        providerId: pv.id,
        providerName: pv.name,
        model: mv.id,
        modelHow: mv.how,
        identity,
      };
      if (!index.has(identity)) index.set(identity, []);
      index.get(identity).push(entry);
      entries.push(entry);
    }
  }
  return entries.map((entry) => dpcPickerDescribe(entry, index, groups, opts));
}

 
function dpcPickerMenuPlan(descs) {
  const list = Array.isArray(descs) ? descs : [];
  const roles = [];
  const groups = new Map();
  for (let i = 0; i < list.length; i += 1) {
    const d = list[i] || {};
    const familyKey = d.familyKey || '';
    if (!familyKey) {
      
      roles.push({ role: 'single', group: null, key: 'S' + '\u0000' + pairKey(d.providerId, d.model) });
      continue;
    }
    let group = groups.get(familyKey);
    if (!group) {
      group = {
        key: familyKey,
        name: d.familyName || '',
        latin: d.familyLatin || '',
        color: d.color || '',
        members: [],
        roles: [],
      };
      groups.set(familyKey, group);
    }
    group.members.push({
      model: d.model || '',
      identity: d.identity || '',
      tierKey: d.tierKey || '',
      tierLevel: d.tierLevel == null ? null : d.tierLevel,
      tierValue: d.tierValue || '',
      tierAttr: d.tierAttr || '',
      
      
      label: d.tierKey || d.model || '',
    });
    const role = { role: group.members.length === 1 ? 'head' : 'member', group: group, key: '' };
    group.roles.push(role);
    roles.push(role);
  }
  
  for (const group of groups.values()) {
    const sig = group.members.map((m) => m.model + '#' + m.tierKey).join(',');
    for (const role of group.roles) {
      role.key = (role.role === 'head' ? 'F' : 'C') + '\u0000' + group.key + '\u0000' + sig;
    }
  }
  return { roles: roles, groups: Array.from(groups.values()) };
}

 
function dpcPickerMenuStrip(desc, group) {
  const d = desc || {};
  const badge = dpcPickerBadge(d);
  const members = group && Array.isArray(group.members) ? group.members : [];
  const labels = members.map((m) => m.label).filter(Boolean);
  return {
    badge: badge,
    familyKey: group ? group.key : '',
    familyName: group ? group.name : '',
    familyLatin: group ? group.latin : '',
    members: members,
    title: [badge.no, badge.kindText, badge.name || badge.title].filter(Boolean).join(' · ')
      + (labels.length ? ' · ' + labels.join('/') : ''),
  };
}



 function dpcPickerTextOf(el) {
  if (!el) return '';
  let out = '';
  const nodes = el.childNodes;
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node.nodeType === 3) { out += node.nodeValue || ''; continue; }
    if (node.nodeType !== 1) continue;
    const role = node.getAttribute ? node.getAttribute('role') : null;
    if (node.tagName === 'BUTTON' || role === 'menuitemradio' || role === 'menuitem') continue;
    out += dpcPickerTextOf(node);
  }
  return out.replace(/\s+/g, ' ').trim();
}

 
function dpcPickerHeadingOf(section) {
  if (!section) return '';
  const nodes = section.childNodes;
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node.nodeType === 3) {
      const t = dpcPickerTrim(node.nodeValue);
      if (t) return t;
      continue;
    }
    if (node.nodeType !== 1) continue;
    const role = node.getAttribute ? node.getAttribute('role') : null;
    if (node.tagName === 'BUTTON' || role === 'menuitemradio' || role === 'menuitem') continue;
    const t = dpcPickerTextOf(node);
    if (t) return t;
  }
  return '';
}

 
function dpcPickerFiberKey(el) {
  try {
    for (const name of Object.keys(el)) {
      if (name.indexOf('__reactFiber$') !== 0 && name.indexOf('__reactInternalInstance$') !== 0) continue;
      let fiber = el[name];
      let guard = 0;
      while (fiber && guard < 64) {
        if (fiber.stateNode === el) {
          return fiber.key == null ? '' : String(fiber.key);
        }
        fiber = fiber.return;
        guard += 1;
      }
    }
  } catch (_error) {   }
  return '';
}


 
 
function dpcPickerSkinAttrs() {
  const adapter = activeSkinAdapter();
  const tokens = skinTokensOf(adapter);
  
  
  
  
  
  
  
  const plateTokens = (adapter === null || adapter === undefined)
    ? {}
    : plateTokensOf(tokens, dpcHostSchemeResolve());
  return {
    'data-skin-active': adapter === null || adapter === undefined ? '0' : '1',
    'data-skin-id': adapter === null || adapter === undefined ? null : (adapter.id || null),
    'data-skin-token-count': String(Object.keys(tokens).length),
    'data-skin-density': tokens['--dpc-density'] || null,
    style: Object.assign({}, tokens, plateTokens),
  };
}

 
function dpcPickerApplySkin(el, attrs) {
  if (!el || !attrs) return el;
  try {
    for (const k of ['data-skin-active', 'data-skin-id', 'data-skin-density']) {
      const v = attrs[k];
      if (v === null || v === undefined) el.removeAttribute(k);
      else el.setAttribute(k, v);
    }
    if (attrs['data-skin-token-count'] !== undefined) {
      el.setAttribute('data-skin-token-count', attrs['data-skin-token-count']);
    }
    const tokens = attrs.style || {};
    for (const key of Object.keys(tokens)) el.style.setProperty(key, tokens[key]);
    return el;
  } catch (_error) {
    return el;
  }
}

const DPC_PICK_SKIN_CSS = [
  
  
  '.dpc-pick-mark[data-skin-active="1"]{background:var(--dpc-surface,var(--dpc-surface-1));',
  'color:var(--dpc-text,var(--dpc-ink-1));border-color:var(--dpc-border,var(--dpc-edge));',
  'border-radius:var(--dpc-radius,6px);opacity:var(--dpc-opacity,1)}',
  
  
  '.dpc-pick-mark[data-skin-active="1"][style*="--dpc-text"]{--dpc-ink-1:var(--dpc-text);',
  '--dpc-ink-2:color-mix(in srgb,var(--dpc-text) 76%,var(--dpc-surface,var(--dpc-surface-1)));',
  
  
  
  '--dpc-ink-3:color-mix(in srgb,var(--dpc-text) 70%,var(--dpc-surface,var(--dpc-surface-1)))}',
  
  
  '.dpc-pick-mark[data-skin-active="1"] .dpc-pick-dot{background:var(--dpc-accent,var(--dpc-hatch))}',
  
  
  
  
  
  'html[data-ds-theme-source="light"] .dpc-pick-mark[data-skin-active="1"][data-dpc-source="curated"] .dpc-pick-dot,',
  'html[data-ds-theme="light"] .dpc-pick-mark[data-skin-active="1"][data-dpc-source="curated"] .dpc-pick-dot,',
  'html[data-ds-theme-source="light"] .dpc-pick-preview[data-skin-active="1"] .dpc-pick-dot,',
  'html[data-ds-theme="light"] .dpc-pick-preview[data-skin-active="1"] .dpc-pick-dot{filter:brightness(.65) saturate(1.05)}',
  '.dpc-pick-mark[data-skin-active="1"][data-skin-density="dense"]{padding:0 3px}',
  '.dpc-pick-mark[data-skin-active="1"][data-skin-density="compact"]{padding:2px 5px}',
  
  '.dpc-pick-preview[data-skin-active="1"]{background:var(--dpc-surface,var(--dpc-surface-1));',
  'color:var(--dpc-text,var(--dpc-ink-1));border-color:var(--dpc-border,var(--dpc-edge));',
  'border-radius:var(--dpc-radius,12px);opacity:var(--dpc-opacity,1)}',
  '.dpc-pick-preview[data-skin-active="1"][style*="--dpc-text"]{--dpc-ink-1:var(--dpc-text);',
  '--dpc-ink-2:color-mix(in srgb,var(--dpc-text) 76%,var(--dpc-surface,var(--dpc-surface-1)));',
  '--dpc-ink-3:color-mix(in srgb,var(--dpc-text) 70%,var(--dpc-surface,var(--dpc-surface-1)))}',
  '.dpc-pick-preview[data-skin-active="1"] .dpc-pick-preview-cell{',
  'background:color-mix(in srgb,var(--dpc-surface,var(--dpc-surface-2)) 82%,var(--dpc-text,var(--dpc-ink-1)))}',
  '.dpc-pick-preview[data-skin-active="1"] .dpc-pick-dot{background:var(--dpc-accent,var(--dpc-hatch))}',
  '.dpc-pick-preview[data-skin-active="1"][data-skin-density="dense"]{padding:6px 9px}',
  '.dpc-pick-preview[data-skin-active="1"][data-skin-density="compact"]{padding:13px 14px}',
].join('');
 



 

 
function dpcPickerThemeStamp() {
  try {
    const root = document.documentElement;
    const body = document.body;
    const view = root && root.ownerDocument ? root.ownerDocument.defaultView : null;
    const scheme = view && typeof view.getComputedStyle === 'function' ? view.getComputedStyle(root).colorScheme : '';
    return [
      root && typeof root.getAttribute === 'function' ? root.getAttribute('data-ds-theme-source') || '' : '',
      root && typeof root.getAttribute === 'function' ? root.getAttribute('data-ds-dark-theme') || '' : '',
      body && typeof body.hasAttribute === 'function' ? (body.hasAttribute('data-ds-dark-theme') ? '1' : '0') : '',
      String(scheme || ''),
    ].join('|');
  } catch (_error) {
    return '';
  }
}

 
function dpcPickerRepaintMounted() {
  let nodes = null;
  try { nodes = document.querySelectorAll('.dpc-pick-mark, .dpc-pick-preview, .dpc-set-root'); } catch (_error) { return 0; }
  if (!nodes || nodes.length === 0) return 0;
  const attrs = dpcPickerSkinAttrs();
  let painted = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    dpcPickerApplySkin(nodes[i], attrs);
    painted += 1;
  }
  return painted;
}

 
const DPC_HOST_SCHEME_ATTR = 'data-dpc-host-scheme';

 
function dpcHostSchemeResolve() {
  try {
    const root = document.documentElement;
    if (!root) return '';
    const view = root.ownerDocument ? root.ownerDocument.defaultView : null;
    if (!view || typeof view.getComputedStyle !== 'function') return '';
    const raw = String(view.getComputedStyle(root).colorScheme || '').trim().toLowerCase();
    if (!raw) return '';
    const parts = raw.split(/\s+/).filter((p) => p && p !== 'only');
    if (parts.length !== 1) return '';
    return parts[0] === 'light' || parts[0] === 'dark' ? parts[0] : '';
  } catch (_error) {
    return '';
  }
}

 
function dpcHostSchemeSync() {
  try {
    const root = document.documentElement;
    if (!root || typeof root.setAttribute !== 'function') return '';
    const value = dpcHostSchemeResolve();
    if (value) root.setAttribute(DPC_HOST_SCHEME_ATTR, value);
    else if (typeof root.removeAttribute === 'function') root.removeAttribute(DPC_HOST_SCHEME_ATTR);
    return value;
  } catch (_error) {
    return '';
  }
}

 
let dpcPickerThemeObserver = null;
function dpcPickerEnsureThemeWatch() {
  if (dpcPickerThemeObserver) return dpcPickerThemeObserver;
  try {
    if (typeof MutationObserver !== 'function') return null;
    if (!document.documentElement) return null;
    
    dpcHostSchemeSync();
    const obs = new MutationObserver(() => {
      dpcHostSchemeSync();
      const now = dpcPickerThemeStamp();
      if (now === dpcPickerThemeObserver.stamp) return;
      dpcPickerThemeObserver.stamp = now;
      dpcPickerRepaintMounted();
    });
    const filter = ['data-ds-theme-source', 'data-ds-dark-theme', 'style', 'class'];
    obs.observe(document.documentElement, { attributes: true, attributeFilter: filter });
    if (document.body) obs.observe(document.body, { attributes: true, attributeFilter: filter });
    dpcPickerThemeObserver = obs;
    obs.stamp = dpcPickerThemeStamp();
    return obs;
  } catch (_error) {
    return null;
  }
}


const DPC_PICK_CSS = [
  
  
  
  
  
  '.dpc-pick-mark{display:flex;align-items:center;gap:5px;box-sizing:border-box;max-width:100%;',
  'padding:1px 4px;border-radius:6px;background:var(--dpc-surface-1);',
  'border:1px solid var(--dpc-edge);color:var(--dpc-ink-1);',
  'font-size:10px;line-height:15px;pointer-events:none;}',
  
  
  
  
  
  '.dpc-pick-mark[data-dpc-pick="seat"]{display:inline-flex;margin-left:4px;gap:3px;',
  'flex:0 0 auto;max-width:56px;}',
  
  
  
  
  
  
  
  
  
  
  '.dpc-pick-mark[data-dpc-pick="seat"][data-dpc-empty="1"][data-dpc-compact]{',
  'background:transparent;border-color:transparent;padding:0;gap:0;max-width:12px;min-width:0;}',
  
  
  '.dpc-pick-mark[data-dpc-pick="seat"] .dpc-pick-name{flex:0 0 auto;min-width:0;',
  'max-width:none;overflow:visible;text-overflow:clip;white-space:nowrap;}',
  '.dpc-pick-mark[data-dpc-pick="seat"] .dpc-pick-dot{width:6px;height:6px;}',
  '.dpc-pick-dot{flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:var(--dpc-hatch);}',
  
  
  '.dpc-pick-no{flex:0 0 auto;font-size:10px;color:var(--dpc-ink-2);}',
  '.dpc-pick-no[data-dpc-tail="1"]{margin-left:auto;padding-left:4px;}',
  '.dpc-pick-name{flex:0 0 auto;font-size:11px;color:var(--dpc-ink-1);',
  'max-width:9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.dpc-pick-kind{flex:0 0 auto;font-size:10px;color:var(--dpc-ink-3);}',
  '.dpc-pick-stats{flex:0 1 auto;display:flex;gap:5px;min-width:0;overflow:hidden;}',
  '.dpc-pick-stat{font-size:10px;color:var(--dpc-ink-2);white-space:nowrap;}',
  '.dpc-pick-stat[data-unranked="1"]{color:var(--dpc-ink-3);}',
  '.dpc-pick-twin{flex:0 0 auto;font-size:10px;color:var(--dpc-ink-3);white-space:nowrap;}',
  
  
  
  
  
  '.dpc-pick-mark[data-dpc-pick="menu"]{flex-wrap:wrap;row-gap:0;align-content:center;}',
  '.dpc-pick-family-members{flex:0 1 auto;min-width:0;display:flex;flex-wrap:wrap;gap:4px;align-items:center;}',
  '.dpc-pick-family-member{flex:0 0 auto;display:inline-flex;align-items:center;padding:0 4px;',
  'border-radius:4px;border:1px solid var(--dpc-edge);font-size:10px;color:var(--dpc-ink-2);white-space:nowrap;}',
  
  '.dpc-pick-family-member[data-dpc-family-tier="0"]{color:var(--dpc-ink-1);border-color:var(--dpc-ink-3);}',
  
  
  '.dpc-pick-mark[data-dpc-pick="menu"][data-dpc-family-carrier]{background:transparent;',
  'border-color:transparent;padding:0;gap:0;min-width:0;max-width:0;',
  
  'position:absolute;width:0;height:0;border-width:0;overflow:hidden;}',
  
  
  
  '.dpc-pick-mark{flex:0 1 auto;min-width:0;max-width:320px;overflow:hidden;}',
  
  
  
  
  
  
  
  
  '@media (max-width:480px){.dpc-pick-stats,.dpc-pick-twin{display:none}',
  
  '.dpc-pick-mark{max-width:100%;flex-wrap:wrap;row-gap:0;align-content:center}',
  '.dpc-pick-name{max-width:none;flex:0 0 auto;white-space:nowrap}',
  
  
  
  
  
  '.dpc-pick-mark[data-dpc-pick="seat"]{max-width:56px;flex:0 0 auto;flex-wrap:nowrap}',
  '.dpc-pick-mark[data-dpc-pick="seat"] .dpc-pick-name{flex:0 0 auto;min-width:0;',
  'overflow:visible;text-overflow:clip;white-space:nowrap}}',
  
  
  
  
  
  
  '.dpc-pick-preview{position:fixed;z-index:2400;box-sizing:border-box;width:180px;',
  'padding:10px 12px;border-radius:12px;border:1px solid var(--dpc-border,var(--dpc-edge));',
  'background:var(--dpc-surface-1);color:var(--dpc-ink-1);font-size:11px;line-height:16px;',
  'box-shadow:0 8px 24px rgba(0,0,0,.45);pointer-events:none;',
  'display:flex;flex-direction:column;align-items:stretch;',
  
  
  
  
  
  
  
  
  
  
  
  
  'max-height:min(600px, calc(100vh - 32px));overflow:auto;}',
  
  '.dpc-pick-preview > *{flex-shrink:0}',
  
  
  
  '.dpc-pick-preview-art{position:relative;width:100%;height:186px;overflow:hidden;',
  'border-radius:9px;margin-bottom:8px;background:var(--dpc-surface-2);}',
  
  
  
  '.dpc-pick-preview-art .dpc-cg-layer{opacity:.55;border-radius:9px;}',
  '.dpc-pick-preview-art video.dpc-cg-layer{opacity:.70;}',
  '.dpc-pick-preview-head{display:flex;flex-direction:column;align-items:center;gap:2px;',
  'margin-bottom:6px;text-align:center;}',
  '.dpc-pick-preview-name{font-size:13px;color:var(--dpc-ink-1);}',
  '.dpc-pick-preview-sub{margin-bottom:6px;color:var(--dpc-ink-2);font-size:10px;text-align:center;}',
  '.dpc-pick-preview-grid{display:grid;grid-template-columns:1fr;gap:3px;margin-bottom:6px;}',
  '.dpc-pick-preview-cell{display:flex;justify-content:space-between;gap:4px;padding:1px 4px;',
  'border-radius:5px;background:var(--dpc-surface-2);font-size:10px;white-space:nowrap;}',
  '.dpc-pick-preview-cell b{color:var(--dpc-ink-3);font-weight:400;}',
].join('');

function dpcPickerEnsureStyle() {
  try {
    
    dpcPickerEnsureThemeWatch();
    if (document.getElementById(DPC_PICK_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = DPC_PICK_STYLE_ID;
    
    
    style.appendChild(document.createTextNode(HUD_TOKENS_CSS + DPC_PICK_CSS + DPC_PICK_SKIN_CSS + DPC_DAY_FALLBACK_CSS));
    (document.head || document.documentElement).appendChild(style);
  } catch (_error) {   }
}


const dpcPickerState = {
  ctx: null,
  groups: [],
  current: null,
  releaseStore: null,
  
  
  
  
  
  seatStoreKey: null,
  releaseBus: null,
  raf: 0,
  
  
  
  rafWatch: 0,
  rafToken: null,
  
  
  seatSig: '',
  
  
  
  
  
  
  
  seatTier: '',
  
  
  
  
  seatWatch: null,
  seatWatchHost: null,
  
  
  
  retryTimer: 0,
  retryStep: 0,
  retryFor: '',
  preview: null,
  
  
  
  previewSeq: 0,
  
  previewRect: null,
  
  
  
  previewWatchOff: null,
  mounted: false,
  listeners: [],
  
  
  menuCache: null,
};


const DPC_PICK_RAF_TIMEOUT_MS = 1200;

const DPC_PICK_RETRY_DELAYS = [120, 300, 600];

 
function dpcPickerCurrentSig(current) {
  if (!current) return '';
  return [current.provider || '', current.model || '', current.effort || ''].join('\u0000');
}

function dpcPickerClearRafWatch() {
  if (dpcPickerState.rafWatch === 0) return;
  clearTimeout(dpcPickerState.rafWatch);
  dpcPickerState.rafWatch = 0;
}

 
function dpcPickerSchedule() {
  const state = dpcPickerState;
  if (state.raf !== 0) return;
  const token = {};
  state.rafToken = token;
  state.raf = requestAnimationFrame(() => {
    if (state.rafToken !== token) return; 
    dpcPickerClearRafWatch();
    state.raf = 0;
    state.rafToken = null;
    dpcPickerScan();
  });
  if (state.rafWatch === 0) {
    state.rafWatch = setTimeout(() => {
      state.rafWatch = 0;
      if (state.raf === 0 || state.rafToken !== token) return;
      state.raf = 0;
      state.rafToken = null;
      dpcPickerScan();
    }, DPC_PICK_RAF_TIMEOUT_MS);
  }
}

function dpcPickerClearRetry() {
  const state = dpcPickerState;
  if (state.retryTimer !== 0) {
    clearTimeout(state.retryTimer);
    state.retryTimer = 0;
  }
  state.retryStep = 0;
  state.retryFor = '';
}

 
function dpcPickerRetryStep() {
  const state = dpcPickerState;
  const delay = DPC_PICK_RETRY_DELAYS[state.retryStep];
  if (delay === undefined) {
    dpcPickerClearRetry();
    return;
  }
  state.retryStep += 1;
  state.retryTimer = setTimeout(() => {
    state.retryTimer = 0;
    dpcPickerScan();
    if (dpcPickerCurrentSig(dpcPickerState.current) === dpcPickerState.seatSig) {
      dpcPickerClearRetry();
      return;
    }
    dpcPickerRetryStep();
  }, delay);
}

 
function dpcPickerSeatRetry() {
  try {
    const state = dpcPickerState;
    const sig = dpcPickerCurrentSig(state.current);
    if (!sig || sig === state.seatSig) {
      dpcPickerClearRetry();
      return;
    }
    if (state.retryTimer !== 0) return; 
    if (state.retryFor === sig) return; 
    state.retryFor = sig;
    state.retryStep = 0;
    dpcPickerRetryStep();
  } catch (_error) {   }
}

 
function dpcPickerSeatKey(ctx) {
  let primary = null;
  try { primary = sessionKeyOf(ctx, null); } catch (_error) { primary = null; }
  if (typeof primary === 'string' && primary.length > 0) return primary;
  let dock = null;
  try { dock = typeof dpcReadSessionKey === 'function' ? dpcReadSessionKey() : null; }
  catch (_error) { dock = null; }
  if (typeof dock === 'string' && dock.length > 0) return dock;
  return null;
}

 
function dpcPickerSeatDirectory(ctx, key) {
  if (key === null) return null;
  if (key === sessionKeyOf(ctx, null)) return resolveDirectory(ctx, sessionKeyOf(ctx, null));
  return resolveDirectory(ctx, key);
}

 
function dpcPickerReleaseSeatStore() {
  if (dpcPickerState.releaseStore) {
    try { dpcPickerState.releaseStore(); } catch (_error) {   }
  }
  dpcPickerState.releaseStore = null;
  dpcPickerState.seatStoreKey = null;
}

 
function dpcPickerClearSnapshot() {
  const hadSnapshot = dpcPickerState.current !== null || dpcPickerState.seatSig !== '';
  dpcPickerState.groups = [];
  dpcPickerState.current = null;
  dpcPickerState.seatSig = '';
  dpcPickerState.seatTier = '';
  if (!hadSnapshot) return;
  try {
    const seat = findSeat();
    const host = seat && typeof seat.querySelector === 'function'
      ? (seat.querySelector('button') || seat.querySelector('[aria-haspopup]'))
      : null;
    if (host) dpcPickerSeatClear(host);
  } catch (_error) {   }
}

 
function dpcPickerRefreshSnapshot() {
  const ctx = dpcPickerState.ctx;
  if (!ctx) return;
  const key = dpcPickerSeatKey(ctx);
  if (dpcPickerState.releaseStore && dpcPickerState.seatStoreKey === key) return;
  dpcPickerReleaseSeatStore();
  if (key === null) { dpcPickerClearSnapshot(); return; }
  let store = null;
  try {
    const directory = dpcPickerSeatDirectory(ctx, key);
    store = directory && directory.store ? directory.store : null;
  } catch (_error) { store = null; }
  if (!store) { dpcPickerClearSnapshot(); return; }
  const read = () => {
    try {
      
      if (dpcPickerState.seatStoreKey !== key) return;
      const snap = store.getSnapshot();
      if (!snap) return;
      dpcPickerState.groups = Array.isArray(snap.groups) ? snap.groups : [];
      dpcPickerState.current = snap.current || null;
      
      dpcPickerSeatRetry();
      dpcPickerSchedule();
    } catch (_error) {   }
  };
  let release = null;
  try { release = store.subscribe(read) ?? (() => {}); } catch (_error) { release = null; }
  if (typeof release !== 'function') return;
  dpcPickerState.releaseStore = release;
  dpcPickerState.seatStoreKey = key;
  read();
}

function dpcPickerEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null && text !== '') el.appendChild(document.createTextNode(dpcT2(String(text))));
  return el;
}

 
function dpcPickerPaint(host, kind, payload, key) {
  try {
    
    
    
    if (kind !== 'seat' && kind !== 'menu') return null;
    let mark = host.querySelector('.dpc-pick-mark');
    if (!mark) {
      mark = dpcPickerEl('span', 'dpc-pick-mark');
      host.appendChild(mark);
    }
    
    
    dpcPickerApplySkin(mark, dpcPickerSkinAttrs());
    dpcPickerEnsureThemeWatch();
    if (mark.getAttribute('data-dpc-pick') === kind && mark.getAttribute('data-dpc-key') === key) return mark;
    while (mark.firstChild) mark.removeChild(mark.firstChild);
    mark.setAttribute('data-dpc-pick', kind);
    mark.setAttribute('data-dpc-key', key);
    mark.setAttribute('data-dpc-source', payload.badge.source);
    mark.setAttribute('title', payload.title || payload.badge.title || payload.badge.name);
    const dot = dpcPickerEl('span', 'dpc-pick-dot');
    if (payload.badge.color) dot.style.background = payload.badge.color;
    mark.appendChild(dot);

    
    
    
    if (kind === 'seat') {
      const named = !payload.dotOnly && Boolean(payload.name);
      if (named) {
        mark.appendChild(dpcPickerEl('span', 'dpc-pick-name', payload.name));
      }
      
      
      
      
      
      
      
      
      
      
      if (named) mark.setAttribute('data-dpc-empty', '0');
      else mark.setAttribute('data-dpc-empty', '1');
      mark.setAttribute('data-dpc-compact', payload.dotOnly ? 'dot' : 'dotname');
      
      if (Number.isFinite(payload.hostTextPx)) {
        mark.setAttribute('data-dpc-hosttext', String(Math.round(payload.hostTextPx)));
      }
      return mark;
    }

    
    
    
    
    
    
    mark.setAttribute('data-dpc-empty', '1');
    if (payload.familyKey) {
      mark.setAttribute('data-dpc-family', payload.familyKey);
      mark.setAttribute('data-dpc-family-name', payload.familyName || '');
      mark.setAttribute('data-dpc-family-latin', payload.familyLatin || '');
    } else {
      mark.setAttribute('data-dpc-family', '');
      mark.setAttribute('data-dpc-family-name', '');
      mark.setAttribute('data-dpc-family-latin', '');
    }
    const members = Array.isArray(payload.members) ? payload.members : [];
    if (members.length) {
      const box = dpcPickerEl('span', 'dpc-pick-family-members');
      box.setAttribute('data-dpc-family-members', String(members.length));
      for (const member of members) {
        const chip = dpcPickerEl('span', 'dpc-pick-family-member', member.label);
        chip.setAttribute('data-dpc-family-member', member.model);
        
        if (member.tierAttr && member.tierValue) chip.setAttribute(member.tierAttr, member.tierValue);
        if (member.tierValue) chip.setAttribute('data-dpc-family-tier', member.tierValue);
        if (member.tierKey) chip.setAttribute('data-dpc-family-tier-key', member.tierKey);
        if (member.tierLevel != null) chip.setAttribute('data-dpc-family-tier-level', String(member.tierLevel));
        box.appendChild(chip);
      }
      mark.appendChild(box);
    }
    return mark;
  } catch (_error) { return null; }
}

 
function dpcPickerPaintCarrier(host, desc, key) {
  try {
    let mark = host.querySelector('.dpc-pick-mark');
    if (!mark) {
      mark = dpcPickerEl('span', 'dpc-pick-mark');
      host.appendChild(mark);
    }
    if (mark.getAttribute('data-dpc-pick') === 'menu' && mark.getAttribute('data-dpc-key') === key) return mark;
    while (mark.firstChild) mark.removeChild(mark.firstChild);
    mark.setAttribute('data-dpc-pick', 'menu');
    mark.setAttribute('data-dpc-key', key);
    mark.setAttribute('data-dpc-source', 'carrier');
    mark.setAttribute('data-dpc-family-carrier', (desc && desc.familyKey) || '1');
    
    
    mark.setAttribute('data-dpc-family', '');
    mark.setAttribute('data-dpc-family-name', '');
    mark.setAttribute('data-dpc-family-latin', '');
    return mark;
  } catch (_error) { return null; }
}

 
function dpcPickerPaintSeat() {
  const current = dpcPickerState.current;
  if (!current || !current.model) { dpcPickerState.seatSig = ''; dpcPickerState.seatTier = ''; return; }
  const seat = findSeat();
  if (!seat) { dpcPickerState.seatSig = ''; dpcPickerState.seatTier = ''; return; }
  const host = seat.querySelector('button') || seat.querySelector('[aria-haspopup]');
  if (!host) { dpcPickerState.seatSig = ''; dpcPickerState.seatTier = ''; return; }
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const avail = dpcPickerTriggerWidth(host);
  const tier = avail === null ? 'dotname'
    : avail < DPC_PICK_TRIGGER_HIDE_PX ? 'hide'
      : avail < DPC_PICK_TRIGGER_DOT_PX ? 'dot' : 'dotname';
  
  
  if (typeof host.setAttribute === 'function') host.setAttribute(DPC_PICK_SEAT_TIER_ATTR, tier);
  const sig = dpcPickerCurrentSig(current);
  
  
  
  if (tier === 'hide') {
    dpcPickerSeatClear(host);
    dpcPickerState.seatSig = sig;
    dpcPickerState.seatTier = tier;
    return;
  }
  
  
  if (sig === dpcPickerState.seatSig && tier === dpcPickerState.seatTier
      && host.querySelector('.dpc-pick-mark')) return;
  dpcPickerState.seatSig = sig;
  dpcPickerState.seatTier = tier;
  
  
  
  const groups = dpcPickerState.groups || [];
  let display = current.provider;
  for (const g of groups) {
    if (g && g.id === current.provider && g.name) { display = g.name; break; }
  }
  const desc = dpcPickerDescribe(
    { heading: current.provider, title: displayModel(current.model), modelId: current.model },
    null,
    [{ id: current.provider, name: display, models: [] }],
  );
  
  const dotOnly = tier === 'dot';
  
  const payload = dpcPickerSeatStrip(desc, dotOnly);
  
  payload.hostTextPx = dpcPickerHostTextWidth(host);
  
  
  
  
  const baseKey = pairKey(current.provider, current.model);
  const seatKey = [current.effort || '', tier, baseKey].join('\u0000');
  dpcPickerPaint(host, 'seat', payload, seatKey);
}

 
function dpcPickerPaintMenus() {
  let menus;
  try {
    menus = document.querySelectorAll('div[role="menu"][aria-label="' + DPC_PICK_MENU_LABEL + '"]');
  } catch (_error) { return; }
  for (let m = 0; m < menus.length; m += 1) {
    const menu = menus[m];
    let sections;
    try { sections = menu.querySelectorAll('section[role="group"]'); } catch (_error) { continue; }
    if (sections.length === 0) continue;
    
    const shape = [];
    const rowNodes = [];
    const shapeParts = [];
    for (let s = 0; s < sections.length; s += 1) {
      const section = sections[s];
      const heading = dpcPickerHeadingOf(section).slice(0, DPC_PICK_HEADING_MAX);
      const rows = [];
      let buttons;
      try { buttons = section.querySelectorAll('button[role="menuitemradio"]'); } catch (_error) { buttons = []; }
      shapeParts.push(heading);
      for (let b = 0; b < buttons.length; b += 1) {
        const node = buttons[b];
        const title = node.getAttribute('title') || '';
        const modelId = dpcPickerFiberKey(node);
        rows.push({ node, title, modelId });
        shape.push({ heading, rows: [{ title, modelId }] });
        shapeParts.push(title, modelId);
      }
      rowNodes.push(rows);
    }
    
    const sig = shapeParts.join('');
    let parsed = null;
    const cache = dpcPickerState.menuCache;
    if (cache && cache.node === menu && cache.sig === sig) {
      parsed = cache.parsed;
    } else {
      try { parsed = dpcPickerParseMenu(shape, dpcPickerState.groups, {}); } catch (_error) { parsed = []; }
      dpcPickerState.menuCache = { node: menu, sig, parsed };
    }
    
    const plan = dpcPickerMenuPlan(parsed);
    let cursor = 0;
    for (const rows of rowNodes) {
      for (const row of rows) {
        const desc = parsed[cursor];
        const role = plan.roles[cursor] || null;
        cursor += 1;
        if (!desc || !desc.known || !role) continue;
        
        
        const carrier = dpcPickerPaintCarrier(row.node, desc, role.key);
        if (carrier) carrier.__dpcPickerDesc = desc;
      }
    }
  }
}

 
function dpcPickerUnwatchSeat() {
  const state = dpcPickerState;
  if (state.seatWatch && typeof state.seatWatch.disconnect === 'function') {
    try { state.seatWatch.disconnect(); } catch (_error) {   }
  }
  state.seatWatch = null;
  state.seatWatchHost = null;
}

function dpcPickerWatchSeat() {
  const state = dpcPickerState;
  if (typeof ResizeObserver !== 'function') return;
  let host = null;
  try {
    const seat = findSeat();
    host = seat ? (seat.querySelector('button') || seat.querySelector('[aria-haspopup]')) : null;
  } catch (_error) { host = null; }
  if (!host) { dpcPickerUnwatchSeat(); return; }
  if (state.seatWatch && state.seatWatchHost === host) return;
  dpcPickerUnwatchSeat();
  try {
    const ro = new ResizeObserver(() => dpcPickerSchedule());
    ro.observe(host);
    state.seatWatch = ro;
    state.seatWatchHost = host;
  } catch (_error) {
    state.seatWatch = null;
    state.seatWatchHost = null;
  }
}

function dpcPickerScan() {
  try {
    dpcPickerRefreshSnapshot();
    
    dpcPickerWatchSeat();
    dpcPickerPaintSeat();
    dpcPickerPaintMenus();
    
    
    if (dpcPickerCurrentSig(dpcPickerState.current) === dpcPickerState.seatSig) dpcPickerClearRetry();
  } catch (_error) {   }
}

function dpcPickerAnchorOf(target) {
  try {
    if (!target || !target.closest) return null;
    
    
    
    const hitMark = target.closest('.dpc-pick-mark');
    let host = null;
    let node = null;
    if (hitMark) {
      node = hitMark;
      host = hitMark.parentElement;
    }
    if (!node) {
      const row = target.closest('button[role="menuitemradio"]');
      if (row) {
        host = row;
        node = row.querySelector('.dpc-pick-mark');
      }
    }
    if (!node) {
      const seatHost = target.closest('button');
      if (seatHost) {
        const seatMark = seatHost.querySelector('.dpc-pick-mark[data-dpc-pick="seat"]');
        if (seatMark) { host = seatHost; node = seatMark; }
      }
    }
    if (!node || !host) return null;
    const desc = node.__dpcPickerDesc ? node.__dpcPickerDesc : null;
    if (!desc) return null;
    return { rect: host.getBoundingClientRect(), desc };
  } catch (_error) { return null; }
}















 
const dpcPickerCgHooks = { plan: null, watch: null };

 
const dpcPickerScoreHooks = { note: null };

 
function dpcPickerCardPlan(desc) {
  const d = desc || {};
  const plan = { data: dpcPickerPreview(d), cg: null, desc: d, card: null, persona: null };
  if (typeof dpcCardPlan === 'function') {
    try {
      const common = dpcCardPlan(d.providerId || '', d.model || '');
      if (common) {
        plan.card = common.card || null;
        plan.persona = common.persona || null;
      }
    } catch (_error) {   }
  }
  return plan;
}

 
function dpcPickerCardDom(box, plan, previewSeq) {
  const data = plan.data;
  const head = dpcPickerEl('div', 'dpc-pick-preview-head');
  const dot = dpcPickerEl('span', 'dpc-pick-dot');
  if (data.badge.color) dot.style.background = data.badge.color;
  head.appendChild(dot);
  head.appendChild(dpcPickerEl('span', 'dpc-pick-preview-name', data.badge.name));
  head.appendChild(dpcPickerEl('span', 'dpc-pick-no', data.badge.no + ' · ' + data.kindText));
  box.appendChild(head);
  const sub = [data.provider, data.channel, data.identity].filter(Boolean).join(' · ');
  if (sub) box.appendChild(dpcPickerEl('div', 'dpc-pick-preview-sub', sub));
  
  
  
  if (data.stats.length) {
    const grid = dpcPickerEl('div', 'dpc-pick-preview-grid');
    for (const stat of data.stats) {
      const cell = dpcPickerEl('span', 'dpc-pick-preview-cell');
      cell.appendChild(dpcPickerEl('b', '', stat.key));
      cell.appendChild(dpcPickerEl('span', '', stat.text));
      grid.appendChild(cell);
    }
    box.appendChild(grid);
  }
  
  
  
  
  dpcPickerRenderCg(box, plan, previewSeq);
}

 
function dpcPickerCgLayer(cg) {
  if (!cg || !cg.src) return null;
  const cutout = !!cg.cutoutSrc;
  const video = cutout ? cg.cutoutKind === 'video' : cg.kind === 'video';
  const el = dpcPickerEl(video ? 'video' : 'img', 'dpc-cg-layer dpc-pick-preview-cg');
  const style = el.style;
  style.position = 'absolute';
  style.inset = '0';
  style.width = '100%';
  style.height = '100%';
  style.objectFit = cg.fit === 'cover' ? 'cover' : 'contain';
  style.objectPosition = cg.objectPosition || 'center top';
  style.pointerEvents = 'none';
  style.borderRadius = '9px';
  el.setAttribute('aria-hidden', 'true');
  if (cutout) {
    el.setAttribute('data-cutout', '1');
    if (cg.cutoutKind === 'video') el.setAttribute('data-cutout-kind', 'video');
    
    
    
    
    dpcPickerBustFrame(el, video);
  }
  el.setAttribute('src', cutout ? cg.cutoutSrc : cg.src);
  if (video) {
    if (!cutout && cg.poster) el.setAttribute('poster', cg.poster);
    el.setAttribute('autoplay', '');
    el.setAttribute('muted', '');
    el.setAttribute('playsinline', '');
    if (cutout || cg.loop !== false) el.setAttribute('loop', '');
  }
  return el;
}

 
const DPC_PICK_BUST_RATIO = 1.2;
const DPC_PICK_BUST_SCALE = 2;

 
function dpcPickerBustFrame(el, video) {
  const style = el.style;
  style.objectFit = 'contain';
  style.objectPosition = 'center top';
  const apply = () => {
    const w = video ? el.videoWidth : el.naturalWidth;
    const h = video ? el.videoHeight : el.naturalHeight;
    if (!(w > 0 && h > 0) || h / w < DPC_PICK_BUST_RATIO) return;
    style.height = DPC_PICK_BUST_SCALE * 100 + '%';
    style.objectFit = 'cover';
    style.objectPosition = 'center top';
    el.setAttribute('data-bust', '1');
  };
  
  if (video) el.onloadedmetadata = apply;
  else el.onload = apply;
}

 
function dpcPickerReleaseCgWatch() {
  const off = dpcPickerState.previewWatchOff;
  if (typeof off === 'function') {
    try { off(); } catch (_error) {   }
  }
  dpcPickerState.previewWatchOff = null;
}

 
function dpcPickerRenderCg(box, plan, previewSeq) {
  const hook = dpcPickerCgHooks.plan;
  if (typeof hook !== 'function') return; 
  const desc = plan.desc || {};
  const provider = desc.providerId || '';
  if (!provider) return;
  let pending;
  try { pending = hook(provider, desc.model || ''); } catch (_error) { return; }
  if (!pending || typeof pending.then !== 'function') return;
  const settled = pending.then((cg) => {
    if (previewSeq !== dpcPickerState.previewSeq) return; 
    if (box !== dpcPickerState.preview) return; 
    if (!cg || !cg.src) return; 
    const layer = dpcPickerCgLayer(cg);
    if (!layer) return;
    
    
    const watch = dpcPickerCgHooks.watch;
    if (typeof watch === 'function' && layer.tagName === 'VIDEO') {
      dpcPickerState.previewWatchOff = watch(layer);
    }
    const art = dpcPickerEl('div', 'dpc-pick-preview-art');
    art.appendChild(layer);
    if (box.firstChild) box.insertBefore(art, box.firstChild);
    else box.appendChild(art);
    
    dpcPickerPositionPreview(box, dpcPickerState.previewRect);
  });
  if (settled && typeof settled.catch === 'function') settled.catch(() => {   });
}

 
function dpcPickerPreviewWidth() {
  const m = /\.dpc-pick-preview\{position:fixed;[^}]*?width:(\d+)px/.exec(DPC_PICK_CSS);
  return m ? Number(m[1]) : 0;
}

 
function dpcPickerPositionPreview(box, rect) {
  if (!box || !rect) return;
  const width = box.offsetWidth || dpcPickerPreviewWidth();
  const height = box.offsetHeight || 160;
  const left = window.innerWidth - rect.right > width + 16 ? rect.right + 8 : Math.max(8, rect.left - width - 8);
  const top = Math.max(8, Math.min(rect.top, window.innerHeight - height - 8));
  box.style.left = Math.round(left) + 'px';
  box.style.top = Math.round(top) + 'px';
}

function dpcPickerShowPreview(anchor) {
  try {
    
    const previewSeq = dpcPickerState.previewSeq + 1;
    dpcPickerState.previewSeq = previewSeq;
    dpcPickerState.previewRect = anchor.rect;
    const plan = dpcPickerCardPlan(anchor.desc);
    let box = dpcPickerState.preview;
    if (!box) {
      box = dpcPickerEl('div', 'dpc-pick-preview');
      box.setAttribute('data-dpc-pick', 'preview');
      document.body.appendChild(box);
      dpcPickerState.preview = box;
    }
    dpcPickerApplySkin(box, dpcPickerSkinAttrs());
    dpcPickerReleaseCgWatch();
    while (box.firstChild) box.removeChild(box.firstChild);
    dpcPickerCardDom(box, plan, previewSeq);
    dpcPickerPositionPreview(box, anchor.rect);
  } catch (_error) { dpcPickerHidePreview(); }
}

 
function dpcPickerIsViewportEvent(event) {
  const t = event && event.target;
  return !t || t === window || (typeof document !== 'undefined' && (t === document || t === document.documentElement));
}

function dpcPickerHidePreview() {
  try {
    if (dpcPickerState.preview && dpcPickerState.preview.parentNode) {
      dpcPickerState.preview.parentNode.removeChild(dpcPickerState.preview);
    }
  } catch (_error) {   }
  dpcPickerState.preview = null;
  dpcPickerReleaseCgWatch();
  
  dpcPickerState.previewSeq = dpcPickerState.previewSeq + 1;
  dpcPickerState.previewRect = null;
}

 
function dpcPickerMount(ctx) {
  if (dpcPickerState.mounted) {
    dpcPickerState.ctx = ctx || dpcPickerState.ctx;
    dpcPickerScan();
    return;
  }
  dpcPickerState.ctx = ctx || null;
  dpcPickerState.mounted = true;
  dpcPickerEnsureStyle();
  if (!dpcPickerState.releaseBus) dpcPickerState.releaseBus = busSubscribe(() => dpcPickerSchedule());
  if (dpcPickerState.listeners.length === 0) {
    const add = (target, type, handler) => {
      target.addEventListener(type, handler, true);
      dpcPickerState.listeners.push([target, type, handler]);
    };
    add(document, 'mouseover', (event) => {
      const anchor = dpcPickerAnchorOf(event.target);
      if (anchor) dpcPickerShowPreview(anchor);
    });
    add(document, 'mouseout', (event) => {
      const to = event.relatedTarget;
      const anchor = dpcPickerAnchorOf(event.target);
      if (!anchor) return;
      if (to && to.closest && to.closest('.dpc-pick-mark')) return;
      dpcPickerHidePreview();
    });
    add(document, 'focusin', (event) => {
      const anchor = dpcPickerAnchorOf(event.target);
      if (anchor) dpcPickerShowPreview(anchor);
    });
    add(document, 'focusout', () => dpcPickerHidePreview());
    
    
    
    
    add(window, 'scroll', () => dpcPickerHidePreview());
    add(window, 'resize', (event) => { if (dpcPickerIsViewportEvent(event)) dpcPickerHidePreview(); });
    
    
    
    add(document, 'visibilitychange', () => {
      if (document.hidden) return;
      dpcPickerState.seatSig = '';
      dpcPickerState.seatTier = '';
      dpcPickerSeatRetry();
      dpcPickerSchedule();
    });
  }
  dpcPickerScan();
  dpcPickerSchedule();
}

 
function dpcPickerUnmount() {
  for (const item of dpcPickerState.listeners) {
    try { item[0].removeEventListener(item[1], item[2], true); } catch (_error) {   }
  }
  dpcPickerState.listeners = [];
  
  dpcPickerReleaseSeatStore();
  if (dpcPickerState.releaseBus) { try { dpcPickerState.releaseBus(); } catch (_error) {   } }
  dpcPickerState.releaseBus = null;
  
  dpcPickerUnwatchSeat();
  
  dpcPickerClearRafWatch();
  if (dpcPickerState.raf !== 0) {
    try { cancelAnimationFrame(dpcPickerState.raf); } catch (_error) {   }
  }
  dpcPickerState.raf = 0;
  dpcPickerState.rafToken = null;
  dpcPickerClearRetry();
  dpcPickerHidePreview();
  try {
    const style = document.getElementById(DPC_PICK_STYLE_ID);
    if (style && style.parentNode) style.parentNode.removeChild(style);
  } catch (_error) {   }
  try {
    const marks = document.querySelectorAll('.dpc-pick-mark');
    for (let i = 0; i < marks.length; i += 1) {
      if (marks[i].parentNode) marks[i].parentNode.removeChild(marks[i]);
    }
  } catch (_error) {   }
  dpcPickerState.menuCache = null;
  dpcPickerState.groups = [];
  dpcPickerState.current = null;
  dpcPickerState.seatSig = '';
  dpcPickerState.seatTier = '';
  dpcPickerState.ctx = null;
  dpcPickerState.mounted = false;
}


const dpcPickerInternals = {
  dpcPickerTrim,
  dpcPickerKeyOf,
  dpcPickerProviderOf,
  dpcPickerModelIdOf,
  dpcPickerDescribe,
  dpcPickerParseMenu,
  dpcPickerStatRows,
  dpcPickerBadge,
  dpcPickerStrip,
  dpcPickerPreview,
  dpcPickerKindText,
  dpcPickerMount,
  dpcPickerUnmount,
  dpcPickerEnsureStyle,
  dpcPickerPaintSeat,
  dpcPickerCurrentSig,
  dpcPickerSeatRetry,
  dpcPickerSchedule,
  DPC_PICK_STYLE_ID,
  DPC_PICK_CSS,
  
  DPC_PICK_SKIN_CSS,
  dpcPickerSkinAttrs,
  dpcPickerApplySkin,
  dpcPickerThemeStamp,
  dpcPickerRepaintMounted,
  dpcPickerEnsureThemeWatch,
  
  HUD_TOKENS_CSS,
  
  DPC_DAY_FALLBACK_CSS,
  DPC_PICK_NO_EFFORT,
  DPC_PICK_RAF_TIMEOUT_MS,
  DPC_PICK_RETRY_DELAYS,
  dpcPickerSeatRetry,
  dpcPickerRetryStep,
  dpcPickerClearRetry,
  
  
  dpcPickerCardPlan,
  dpcPickerCardDom,
  dpcPickerCgLayer,
  dpcPickerRenderCg,
  dpcPickerPositionPreview,
  dpcPickerPreviewWidth,
  dpcPickerReleaseCgWatch,
  dpcPickerCgHooks,
  
  
  
  
  
  dpcPickerSeatRole,
  dpcPickerFamilyStem,
  dpcPickerFamilyRoles,
  DPC_PICK_SEAT_TIER_ATTR,
  dpcPickerWatchSeat,
  dpcPickerUnwatchSeat,
  state: dpcPickerState,
};



 
dpcPickerScoreHooks.note = dpcPickerScoreNote;



 
dpcPickerCgHooks.plan = dpcHoverCgPlan;

dpcPickerCgHooks.watch = dpcWatchVideo;


 
 
 
const PC_PERSONA_BASE_CARDS = PROVIDERS.cards;
let PC_PERSONA_OVERRIDES = {};

 
function dpcRebuildCards() {
  let cards = PC_PERSONA_BASE_CARDS;
  const lang = (typeof dpcGetLang === 'function') ? dpcGetLang() : 'zh';
  const table = (typeof dpcLocaleCards !== 'undefined' && dpcLocaleCards && typeof dpcLocaleCards === 'object')
    ? dpcLocaleCards : {};
  if (lang === 'en' && typeof applyLocaleCards === 'function') {
    cards = applyLocaleCards(cards, { lang, table });
  }
  cards = (typeof applyPersonaOverrides === 'function')
    ? applyPersonaOverrides(cards, PC_PERSONA_OVERRIDES)
    : cards;
  PROVIDERS.cards = cards;
  
  try { dpcPickerFamilyRoleMap = null; } catch (_error) {   }
}

 
function pcSetPersonaOverrides(ov) {
  PC_PERSONA_OVERRIDES = (ov && typeof ov === 'object' && !Array.isArray(ov)) ? ov : {};
  dpcRebuildCards();
}

 
function dpcPersonaRepaint() {
  try { dpcSkinRepaintConsumers(); } catch (_error) {   }
}

 
function pcBaseCardByNo(no) {
  for (const c of PC_PERSONA_BASE_CARDS) {
    if (c && String(c.no) === String(no)) return c;
  }
  return null;
}

 
let pcPersonaPromise = null;
function pcEnsurePersonaOverrides() {
  if (pcPersonaPromise) return pcPersonaPromise;
  const fetchOne = Promise.resolve()
    .then(() => (PC && PC.urls && PC.urls.persona) ? pcGetJson(PC.urls.persona, null) : null)
    .then((j) => { if (j && j.overrides) pcSetPersonaOverrides(j.overrides); return j; })
    .catch(() => null);
  const cap = new Promise((resolve) => { setTimeout(() => resolve(null), 1200); });
  pcPersonaPromise = Promise.race([fetchOne, cap]);
  return pcPersonaPromise;
}

 
let pcLocalePromise = null;
function pcEnsureLocale() {
  if (pcLocalePromise) return pcLocalePromise;
  const fetchOne = Promise.resolve()
    .then(() => (PC && PC.urls && PC.urls.persona) ? pcGetJson(PC.urls.persona + '?locale=1', null) : null)
    .then((j) => { if (j && j.locale) dpcApplyLocale(j.locale); return j; })
    .catch(() => null);
  const cap = new Promise((resolve) => { setTimeout(() => resolve(null), 1200); });
  pcLocalePromise = Promise.race([fetchOne, cap]);
  return pcLocalePromise;
}

 
function pcUsePersonaOverridesReady() {
  const [personaReady, setPersonaReady] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    const p = pcEnsurePersonaOverrides();
    p.then(() => { if (alive) setPersonaReady(true); });
    
    try { pcEnsureLocale(); } catch (_error) {   }
    return () => { alive = false; };
  }, []);
  return personaReady;
}

 
const PC_PERSONA_FIELD_LABEL = {
  name: '名字', latin: '拉丁名', title: '称号', summon: '召唤语', lowQuota: '额度告急台词',
};

 
function pcPersonaValue(values, key) {
  const parts = String(key).split('.');
  let cur = values;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return '';
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : '';
}

 
function pcPersonaSetValue(values, key, v) {
  const parts = String(key).split('.');
  let cur = values;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = v;
}

 
function pcPersonaDefault(card, key) {
  const parts = String(key).split('.');
  let cur = card;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return '';
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : '';
}

 
function pcPersonaDraft(card, ov) {
  const p = (card && card.persona && typeof card.persona === 'object') ? card.persona : {};
  const o = (ov && typeof ov === 'object') ? ov : {};
  const op = (o.persona && typeof o.persona === 'object') ? o.persona : {};
  const values = { persona: {}, forms: {} };
  for (const key of ['name', 'latin', 'title', 'summon', 'lowQuota']) {
    values.persona[key] = (typeof op[key] === 'string') ? op[key] : (typeof p[key] === 'string' ? p[key] : '');
  }
  values.persona.effort = {};
  const tiers = (p.effort && typeof p.effort === 'object') ? p.effort : {};
  for (const t of Object.keys(tiers)) {
    values.persona.effort[t] = (op.effort && typeof op.effort[t] === 'string') ? op.effort[t] : String(tiers[t] || '');
  }
  values.persona.skills = (Array.isArray(p.skills) ? p.skills : []).map((row, i) => {
    const os = (Array.isArray(op.skills) && Array.isArray(op.skills[i])) ? op.skills[i] : [];
    return [(typeof os[0] === 'string' ? os[0] : String((row && row[0]) || '')),
      (typeof os[1] === 'string' ? os[1] : String((row && row[1]) || ''))];
  });
  const forms = (card && card.forms && typeof card.forms === 'object') ? card.forms : {};
  for (const fk of Object.keys(forms)) {
    const of = (o.forms && o.forms[fk] && typeof o.forms[fk] === 'object') ? o.forms[fk] : {};
    const bf = (forms[fk] && typeof forms[fk] === 'object') ? forms[fk] : {};
    const fv = { alias: (typeof of.alias === 'string') ? of.alias : String(bf.alias || '') };
    const bEff = pcFormEfforts(bf);
    const oEff = pcFormEfforts(of);
    const dEff = {};
    for (const lv of Object.keys(bEff)) {
      const bl = (bEff[lv] && Array.isArray(bEff[lv].lines)) ? bEff[lv].lines : null;
      if (!bl) continue;
      const ol = (oEff[lv] && Array.isArray(oEff[lv].lines)) ? oEff[lv].lines : [];
      dEff[lv] = { lines: bl.map((line, i) => (typeof ol[i] === 'string' ? ol[i] : String(line == null ? '' : line))) };
    }
    if (Object.keys(dEff).length) fv.dialogue = { effort: dEff };
    values.forms[fk] = fv;
  }
  return values;
}

 
function pcFormEfforts(form) {
  const d = (form && typeof form === 'object' && form.dialogue && typeof form.dialogue === 'object') ? form.dialogue : {};
  return (d.effort && typeof d.effort === 'object' && !Array.isArray(d.effort)) ? d.effort : {};
}

 
function personaPackage(values) {
  const pkg = { persona: {}, forms: {} };
  for (const key of ['name', 'latin', 'title', 'summon', 'lowQuota']) {
    
    
    
    if (key === 'lowQuota' && values.persona[key] === '') continue;
    if (typeof values.persona[key] === 'string') pkg.persona[key] = values.persona[key];
  }
  if (values.persona.effort && typeof values.persona.effort === 'object') {
    pkg.persona.effort = Object.assign({}, values.persona.effort);
  }
  if (Array.isArray(values.persona.skills)) {
    
    pkg.persona.skills = values.persona.skills.map((row) => [String((row && row[0]) || ''), String((row && row[1]) || '')]);
  }
  if (values.forms && typeof values.forms === 'object') {
    for (const fk of Object.keys(values.forms)) {
      const fv = (values.forms[fk] && typeof values.forms[fk] === 'object') ? values.forms[fk] : {};
      const out = { alias: String(fv.alias || '') };
      const eff = pcFormEfforts(fv);
      const dEff = {};
      for (const lv of Object.keys(eff)) {
        const lines = (eff[lv] && Array.isArray(eff[lv].lines)) ? eff[lv].lines : null;
        if (!lines) continue;
        dEff[lv] = { lines: lines.map((x) => String(x == null ? '' : x)) };
      }
      if (Object.keys(dEff).length) out.dialogue = { effort: dEff };
      pkg.forms[fk] = out;
    }
  }
  return pkg;
}

 
function pcPersonaFields(base) {
  if (!base) return [];
  const out = [];
  for (const key of ['name', 'latin', 'title', 'summon', 'lowQuota']) {
    out.push({ key: 'persona.' + key, label: PC_PERSONA_FIELD_LABEL[key] });
  }
  const tiers = (base.persona && base.persona.effort && typeof base.persona.effort === 'object') ? base.persona.effort : {};
  for (const t of Object.keys(tiers)) out.push({ key: 'persona.effort.' + t, label: '档位台词 · ' + t });
  const skills = (base.persona && Array.isArray(base.persona.skills)) ? base.persona.skills : [];
  skills.forEach((row, i) => {
    out.push({ key: 'persona.skills.' + i + '.0', label: '技能 ' + (i + 1) + ' · 名称' });
    out.push({ key: 'persona.skills.' + i + '.1', label: '技能 ' + (i + 1) + ' · 台词' });
  });
  const forms = (base.forms && typeof base.forms === 'object') ? base.forms : {};
  for (const fk of Object.keys(forms)) {
    const bf = (forms[fk] && typeof forms[fk] === 'object') ? forms[fk] : {};
    out.push({ key: 'forms.' + fk + '.alias', label: '形态 ' + fk + ' · 别名' });
    const eff = pcFormEfforts(bf);
    for (const lv of Object.keys(eff)) {
      const lines = (eff[lv] && Array.isArray(eff[lv].lines)) ? eff[lv].lines : null;
      if (!lines) continue;
      for (let i = 0; i < lines.length; i += 1) {
        out.push({ key: 'forms.' + fk + '.dialogue.effort.' + lv + '.lines.' + i, label: '形态 ' + fk + ' · 档位 ' + lv + ' · 台词 ' + (i + 1) });
      }
    }
  }
  return out;
}
const dpcSkinRegistryInternals = {
  dpcSkinOnRegistryChanged,
  dpcSkinRepaintConsumers,
};

return { inject: ['slots'], apply };
}
});
