'use strict';
 

 
const THRESHOLDS = { warn: 0.4, urgent: 0.2, critical: 0.05 };

 
const LEVELS = ['ok', 'warn', 'urgent', 'critical'];

 
const MESSAGE_KEYS = {
  warn: 'quota.warn',
  urgent: 'quota.urgent', 
  critical: 'quota.critical',
  recover: 'quota.recover', 
  unknown: 'quota.unknown',
  na: 'quota.neutral', 
};

 
const EVENT_TYPES = ['warn', 'urgent', 'critical', 'recover'];

 
const WINDOW_KINDS = ['window5h', 'weekly', 'quota'];

 
const SOURCE_RUNTIME = 'routing-runtime';
const RUNTIME_SNAPSHOT_FILENAME = 'routing-runtime.json';

 
const ROW_STATES = ['ok', '降级', '陈旧'];

 
const DEEPSEEK_OFFICIAL_PROVIDERS = ['deepseek-official', 'deepseek-account'];
 
const BALANCE_SOURCE_PROVIDERS = { 'deepseek-account': 'deepseek-official' };
const OFFICIAL_PEAK_PROVIDERS = DEEPSEEK_OFFICIAL_PROVIDERS;
const OFFICIAL_PEAK_HOURS = [[9, 12], [14, 18]];
const OFFICIAL_PEAK_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
 
