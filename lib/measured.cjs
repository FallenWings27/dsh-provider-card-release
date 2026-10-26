'use strict';
 

 
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

module.exports = {
  NOT_RANKED,
  SEEN_VERSION,
  SEEN_FILENAME,
  SEEN_MAX,
  STATE_SCORE,
  STABILITY_CALIBER,
  COST_CAP_PER_1M,
  COST_CALIBER,
  TPS_FLOOR,
  TPS_CEIL,
  SPEED_CALIBER,
  ELO_BENCHES,
  seenKey,
  mergeSeen,
  pairKey,
  emptySeen,
  resolvePlayMode,
  markSeen,
  normalizeSeen,
  loadSeenJson,
  saveSeenJson,
  stabilityOfRoutes,
  aggregateLedger,
  costScoreFromAgg,
  costEfficiencyOf,
  createSpeedMeter,
  speedScoreFromAgg,
  uniformScore,
  scoreTooltip,
  loadNameMap,
  nameMapEntry,
  auditNameMap,
};

 

 
const FACE_ITEM_KEYS = ['稳定', '性价比', '速度'];

 
const LEDGER_WINDOW_DAYS = 30;

 
const LINK_SAMPLES_MAX = 64;

 
const SEEN_GLOBAL = '__DSH_PROVIDER_CARD_SEEN__';

 
function stabilityItem(routes, routeNames, nowMs) {
  const st = stabilityOfRoutes(routes, routeNames, nowMs);
  if (st.score == null) return null;
  return {
    value: st.score,
    max: 100,
    bench: null,
    caveat: 'health 读数折算，计入 ' + st.counted + ' 条路由等权平均（本机自测口径，非第三方评测）',
    caliber: st.caliber,
  };
}

 
function costItem(ledger, ledgerKeys, opts) {
  const o = opts || {};
  const days = Number.isFinite(o.days) && o.days > 0 ? o.days : LEDGER_WINDOW_DAYS;
  const c = costEfficiencyOf(ledger, ledgerKeys, { days });
  if (!c) return null;
  return {
    value: c.score,
    max: 100,
    bench: null,
    caveat: '¥' + c.cost_per_1m + '/1M tokens（' + c.calls + ' 次调用 / ' + c.tokens + ' tokens，近 ' + days + ' 天台账）',
    caliber: c.caliber,
  };
}

 
function eloFromDoc(doc, model, norm) {
  if (!doc || !Array.isArray(doc.entries)) return null;
  const m = typeof model === 'string' ? model.trim() : '';
  if (!m) return null;
  let entry = null;
  if (typeof norm === 'function') {
    const want = norm(m);
    if (!want) return null;
    
    
    
    const hits = doc.entries.filter((e) => e && typeof e.model === 'string' && !e.alias_of && norm(e.model) === want);
    entry = hits.length === 1 ? hits[0] : null; 
  } else {
    entry = doc.entries.find((e) => e && e.model === m);
  }
  if (!entry || entry.no_public_score) return null;
  const bs = entry.benchmarks && typeof entry.benchmarks === 'object' ? entry.benchmarks : {};
  for (const bench of ELO_BENCHES) {
    const b = bs[bench];
    if (!b || b.value == null) continue;
    const v = Number(b.value);
    if (!Number.isFinite(v)) continue; 
      return {
      bench,
      value: v,
      caveat: b.caveat || null,
      source_type: b.source_type || null,
      origin: b.origin || null,
      kind: b.kind || null,
      url: b.url || '',
      pageDate: b.pageDate || '',
    };
  }
  return null;
}

 
function findCatalogCard(catalog, model, normOf, provider) {
  const list = Array.isArray(catalog) ? catalog : [];
  if (typeof normOf !== 'function') {
    return list.find((c) => c && c.provider === provider && c.model === model) || null;
  }
  const want = normOf(model);
  if (!want) return null;
  const hits = list.filter((c) => c && typeof c.model === 'string' && normOf(c.model) === want);
  return hits.length === 1 ? hits[0] : null;
}

 

 
const SESSION_SPEED_CALIBER = '速度=本机真实出字速度：宿主会话投影缓存的 decodeTokens/decodeMs 按会话折算 tok/s，'
  + '过滤 decodeMs<5s 与 decodeTokens<500 的会话、剔除单会话 >1000 或 <1 tok/s 的坏计时，'
  + '按 (provider, model) 通道取**会话级中位数**；会话数<3 ⇒ 「？」（不造分）';
 
