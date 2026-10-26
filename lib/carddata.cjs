'use strict';
 

 
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

module.exports = {
  KEYS,
  SRC,
  EFFORT_MODS,
  EFF_LABEL,
  mulAdjust,
  WEEKDAY,
  DEFAULT_LINES,
  nextGlmPeak,
  TIME_RULES,
  timeState,
  normModel,
  displayModel,
  channelQualifier,
  channelLabel,
  QUALIFIERS,
  CHANNEL_NOISE,
  VENDOR_PREFIXES,
  CHANNEL_PREFIX_HYPHEN,
  CHANNEL_SUFFIXES,
  VARIANT_SUFFIXES,
  KEEP_SUFFIXES,
  MODEL_ALIASES,
  MODEL_ALIASES_BY_PROVIDER,
  IMAGE_IDENTITY,
  imageFaceCardFor,
  applyImageFace,
  CHANNEL_LABELS,
  PERSONA_FACE_KEYS,
  personaFaceKeysIn,
  exactCardFor,
  normCardFor,
  variantEntryFor,
  aliasEntryFor,
  applyVariant,
  applyAlias,
  matchCard,
  resolvePersonaForm,
  withVisual,
  resolveVisualPayload,
  resolveFormDialogue,
  visualPersonaOf,
  mergeFormPersona,
  DIALOGUE_LEVELS,
  DIALOGUE_EFFORT_SLOTS,
  EFFORT_LINE_LADDER,
  VISUAL_FAMILY_TOKENS,
  scoreSourceOf,
  MANUAL_SRC_PREFIX,
  familyCardFor,
  patternCardFor,
  applyFamily,
  TIER_DECOR_CLASSES,
  TIER_ATTR,
  tierDescriptor,
  genericCard,
  dataCard,
  DATA_CARD_TITLE,
  DATA_COLORS,
  genericColor,
  GENERIC_COLORS,
  clamp,
  statsOf,
  fmtReset,
  quotaRows,
  lowRow,
  fmtLine,
  pickLine,
  quotaLevel,
  effortText,
  hostEffortsOf,
  effortChips,
  effortLine,
  missingMark,
  statText,
  RESET_UNKNOWN_TEXT,
  
  PERSONA_TEXT_FIELDS,
  PERSONA_SHORT_FIELDS,
  PERSONA_SHORT_MAX,
  PERSONA_LONG_MAX,
  LOW_QUOTA_PLACEHOLDERS,
  PERSONA_OVERRIDE_KEYS,
  PERSONA_SKILL_EDITABLE_COLUMNS,
  validatePersonaOverride,
  validatePersonaOverrides,
  applyPersonaOverrides,
  mergePersonaPatch,
  sanitizePersonaPatch,
  sanitizeLocalePatch,
  applyLocaleCards,
};









try {
  BENCH_NOT_RANKED = require(__dirname + '/benchmarks.cjs').NOT_RANKED;
} catch (err) {
  BENCH_NOT_RANKED = null;
}