const PEAK_STATES = ['peak', 'off'];

 
const CG_SLOTS = ['warning', 'recover', 'summon'];
const CG_ALERT_LEVELS = ['urgent', 'critical'];
const RECOVER_CG_MS = 12000;

 
function nowOf(opts) {
  return typeof (opts && opts.now) === 'function' ? opts.now : () => Date.now();
}

 
function isValid(win, atMs) {
  const vu = win && win.valid_until;
  if (typeof vu !== 'string' || !vu) return false;
  const t = Date.parse(vu);
  if (!Number.isFinite(t)) return false;
  return atMs < t;
}

 
function usedOf(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (typeof obj.used_fraction === 'number' && Number.isFinite(obj.used_fraction)) {
    return obj.used_fraction;
  }
  if (typeof obj.remaining_fraction === 'number' && Number.isFinite(obj.remaining_fraction)) {
    return 1 - obj.remaining_fraction;
  }
  return null;
}

 
function clamp01(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.min(1, Math.max(0, v));
}

 
function round10(v) {
  return Math.round(v * 1e10) / 1e10;
}

 
function levelOf(rem, obj) {
  if (obj && obj.state === 'exhausted') return 'critical';
  if (rem === null || rem === undefined) return null;
  if (rem < THRESHOLDS.critical) return 'critical';
  if (rem < THRESHOLDS.urgent) return 'urgent';
  if (rem < THRESHOLDS.warn) return 'warn';
  return 'ok';
}

 
function windowStatus(win, opts) {
  if (win === undefined || win === null) return null;
  const atMs = nowOf(opts)();
  if (win === 'n/a') {
    return { level: 'na', used_fraction: null, remaining_fraction: null, valid: false, reset_at: null, message_key: MESSAGE_KEYS.na, reason: 'no-window' };
  }
  if (typeof win !== 'object') {
    return { level: 'unknown', used_fraction: null, remaining_fraction: null, valid: false, reset_at: null, message_key: MESSAGE_KEYS.unknown, reason: 'bad-shape' };
  }
  const valid = isValid(win, atMs);
  const reset_at = typeof win.reset_at === 'string' ? win.reset_at : null;
  const used = clamp01(usedOf(win));
  
  const rem = used === null ? null : clamp01(round10(1 - used));
  if (!valid) {
    return { level: 'unknown', used_fraction: used, remaining_fraction: rem, valid: false, reset_at, message_key: MESSAGE_KEYS.unknown, reason: 'stale-or-missing' };
  }
  const level = levelOf(rem, win);
  if (level === null) {
    
    return { level: 'unknown', used_fraction: null, remaining_fraction: null, valid: true, reset_at, message_key: MESSAGE_KEYS.unknown, reason: 'no-fraction' };
  }
  return {
    level,
    used_fraction: used,
    remaining_fraction: rem,
    valid: true,
    reset_at,
    message_key: level === 'ok' ? null : MESSAGE_KEYS[level],
    reason: null,
  };
}

 
function tightness(level) {
  const i = LEVELS.indexOf(level);
  return i === -1 ? 0 : i;
}

 
function routeStatus(routeEntry, opts) {
  const windows = { window5h: null, weekly: null, quota: null };
  if (!routeEntry || typeof routeEntry !== 'object') {
    return { level: 'unknown', binding_window: null, windows, message_key: MESSAGE_KEYS.unknown };
  }
  windows.window5h = windowStatus(routeEntry.window5h, opts);
  windows.weekly = windowStatus(routeEntry.weekly, opts);

  
  
  const hasWindowLevel = [windows.window5h, windows.weekly].some(
    (w) => w && LEVELS.indexOf(w.level) !== -1
  );
  if (!hasWindowLevel && routeEntry.quota && typeof routeEntry.quota === 'object') {
    const q = routeEntry.quota;
    if (typeof q.remaining_fraction === 'number') {
      windows.quota = windowStatus(q, opts);
    } else if (q.state === 'exhausted' && isValid(q, nowOf(opts)())) {
      windows.quota = { level: 'critical', used_fraction: 1, remaining_fraction: 0, valid: true, reset_at: typeof q.reset_at === 'string' ? q.reset_at : null, message_key: MESSAGE_KEYS.critical, reason: 'state-exhausted' };
    } else {
      
      windows.quota = { level: 'na', used_fraction: null, remaining_fraction: null, valid: isValid(q, nowOf(opts)()), reset_at: null, message_key: MESSAGE_KEYS.na, reason: 'no-fraction-semantics' };
    }
  }

  
  
  let best = null;
  for (const kind of WINDOW_KINDS) {
    const w = windows[kind];
    if (!w || LEVELS.indexOf(w.level) === -1) continue;
    if (
      best === null ||
      tightness(w.level) > tightness(best.level) ||
      (tightness(w.level) === tightness(best.level) && (w.used_fraction || 0) > (windows[best.kind].used_fraction || 0))
    ) {
      best = { kind, level: w.level };
    }
  }
  if (best) {
    return { level: best.level, binding_window: best.kind, windows, message_key: best.level === 'ok' ? null : MESSAGE_KEYS[best.level] };
  }
  const anyUnknown = [windows.window5h, windows.weekly, windows.quota].some((w) => w && w.level === 'unknown');
  const level = anyUnknown ? 'unknown' : 'na';
  return { level, binding_window: null, windows, message_key: MESSAGE_KEYS[level] };
}

 
function evaluate(snapshot, opts) {
  const routes = {};
  const list = snapshot && snapshot.routes && typeof snapshot.routes === 'object' ? snapshot.routes : {};
  for (const name of Object.keys(list)) {
    routes[name] = routeStatus(list[name], opts);
  }
  return { routes };
}

 
function createQuotaEvents(opts) {
  const now = nowOf(opts);
  const seen = new Map(); 
  const prev = new Map(); 

  function pushEvent(events, type, route, kind, st) {
    const dedupKey = `${route}|${kind}|${st.reset_at}|${type === 'recover' ? 'ok' : type}`;
    if (seen.has(dedupKey)) return;
    seen.set(dedupKey, true);
    events.push({
      type,
      route,
      window: kind,
      level: type === 'recover' ? 'ok' : type,
      reset_at: st.reset_at,
      dedup_key: dedupKey,
      message_key: MESSAGE_KEYS[type],
      speak: type !== 'warn', 
      used_fraction: st.used_fraction,
      remaining_fraction: st.remaining_fraction,
    });
  }

  return {
     
    ingest(snapshot, ingestOpts) {
      
      const src = ingestOpts && typeof ingestOpts.now === 'function' ? ingestOpts : opts;
      const atMs = nowOf(src)();
      const evs = [];
      const { routes } = evaluate(snapshot, { now: () => atMs });
      for (const route of Object.keys(routes)) {
        const st = routes[route];
        for (const kind of WINDOW_KINDS) {
          const w = st.windows[kind];
          if (!w) continue;
          const key = `${route}|${kind}`;
          const before = prev.get(key) || null;
          if (LEVELS.indexOf(w.level) !== -1 && w.level !== 'ok') {
            pushEvent(evs, w.level, route, kind, w);
          } else if (w.level === 'ok' && before && before.level !== 'ok' && LEVELS.indexOf(before.level) !== -1) {
            
            
            const resetChanged = before.reset_at !== null && w.reset_at !== null && before.reset_at !== w.reset_at;
            if (resetChanged && before.valid && w.valid) {
              pushEvent(evs, 'recover', route, kind, w);
            }
          }
          prev.set(key, { level: w.level, valid: w.valid, reset_at: w.reset_at });
        }
      }
      return evs;
    },
     
    reset() {
      seen.clear();
      prev.clear();
    },
     
    seenKeys() {
      return Array.from(seen.keys());
    },
  };
}

 
function loadNameMap(doc) {
  const version = doc && doc.version === 1 ? 1 : 0;
  const raw = doc && Array.isArray(doc.entries) ? doc.entries : [];
  const entries = raw.map((e) => {
    const route = typeof e.route === 'string' ? e.route : null;
    const provider = typeof e.provider === 'string' ? e.provider : null;
    const model = typeof e.model === 'string' ? e.model : null;
    return {
      route,
      provider,
      model,
      provider_model: provider && model ? `${provider}/${model}` : null,
      dataset_model: typeof e.dataset_model === 'string' ? e.dataset_model : null,
      confirmed: e.confirmed === true,
      note: typeof e.note === 'string' ? e.note : null,
    };
  });
  
  const rawProviderRoutes = doc && Array.isArray(doc.provider_routes) ? doc.provider_routes : [];
  const providerRoutes = rawProviderRoutes.map((r) => {
    const pr = r && typeof r === 'object' ? r : {};
    return {
      provider: typeof pr.provider === 'string' ? pr.provider : null,
      route: typeof pr.route === 'string' ? pr.route : null,
      basis: typeof pr.basis === 'string' ? pr.basis : null,
      evidence: typeof pr.evidence === 'string' ? pr.evidence : null,
    };
  });
  return { version, entries, provider_routes: providerRoutes };
}

 
function mapRoute(nameMap, route) {
  if (!nameMap || !Array.isArray(nameMap.entries)) return null;
  return nameMap.entries.find((e) => e.route === route) || null;
}

 
function displayOf(nameMap, route) {
  const entry = mapRoute(nameMap, route);
  return entry && entry.provider_model ? entry.provider_model : route;
}

 
function routeKeyOf(s) {
  return String(s).toLowerCase().replace(/\./g, '-').replace(/-+/g, '-');
}

 
function providerRouteOf(nameMap, provider) {
  if (!nameMap || !Array.isArray(nameMap.provider_routes)) return null;
  if (typeof provider !== 'string' || !provider) return null;
  for (const r of nameMap.provider_routes) {
    if (!r || typeof r !== 'object') continue;
    if (r.provider !== provider) continue;
    if (typeof r.route !== 'string' || !r.route) continue;
    return r.route;
  }
  return null;
}

 
function routeLookup(nameMap, provider, model, opts) {
  if (!nameMap || !Array.isArray(nameMap.entries)) return { route: null, reason: 'none', candidates: [] };
  const p = typeof provider === 'string' ? provider : '';
  const m = typeof model === 'string' ? model : '';
  if (!p || !m) return { route: null, reason: 'none', candidates: [] };
  const effP = opts && opts.mergeAccount ? (BALANCE_SOURCE_PROVIDERS[p] || p) : p;
  const entries = nameMap.entries;
  
  for (const e of entries) {
    if (e && e.provider === effP && e.model === m && e.route) {
      return { route: e.route, reason: 'exact', candidates: [e.route] };
    }
  }
  
  const key = routeKeyOf(m);
  const candidates = [];
  for (const e of entries) {
    if (!e || e.provider !== effP || !e.route) continue;
    if (typeof e.model !== 'string') continue;
    if (routeKeyOf(e.model) !== key) continue;
    if (candidates.indexOf(e.route) < 0) candidates.push(e.route);
  }
  
  if (candidates.length > 1) return { route: null, reason: 'ambiguous', candidates };
  if (candidates.length === 1) return { route: candidates[0], reason: 'normalized', candidates };
  
  const providerRoute = providerRouteOf(nameMap, effP);
  if (providerRoute) return { route: providerRoute, reason: 'provider', candidates: [providerRoute] };
  return { route: null, reason: 'none', candidates: [] };
}

 
function routeOf(nameMap, provider, model, opts) {
  return routeLookup(nameMap, provider, model, opts).route;
}

 
function rowState(st) {
  if (!st) return null;
  if (st.reason === 'stale-or-missing') return '陈旧';
  if (LEVELS.indexOf(st.level) !== -1) return 'ok';
  return '降级';
}

 
function isoOrNull(v) {
  return typeof v === 'string' && v ? v : null;
}

 
function providerOfRoute(nameMap, route) {
  const entry = mapRoute(nameMap, route);
  if (entry && entry.provider) return entry.provider;
  const s = typeof route === 'string' ? route : '';
  const i = s.indexOf('/');
  return i > 0 ? s.slice(0, i) : '';
}

 
function officialPeakState(provider, atMs) {
  const p = typeof provider === 'string' ? provider : '';
  if (OFFICIAL_PEAK_PROVIDERS.indexOf(p) === -1) return null;
  if (typeof atMs !== 'number' || !Number.isFinite(atMs)) return null;
  const d = new Date(atMs + OFFICIAL_PEAK_UTC_OFFSET_MS);
  const wd = d.getUTCDay(); 
  const h = d.getUTCHours() + d.getUTCMinutes() / 60;
  if (wd < 1 || wd > 5) return 'off'; 
  for (const win of OFFICIAL_PEAK_HOURS) {
    if (h >= win[0] && h < win[1]) return 'peak';
  }
  return 'off';
}

 
function ageMsOf(observedAt, nowMs) {
  if (!observedAt || typeof nowMs !== 'number') return null;
  const t = Date.parse(observedAt);
  if (!Number.isFinite(t)) return null;
  return nowMs - t;
}

 
const ROW_STATE_ORDER = { ok: 0, 降级: 1, 陈旧: 2 };

 
function rowStateOrder(state) {
  const v = ROW_STATE_ORDER[state];
  return typeof v === 'number' ? v : 1;
}

 
function unknownStateCount(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let n = 0;
  for (const row of list) {
    if (row && ROW_STATE_ORDER[row.state] === undefined) n += 1;
  }
  return n;
}