const BASE_SPEED_CALIBER = '速度=卡面手填估值（data/providers.json 的 base.速度）：本机读数、公开值、自埋点都没有时的最后兜底，'
  + '**不是实测值**；不参与 0.6/0.4 加权';

 
const SESSION_MIN_DECODE_MS = 5000;
const SESSION_MIN_DECODE_TOKENS = 500;
 
const SESSION_MAX_TPS = 1000;
const SESSION_MIN_TPS = 1;
 
const SESSION_MIN_SAMPLES = 3;

 
function lowerMedian(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

 
function speedFromSessions(rows, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const minSamples = Number.isFinite(o.minSamples) && o.minSamples > 0 ? o.minSamples : SESSION_MIN_SAMPLES;
  const minDecodeMs = Number.isFinite(o.minDecodeMs) && o.minDecodeMs > 0 ? o.minDecodeMs : SESSION_MIN_DECODE_MS;
  const minDecodeTokens = Number.isFinite(o.minDecodeTokens) && o.minDecodeTokens > 0 ? o.minDecodeTokens : SESSION_MIN_DECODE_TOKENS;
  const maxTps = Number.isFinite(o.maxTps) && o.maxTps > 0 ? o.maxTps : SESSION_MAX_TPS;
  const minTps = Number.isFinite(o.minTps) && o.minTps > 0 ? o.minTps : SESSION_MIN_TPS;
  const normOf = typeof o.normOf === 'function' ? o.normOf : null;

  const list = Array.isArray(rows) ? rows : [];
  const stats = { seen: list.length, kept: 0, dropped_short: 0, dropped_bad_rate: 0, no_channel: 0, below_min_samples: 0 };
  
  const channels = new Map();
  const byModel = new Map();

  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    const provider = r.provider == null ? '' : String(r.provider);
    const model = r.model == null ? '' : String(r.model);
    if (!provider || !model) { stats.no_channel += 1; continue; }
    const tokens = Number(r.decodeTokens);
    const ms = Number(r.decodeMs);
    if (!(ms >= minDecodeMs) || !(tokens >= minDecodeTokens)) { stats.dropped_short += 1; continue; }
    const tps = tokens / (ms / 1000);
    if (!(tps <= maxTps) || !(tps >= minTps)) { stats.dropped_bad_rate += 1; continue; }
    stats.kept += 1;
    
    const ttftMs = Number(r.ttftMs);
    const ttftSteps = Number(r.ttftSteps);
    const ttft = Number.isFinite(ttftMs) && ttftMs >= 0
      ? (Number.isFinite(ttftSteps) && ttftSteps > 0 ? ttftMs / ttftSteps : ttftMs)
      : null;
    const bucket = (map, key) => {
      if (!map.has(key)) map.set(key, { tps: [], ttft: [] });
      return map.get(key);
    };
    const ck = pairKey(provider, model);
    const ch = bucket(channels, ck);
    ch.tps.push(tps);
    if (ttft !== null) ch.ttft.push(ttft);
    if (normOf) {
      let ident = null;
      try { ident = normOf(model); } catch { ident = null; }
      if (ident) {
        const mb = bucket(byModel, String(ident));
        mb.tps.push(tps);
        if (ttft !== null) mb.ttft.push(ttft);
      }
    }
  }

   
  const finish = (b) => {
    if (!b || b.tps.length < minSamples) return null;
    return {
      tokens_per_sec: lowerMedian(b.tps),
      ttft_ms_median: lowerMedian(b.ttft),
      samples: b.tps.length,
      caliber: SESSION_SPEED_CALIBER,
    };
  };

  const channelOut = {};
  for (const [k, b] of channels.entries()) {
    const v = finish(b);
    if (v) channelOut[k] = v; else stats.below_min_samples += 1;
  }
  const modelOut = {};
  for (const [k, b] of byModel.entries()) {
    const v = finish(b);
    if (v) modelOut[k] = v;
  }

   
  function lookup(provider, model) {
    const p = provider == null ? '' : String(provider);
    const m = model == null ? '' : String(model);
    const hit = channelOut[pairKey(p, m)];
    if (hit) return hit;
    if (!normOf || !m) return null;
    let ident = null;
    try { ident = normOf(m); } catch { ident = null; }
    if (!ident) return null;
    const merged = modelOut[String(ident)];
    if (!merged) return null;
    return Object.assign({}, merged, {
      caliber: SESSION_SPEED_CALIBER + '（本通道无读数，取同模型其他通道的合并中位数）',
      merged_from_other_channels: true,
    });
  }

  return {
    channels: channelOut,
    byModel: modelOut,
    lookup,
    min_samples: minSamples,
    stats,
  };
}

 
const PUBLIC_SPEED_CALIBER = '公开速度＝厂商标称或第三方独立测速的输出 tok/s（满速口径，不含通道排队与本机负载）；'
  + '按**归一化模型身份**取（认模型不认通道），条目 tokens_per_sec 为 null 表示查过厂商/第三方页面确无数字，'
  + '**不许把一个模型的公开值借给另一个模型**';
 
