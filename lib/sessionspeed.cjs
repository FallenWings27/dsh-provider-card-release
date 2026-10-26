'use strict';
 


const FULL_PARSE_MAX_CHARS = 64 * 1024;

const DEFAULT_YIELD_EVERY = 20;



 
function sliceJsonValue(text, key) {
  const needle = '"' + key + '"';
  const at = text.indexOf(needle);
  if (at < 0) return null;
  let i = at + needle.length;
  const isWs = (c) => c === ' ' || c === '\n' || c === '\r' || c === '\t';
  while (i < text.length && isWs(text[i])) i += 1;
  if (text[i] !== ':') return null;
  i += 1;
  while (i < text.length && isWs(text[i])) i += 1;
  const open = text[i];
  if (open !== '{' && open !== '[') return null;
  const end = matchBracketEnd(text, i);
  if (end < 0) return null;
  return text.slice(i, end);
}

 
function matchBracketEnd(text, start) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{' || c === '[') { depth += 1; continue; }
    if (c === '}' || c === ']') {
      depth -= 1;
      if (depth === 0) return i + 1;
      if (depth < 0) return -1;
    }
  }
  return -1;
}

 
function rowFromParts(statsRow, selRow) {
  const stats = statsRow && typeof statsRow === 'object' ? statsRow.val : null;
  const sel = selRow && typeof selRow === 'object' ? selRow.val : null;
  const used = sel && typeof sel === 'object' ? sel.lastUsed : null;
  if (!stats || typeof stats !== 'object' || !used || typeof used !== 'object') return null;
  const provider = used.provider == null ? '' : String(used.provider);
  const model = used.model == null ? '' : String(used.model);
  if (!provider || !model) return null;
  return {
    provider,
    model,
    decodeTokens: stats.decodeTokens,
    decodeMs: stats.decodeMs,
    ttftMs: stats.ttftMs,
    ttftSteps: stats.ttftSteps,
  };
}

 
function rowFromDoc(doc) {
  const record = doc && typeof doc === 'object' ? doc.record : null;
  const recRows = record && typeof record === 'object' ? record.rows : null;
  if (!recRows || typeof recRows !== 'object') return null;
  return rowFromParts(recRows.sessionStats, recRows.modelSelection);
}

 
function rowFromText(text) {
  if (typeof text !== 'string' || text === '') return { row: null, via: 'full' };
  if (text.length <= FULL_PARSE_MAX_CHARS) {
    return { row: rowFromDoc(JSON.parse(text)), via: 'full' };
  }
  
  const statsText = sliceJsonValue(text, 'sessionStats');
  const selText = sliceJsonValue(text, 'modelSelection');
  if (statsText !== null && selText !== null) {
    try {
      const row = rowFromParts(JSON.parse(statsText), JSON.parse(selText));
      if (row !== null) return { row, via: 'slice' };
    } catch {
      
    }
  }
  return { row: rowFromDoc(JSON.parse(text)), via: 'full' };
}

 
function isScannableName(name) {
  return !!name && name.charAt(name.length - 5) === '.';
}

 
function createScanner(o) {
  const opts = o && typeof o === 'object' ? o : {};
  const fsp = opts.fs || null;
  const nodePath = opts.path || null;
  const dir = typeof opts.dir === 'string' ? opts.dir : '';
  const windowMs = Number.isFinite(opts.windowMs) && opts.windowMs > 0 ? opts.windowMs : 7 * 24 * 60 * 60 * 1000;
  const freshMs = Number.isFinite(opts.freshMs) && opts.freshMs > 0 ? opts.freshMs : 10 * 60 * 1000;
  const yieldEvery = Number.isFinite(opts.yieldEvery) && opts.yieldEvery > 0 ? Math.floor(opts.yieldEvery) : DEFAULT_YIELD_EVERY;
  const yieldFn = typeof opts.yieldFn === 'function'
    ? opts.yieldFn
    : () => new Promise((resolve) => { setImmediate(resolve); });
  const fold = typeof opts.fold === 'function' ? opts.fold : (rows) => ({ rows });
  const now = typeof opts.now === 'function' ? opts.now : () => Date.now();

   
  const cache = new Map();
  let inflight = null;
  let last = null;
  const stats = {
    scans: 0, files: 0, stat: 0, read: 0, cacheHits: 0,
    viaFull: 0, viaSlice: 0, yields: 0, pruned: 0, lastScanMs: 0,
  };

   
  function refresh(nowMs) {
    if (inflight !== null) return inflight;
    
    const p = runScan(nowMs).finally(() => { if (inflight === p) inflight = null; });
    inflight = p;
    return p;
  }

  async function runScan(nowMs) {
    const t0 = nowMs;
    const scanned = { files: 0, stale: 0, unreadable: 0, no_stats: 0, rows: 0, dir, readable: false };
    const rows = [];
    const liveNames = new Set();
    let names = null;
    try {
      names = await fsp.readdir(dir);
      scanned.readable = true;
    } catch {
      names = null;
    }
    if (names !== null) {
      scanned.files = names.length;
      const horizon = nowMs - windowMs;
      let sinceYield = 0;
      for (const name of names) {
        if (!isScannableName(name)) continue;
        const file = nodePath.join(dir, name);
        let st = null;
        try {
          st = await fsp.stat(file);
          stats.stat += 1;
        } catch {
          scanned.unreadable += 1;
          continue;
        }
        if (!st || !(st.mtimeMs >= horizon)) { scanned.stale += 1; continue; }
        liveNames.add(name);
        const hit = cache.get(name);
        if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) {
          
          stats.cacheHits += 1;
          if (hit.row !== null) rows.push(hit.row);
          else scanned.no_stats += 1;
          continue;
        }
        let text = null;
        try {
          text = await fsp.readFile(file, 'utf8');
          stats.read += 1;
        } catch {
          scanned.unreadable += 1;
          continue;
        }
        let out = null;
        try {
          out = rowFromText(text);
        } catch {
          
          scanned.unreadable += 1;
          continue;
        }
        if (out.via === 'slice') stats.viaSlice += 1; else stats.viaFull += 1;
        cache.set(name, { mtimeMs: st.mtimeMs, size: st.size, row: out.row });
        if (out.row !== null) rows.push(out.row);
        else scanned.no_stats += 1;
        sinceYield += 1;
        if (sinceYield >= yieldEvery) {
          sinceYield = 0;
          stats.yields += 1;
          await yieldFn();
        }
      }
    }
    
    for (const name of Array.from(cache.keys())) {
      if (!liveNames.has(name)) { cache.delete(name); stats.pruned += 1; }
    }
    scanned.rows = rows.length;
    last = { atMs: nowMs, scanned, table: fold(rows, scanned) };
    stats.scans += 1;
    stats.files += scanned.files;
    stats.lastScanMs = Math.max(0, now() - t0);
    return last;
  }

   
  function peek() {
    if (last === null) return { ready: false, atMs: 0, table: null, scanned: null };
    return { ready: true, atMs: last.atMs, table: last.table, scanned: last.scanned };
  }

   
  function ensure(nowMs) {
    if (inflight !== null) return false;
    if (last !== null && (nowMs - last.atMs) < freshMs) return false;
    void refresh(nowMs).catch(() => {   });
    return true;
  }

  return {
    peek,
    ensure,
    refresh,
    stats,
    dir,
    windowMs,
    freshMs,
     
    cacheSize: () => cache.size,
    inFlight: () => inflight !== null,
  };
}

module.exports = {
  FULL_PARSE_MAX_CHARS,
  DEFAULT_YIELD_EVERY,
  createScanner,
  rowFromDoc,
  rowFromText,
  sliceJsonValue,
  matchBracketEnd,
  isScannableName,
};
