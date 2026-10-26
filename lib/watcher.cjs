'use strict';
 

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

module.exports = {
  DEFAULT_COOLDOWN_MS,
  STATUS_READY,
  STATUS_SELECTING,
  selectionKey,
  createWatcher,
};