const SPEED_WEIGHT_LOCAL = 0.6;
const SPEED_WEIGHT_PUBLIC = 0.4;
const SPEED_COMBINED_CALIBER = '速度＝0.6×本机实测 + 0.4×公开值（两路各自按同一把对数尺 10→0/100→77/200→100 折成 0-100 再加权）；'
  + '只有一路有值时用那一路；两路皆无 ⇒ 「？」。理由：公开值是模型本身的满速，'
  + '本机实测带了通道排队、号池与我们的负载，代表「你这条线实际多快」';

 
function eIdent(normOf, raw) {
  if (typeof normOf !== 'function') return null;
  try { const v = normOf(raw); return v == null ? null : String(v); } catch { return null; }
}

 
function publicSpeedFromDoc(doc, model, normOf) {
  if (!doc || typeof doc !== 'object') return null;
  const entries = Array.isArray(doc.entries) ? doc.entries : [];
  if (!entries.length || model == null || String(model) === '') return null;
  const want = String(model);
  let ident = null;
  if (typeof normOf === 'function') { try { ident = normOf(want); } catch { ident = null; } }
  const identStr = ident == null ? null : String(ident);
  let hit = null;
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    const em = e.model == null ? '' : String(e.model);
    if (em === want) { hit = e; break; }              
    if (!hit && identStr && eIdent(normOf, em) === identStr) hit = e;  
  }
  if (!hit) return null;
  const tps = Number(hit.tokens_per_sec);
  return {
    model: String(hit.model),
    
    tokens_per_sec: Number.isFinite(tps) && tps > 0 ? tps : null,
    source_type: hit.source_type == null ? null : String(hit.source_type),
    url: hit.url == null ? '' : String(hit.url),
    pageDate: hit.page_date == null ? null : String(hit.page_date),
    note: hit.note == null ? '' : String(hit.note),
    caliber: PUBLIC_SPEED_CALIBER,
  };
}

 
function speedScoreCombine(local, pub) {
  const lt = local && typeof local === 'object' ? local.tokens_per_sec : null;
  const pt = pub && typeof pub === 'object' ? pub.tokens_per_sec : null;
  const ls = speedScoreFromTps(lt);
  const ps = speedScoreFromTps(pt);
  let score = null;
  let weighted = false;
  if (ls !== null && ps !== null) {
    score = Math.round(SPEED_WEIGHT_LOCAL * ls + SPEED_WEIGHT_PUBLIC * ps);
    weighted = true;
  } else if (ls !== null) score = ls;
  else if (ps !== null) score = ps;
  if (score === null) return null;
  score = Math.max(0, Math.min(100, score));
  return { score, local_score: ls, public_score: ps, weighted, local: lt, public: pt };
}

 
function publicSpeedText(pub) {
  if (!pub || typeof pub !== 'object' || pub.tokens_per_sec == null) {
    return '公开值缺（查过厂商与第三方页面，无数字）';
  }
  const n = Math.round(Number(pub.tokens_per_sec));
  if (pub.source_type === 'vendor') return '厂商标称 ' + n + '+';
  if (pub.source_type === 'third-party') return '公开 ' + n + '（AA，第三方）';
  return '公开 ' + n;
}

 
function speedItem(sessionAgg, meterAgg, pub, baseSpeed) {
  const s = speedScoreFromAgg(sessionAgg);
  const p = pub && typeof pub === 'object' && pub.tokens_per_sec != null
    ? { score: speedScoreFromTps(pub.tokens_per_sec) } : null;
  const combined = speedScoreCombine(sessionAgg, pub && typeof pub === 'object' ? pub : null);
  if (combined && (ls0(s) !== null || ls0(p) !== null)) {
    const segs = [];
    if (s) segs.push('本机 ' + s.tokens_per_sec + ' tok/s（' + s.samples + ' 个会话的中位数）');
    if (p) segs.push(publicSpeedText(pub));
    return {
      value: combined.score,
      max: 100,
      bench: null,
      caveat: segs.join(' · '),
      
      caliber: combined.weighted
        ? SPEED_COMBINED_CALIBER
        : (s ? (sessionAgg.caliber || SESSION_SPEED_CALIBER) : PUBLIC_SPEED_CALIBER),
    };
  }
  const m = speedScoreFromAgg(meterAgg);
  if (m) {
    return {
      value: m.score,
      max: 100,
      bench: null,
      caveat: m.tokens_per_sec + ' tokens/s（' + m.samples + ' 个自埋点样本）'
        + (pub ? '；' + publicSpeedText(pub) + '（本机无实测读数，未参与加权）' : ''),
      caliber: m.caliber,
    };
  }
  
  
  
  
  const hasBase = !(baseSpeed == null) && !(typeof baseSpeed === 'string' && baseSpeed.trim() === '');
  const b = hasBase ? Number(baseSpeed) : NaN;
  if (Number.isFinite(b)) {
    return {
      value: Math.max(0, Math.min(100, Math.round(b))),
      max: 100,
      bench: null,
      caveat: '卡面手填估值（data/providers.json 的 base.速度，本机与公开侧都无读数）',
      caliber: BASE_SPEED_CALIBER,
    };
  }
  return null;
}
 