function compareRows(a, b) {
  const sa = rowStateOrder(a.state);
  const sb = rowStateOrder(b.state);
  if (sa !== sb) return sb - sa;
  const ta = tightness(a.level);
  const tb = tightness(b.level);
  if (ta !== tb) return tb - ta;
  if (a.route !== b.route) return a.route < b.route ? -1 : 1;
  return WINDOW_KINDS.indexOf(a.window) - WINDOW_KINDS.indexOf(b.window);
}

 
function snapshotRows(snapshot, evaluated, opts) {
  const o = opts || {};
  const nowMs = typeof o.now === 'number' ? o.now : null;
  const labels = o.labels && typeof o.labels === 'object' ? o.labels : {};
  const routes = snapshot && snapshot.routes && typeof snapshot.routes === 'object' ? snapshot.routes : {};
  const judged = evaluated && evaluated.routes && typeof evaluated.routes === 'object' ? evaluated.routes : {};
  const rows = [];
  for (const route of Object.keys(routes)) {
    const st = judged[route];
    if (!st || !st.windows) continue;
    const entry = routes[route];
    const provider = providerOfRoute(o.nameMap, route);
    for (const kind of WINDOW_KINDS) {
      const win = st.windows[kind];
      if (!win) continue;
      const raw = entry && typeof entry === 'object' ? entry[kind] : null;
      const reading = raw && typeof raw === 'object' ? raw : null;
      const remaining = typeof win.remaining_fraction === 'number' ? win.remaining_fraction : null;
      const observedAt = reading ? isoOrNull(reading.observed_at) : null;
      
      
      
      
      const metered = win.level === 'na' && win.reason === 'no-fraction-semantics';
      const balance = metered && reading
        && typeof reading.balance_cny === 'number' && Number.isFinite(reading.balance_cny)
        ? reading.balance_cny
        : null;
      rows.push({
        route,
        display: displayOf(o.nameMap, route),
        window: kind,
        windowLabel: labels[kind] || kind,
        level: win.level,
        remaining_fraction: remaining,
        used: remaining === null ? null : Math.round((1 - remaining) * 1000) / 10,
        reset_at: win.reset_at === undefined ? null : win.reset_at,
        state: rowState(win),
        observed_at: observedAt,
        valid_until: reading ? isoOrNull(reading.valid_until) : null,
        age_ms: ageMsOf(observedAt, nowMs),
        source: SOURCE_RUNTIME,
        
        
        balance_cny: balance,
        peak: metered ? officialPeakState(BALANCE_SOURCE_PROVIDERS[provider] || provider, nowMs) : null,
      });
    }
  }
  rows.sort(compareRows);
  return rows;
}

 
function latestReading(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let best = null;
  let bestMs = NaN;
  for (const row of list) {
    if (!row || !row.observed_at) continue;
    const t = Date.parse(row.observed_at);
    if (best === null || (Number.isFinite(t) && (!Number.isFinite(bestMs) || t > bestMs))) {
      best = row;
      bestMs = t;
    }
  }
  if (!best) return null;
  return { observed_at: best.observed_at, valid_until: best.valid_until, route: best.route, window: best.window };
}

 
function rowsStale(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return true;
  return !list.some((r) => r && r.state === 'ok');
}

 
function tightestLevelOf(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let best = null;
  for (const row of list) {
    if (!row || LEVELS.indexOf(row.level) < 0) continue;
    if (best === null || LEVELS.indexOf(row.level) > LEVELS.indexOf(best)) best = row.level;
  }
  return best;
}

 
function selectedCg(selection, rows, prev, nowMs, opts) {
  const o = opts || {};
  const now = Number.isFinite(nowMs) ? nowMs : null;
  const recoverMs = Number.isFinite(o.recoverMs) && o.recoverMs > 0 ? o.recoverMs : RECOVER_CG_MS;
  const route =
    selection && typeof selection.route === 'string' && selection.route ? selection.route : null;
  
  if (o.snapshotOk === false) {
    return { slot: 'summon', route: null, level: null, reason: 'no-selection', next: prev || null };
  }
  
  if (!route) {
    return { slot: 'summon', route: null, level: null, reason: 'no-selection', next: prev || null };
  }
  const level = tightestLevelOf(rows);
  const p = prev && prev.route === route ? prev : null;
  
  if (CG_ALERT_LEVELS.indexOf(level) >= 0) {
    return { slot: 'warning', route, level, reason: 'level:' + level, next: { route, level, at: now } };
  }
  
  
  
  if (p && CG_ALERT_LEVELS.indexOf(p.level) >= 0) {
    const at = Number.isFinite(p.at) ? p.at : null;
    if (at !== null && now !== null && now >= at && now - at <= recoverMs) {
      return { slot: 'recover', route, level, reason: 'recover', next: { route, level: p.level, at } };
    }
  }
  
  return { slot: 'summon', route, level, reason: 'ok', next: { route, level, at: now } };
}

module.exports = {
  THRESHOLDS,
  LEVELS,
  MESSAGE_KEYS,
  EVENT_TYPES,
  WINDOW_KINDS,
  SOURCE_RUNTIME,
  RUNTIME_SNAPSHOT_FILENAME,
  ROW_STATES,
  ROW_STATE_ORDER,
  OFFICIAL_PEAK_PROVIDERS,
  DEEPSEEK_OFFICIAL_PROVIDERS,
  BALANCE_SOURCE_PROVIDERS,
  OFFICIAL_PEAK_HOURS,
  PEAK_STATES,
  CG_SLOTS,
  CG_ALERT_LEVELS,
  RECOVER_CG_MS,
  windowStatus,
  routeStatus,
  evaluate,
  createQuotaEvents,
  loadNameMap,
  mapRoute,
  displayOf,
  routeOf,
  routeLookup,
  routeKeyOf,
  rowState,
  rowStateOrder,
  unknownStateCount,
  compareRows,
  providerOfRoute,
  officialPeakState,
  snapshotRows,
  latestReading,
  rowsStale,
  tightestLevelOf,
  selectedCg,
};
