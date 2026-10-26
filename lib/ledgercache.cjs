'use strict';
 

 
const DEFAULT_FRESH_MS = 30 * 1000;

 
function createLedgerCache(opts) {
  const file = opts.file;
  const fsp = opts.fsp;
  const readSync = opts.readSync;
  const now = opts.now || Date.now;
  const freshMs = opts.freshMs || DEFAULT_FRESH_MS;
   
  let cached = null;
  let inflight = null;
  const stats = {
    refreshes: 0, reads: 0, parses: 0, syncs: 0,
    servesFresh: 0, servesStale: 0, servesCold: 0, failures: 0, unchanged: 0,
  };

   
  async function runRefresh() {
    let st = null;
    try {
      st = await fsp.stat(file);
    } catch {
      st = null;
    }
    if (st && cached && st.mtimeMs === cached.mtimeMs && st.size === cached.size) {
      stats.unchanged += 1;
      cached = { doc: cached.doc, mtimeMs: cached.mtimeMs, size: cached.size, atMs: now() };
      return cached;
    }
    let raw = null;
    try {
      raw = await fsp.readFile(file, 'utf8');
    } catch {
      stats.failures += 1;
      return cached;
    }
    let doc = null;
    try {
      doc = JSON.parse(raw);
    } catch {
      stats.failures += 1;
      return cached;
    }
    stats.reads += 1;
    stats.parses += 1;
    cached = {
      doc,
      mtimeMs: st ? st.mtimeMs : 0,
      size: st ? st.size : raw.length,
      atMs: now(),
    };
    return cached;
  }

   
  function refresh() {
    if (inflight !== null) return inflight;
    const p = runRefresh().finally(() => { if (inflight === p) inflight = null; });
    inflight = p;
    stats.refreshes += 1;
    return p;
  }

   
  function kick() {
    if (inflight !== null) return false;
    void refresh().catch(() => {   });
    return true;
  }

   
  function get(nowMs) {
    if (cached === null) {
      
      stats.syncs += 1;
      stats.servesCold += 1;
      let raw = null;
      try {
        raw = readSync();
      } catch {
        raw = null;
      }
      if (raw === null) {
        stats.failures += 1;
        return { doc: null, ready: false, fromCache: false, startedRefresh: kick() };
      }
      try {
        cached = { doc: JSON.parse(raw), mtimeMs: 0, size: raw.length, atMs: nowMs };
      } catch {
        stats.failures += 1;
        cached = null;
        return { doc: null, ready: false, fromCache: false, startedRefresh: kick() };
      }
      
      
      const kicked = kick();
      return { doc: cached.doc, ready: true, fromCache: false, startedRefresh: kicked };
    }
    if ((nowMs - cached.atMs) < freshMs) {
      stats.servesFresh += 1;
      return { doc: cached.doc, ready: true, fromCache: true, startedRefresh: false };
    }
    
    stats.servesStale += 1;
    return { doc: cached.doc, ready: true, fromCache: true, startedRefresh: kick() };
  }

  return {
    get,
    refresh,
     
    peek: () => (cached === null ? null : cached.doc),
    stats,
    file,
    freshMs,
    inFlight: () => inflight !== null,
  };
}

module.exports = { DEFAULT_FRESH_MS, createLedgerCache };