function ls0(x) { return x && Number.isFinite(Number(x.score)) ? x : null; }

 
function measuredCards(args) {
  const a = args && typeof args === 'object' ? args : {};
  const keys = Array.isArray(a.keys) && a.keys.length > 0 ? a.keys.slice() : FACE_ITEM_KEYS.slice();
  const sourceOf = a.sourceOf && typeof a.sourceOf === 'object' ? a.sourceOf : {};
  const nowMs = Number.isFinite(a.nowMs) ? a.nowMs : 0;
  const routes = a.routes && typeof a.routes === 'object' ? a.routes : {};
  const nameMap = a.nameMap || null;
  const seen = normalizeSeen(a.seen);
  const speedOf = typeof a.speedOf === 'function' ? a.speedOf : () => null;
  
  
  const sessionSpeed = a.sessionSpeed && typeof a.sessionSpeed === 'object' ? a.sessionSpeed : null;
  
  
  const publicSpeedDoc = a.publicSpeedDoc && typeof a.publicSpeedDoc === 'object' ? a.publicSpeedDoc : null;
  const benchDoc = a.benchDoc && typeof a.benchDoc === 'object' ? a.benchDoc : null;
  
  
  
  const normOf = typeof a.normOf === 'function'
    ? a.normOf
    : (typeof normModel === 'function' ? normModel : null);
  const catalog = Array.isArray(a.cards) ? a.cards : [];
  const wantProvider = a.provider == null ? '' : String(a.provider).trim();
  const wantModel = a.model == null ? '' : String(a.model).trim();

  
  
  
  
  
  
  
  let list;
  if (wantProvider && wantModel) {
    const hit = findCatalogCard(catalog, wantModel, normOf, wantProvider);
    list = [{
      card: hit || null,
      provider: wantProvider,
      model: wantModel,
      catalog_hit: hit !== null,
    }];
  } else {
    list = catalog
      .filter((c) => c && c.provider && c.model)
      .map((c) => ({ card: c, provider: String(c.provider), model: String(c.model), catalog_hit: true }));
  }

  const cards = {};
  const seenOut = {};
  for (const row of list) {
    const card = row.card;
    const provider = row.provider;
    const model = row.model;
    
    const identModel = String((card && card.model) || model);
    const entry = nameMap ? nameMapEntry(nameMap, provider, model) : null;
    const routeNames = entry && Array.isArray(entry.routes) ? entry.routes : [];
    const ledgerKeys = entry && Array.isArray(entry.ledger_keys) ? entry.ledger_keys : [];
    const meterAgg = speedOf(provider, model);
    
    
    
    const sessionAgg = sessionSpeed && typeof sessionSpeed.lookup === 'function'
      ? sessionSpeed.lookup(provider, model)
      : null;
    
    const pubSpeed = publicSpeedDoc ? publicSpeedFromDoc(publicSpeedDoc, identModel, normOf) : null;
    const speedAgg = sessionAgg || meterAgg || null;
    
    
    const elo = eloFromDoc(benchDoc, identModel, normOf);
    const base = card && card.base && typeof card.base === 'object' ? card.base : {};
    const measuredItems = {
      '稳定': stabilityItem(routes, routeNames, nowMs),
      '性价比': costItem(a.ledger, ledgerKeys, { days: a.ledgerDays }),
      '速度': speedItem(sessionAgg, meterAgg, pubSpeed, base['速度']),
    };

    const axes = {};
    for (const k of keys) {
      const isMeasured = FACE_ITEM_KEYS.indexOf(k) >= 0;
      let item = null;
      if (isMeasured) {
        item = measuredItems[k] || null;
      } else if (base[k] !== undefined && base[k] !== null && Number.isFinite(Number(base[k]))) {
        
        item = {
          value: Number(base[k]),
          max: 100,
          bench: null,
          caveat: '卡面手填展示分（data/providers.json 的 base）',
          caliber: sourceOf[k] ? String(sourceOf[k]) + '口径' : null,
        };
      }
      const folded = uniformScore(item);
      axes[k] = {
        label: k,
        
        ranked: folded.status === 'ok',
        status: folded.status,
        score: folded.score,
        raw: folded.raw,
        text: folded.text,
        note: folded.note,
        source: isMeasured ? 'measured' : 'catalog',
        caliber: item && item.caliber ? item.caliber : null,
        tooltip: scoreTooltip({
          label: k,
          status: folded.status,
          raw: folded.raw,
          score: folded.score,
          caveat: item ? item.caveat : null,
          caliber: item ? item.caliber : null,
        }),
      };
    }

    const key = seenKey(provider, model);
    const seenAt = Object.prototype.hasOwnProperty.call(seen.seen, key) ? seen.seen[key] : null;
    cards[pairKey(provider, model)] = {
      provider,
      model,
      
      
      
      mapped: entry !== null,
      
      
      catalog_hit: row.catalog_hit === true,
      routes: routeNames.slice(),
      ledger_keys: ledgerKeys.slice(),
      axes,
      
      
      calibers: {
        '稳定': STABILITY_CALIBER,
        '性价比': COST_CALIBER,
        
        
        
        '速度': SPEED_COMBINED_CALIBER,
      },
      
      
      speed: speedAgg && typeof speedAgg === 'object' ? Object.assign({}, speedAgg) : null,
      
      
      speed_source: sessionAgg ? 'session' : (meterAgg ? 'meter' : null),
      
      speed_public: pubSpeed ? Object.assign({}, pubSpeed) : null,
      
      speed_combine: (function () {
        const c = speedScoreCombine(sessionAgg, pubSpeed);
        return c ? { score: c.score, local_score: c.local_score, public_score: c.public_score, weighted: c.weighted } : null;
      })(),
      
      
      elo: elo && typeof elo === 'object' ? Object.assign({}, elo) : null,
      playMode: resolvePlayMode(seen, provider, model),
      seen_key: key,
      seen_at: seenAt,
    };
    
    if (seenAt) seenOut[key] = seenAt;
  }

  return {
    at: nowMs,
    cards,
    seen: seenOut,
    
    
    storage: {
      file: a.seenFile == null ? null : String(a.seenFile),
      global: SEEN_GLOBAL,
      version: SEEN_VERSION,
      max: SEEN_MAX,
      entries: Object.keys(seen.seen).length,
    },
    link_ms: a.linkMs && typeof a.linkMs === 'object' ? a.linkMs : null,
  };
}

 
function createLinkMeter(opts) {
  const o = opts || {};
  const maxSamples = Number.isFinite(o.maxSamples) && o.maxSamples > 0 ? o.maxSamples : LINK_SAMPLES_MAX;
  const byPath = new Map();

  function record(path, ms) {
    const p = path == null ? '' : String(path);
    const v = Number(ms);
    if (p.length === 0 || !Number.isFinite(v) || v < 0) return false;
    if (!byPath.has(p)) byPath.set(p, []);
    const rows = byPath.get(p);
    rows.push(v);
    if (rows.length > maxSamples) rows.splice(0, rows.length - maxSamples);
    return true;
  }

  function aggregate() {
    const out = {};
    for (const [p, rows] of byPath.entries()) {
      if (rows.length === 0) continue;
      const sorted = rows.slice().sort((x, y) => x - y);
      let sum = 0;
      for (const v of rows) sum += v;
      out[p] = {
        calls: rows.length,
        last_ms: rows[rows.length - 1],
        avg_ms: Math.round((sum / rows.length) * 10) / 10,
        p95_ms: sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * 0.95))],
      };
    }
    return out;
  }

  return { record, aggregate, maxSamples };
}

 
function planMeasuredRequest(method, query, body) {
  const m = String(method || '').toUpperCase();
  const q = query && typeof query === 'object' ? query : {};
  const pick = (v) => (v == null ? '' : String(v).trim());
  if (m === 'GET') {
    return { action: 'snapshot', provider: pick(q.provider), model: pick(q.model) };
  }
  if (m === 'POST') {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'bad-body' };
    const provider = pick(body.provider);
    const model = pick(body.model);
    if (!provider || !model) return { error: 'bad-card' };
    if (body.tokens !== undefined || body.durationMs !== undefined) {
      const tokens = Number(body.tokens);
      const durationMs = Number(body.durationMs);
      if (!(tokens >= 0) || !(durationMs > 0)) return { error: 'bad-sample' };
      const rawTtft = body.ttftMs === undefined || body.ttftMs === null ? null : Number(body.ttftMs);
      if (rawTtft !== null && !(rawTtft >= 0)) return { error: 'bad-sample' };
      return { action: 'record-speed', provider, model, tokens, durationMs, ttftMs: rawTtft };
    }
    return { action: 'mark-seen', provider, model };
  }
  return { error: 'bad-method' };
}

module.exports.FACE_ITEM_KEYS = FACE_ITEM_KEYS;
module.exports.LEDGER_WINDOW_DAYS = LEDGER_WINDOW_DAYS;
module.exports.LINK_SAMPLES_MAX = LINK_SAMPLES_MAX;
module.exports.SEEN_GLOBAL = SEEN_GLOBAL;
module.exports.SESSION_SPEED_CALIBER = SESSION_SPEED_CALIBER;
module.exports.BASE_SPEED_CALIBER = BASE_SPEED_CALIBER;
module.exports.SESSION_MIN_SAMPLES = SESSION_MIN_SAMPLES;
module.exports.speedFromSessions = speedFromSessions;
module.exports.PUBLIC_SPEED_CALIBER = PUBLIC_SPEED_CALIBER;
module.exports.SPEED_COMBINED_CALIBER = SPEED_COMBINED_CALIBER;
module.exports.SPEED_WEIGHT_LOCAL = SPEED_WEIGHT_LOCAL;
module.exports.SPEED_WEIGHT_PUBLIC = SPEED_WEIGHT_PUBLIC;
module.exports.publicSpeedFromDoc = publicSpeedFromDoc;
module.exports.speedScoreFromTps = speedScoreFromTps;
module.exports.speedScoreCombine = speedScoreCombine;
module.exports.publicSpeedText = publicSpeedText;
module.exports.stabilityItem = stabilityItem;
module.exports.costItem = costItem;
module.exports.speedItem = speedItem;
module.exports.eloFromDoc = eloFromDoc;
module.exports.findCatalogCard = findCatalogCard;
module.exports.measuredCards = measuredCards;
module.exports.createLinkMeter = createLinkMeter;
module.exports.planMeasuredRequest = planMeasuredRequest;
