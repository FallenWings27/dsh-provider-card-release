'use strict';
 

 
const STAT_KEYS = ['智力', '编码', '速度', '稳定', '性价比', '上下文'];

 
const BENCH_FOR_STAT = {
  智力: ['AA-Intelligence', 'AA-Intelligence(vendor-claimed)', 'BenchLM-Capability'],
  编码: [
    
    'SWE-bench(Vals)',
    'Terminal-Bench-2.1(Vals)',
    
    'SWE-bench-Verified',
    'SWE-bench-Pro',
    'DeepSWE-1.1',
    'Terminal-Bench-2.1',
    'Terminal-Bench-4.0',
  ],
};

 
const NOT_RANKED = '？';

 
const KIND_HINT = {
  conflict: '存在未裁决冲突',
  rounding: '数值取整差异',
  corroborated: '多源同值互证',
  single: '',
};

 
function unitOf(bench, entry) {
  if (!entry) return null;
  return { max: entry.max === undefined ? null : entry.max };
}

 
function formatValue(value, max) {
  if (!Number.isFinite(value)) return NOT_RANKED;
  if (max === null || max === 100) return String(Math.round(value));
  return `${value} / ${max}`;
}

 
function entryOf(doc, model, norm) {
  if (!doc || !Array.isArray(doc.entries)) return null;
  const normFn = typeof norm === 'function' ? norm : null;
  if (!normFn) {
    const hit = doc.entries.find((e) => e.model === model);
    return hit || null;
  }
  const want = normFn(model);
  if (!want) return null;
  
  
  
  
  let hits = doc.entries.filter((e) => e && typeof e.model === 'string'
    && !e.alias_of && normFn(e.model) === want);
  
  
  
  
  
  if (hits.length > 1) {
    const scored = hits.filter((e) => !e.no_public_score);
    if (scored.length === 1) hits = scored;
  }
  if (hits.length !== 1) return null;
  return hits[0];
}

 
function lookup(doc, model, bench, norm) {
  if (!doc || !Array.isArray(doc.entries)) return null;
  const entry = entryOf(doc, model, norm);
  if (!entry) return null;
  if (entry.no_public_score) return null;
  const b = entry.benchmarks[bench];
  if (!b) return null;
  const unit = unitOf(bench, b);
  return {
    benchmark: bench,
    value: b.value,
    max: unit ? unit.max : null,
    effort: b.effort || null,
    source_type: b.source_type,
    origin: b.origin,
    kind: b.kind,
    caveat: b.caveat || null,
    caveat_detail: b.caveat_detail || null,
    distinct_values: b.distinct_values || null,
    candidates: b.candidates || [],
    
    text: formatValue(b.value, unit ? unit.max : null),
    hint: KIND_HINT[b.kind] || '',
    url: b.url || '',
    pageDate: b.pageDate || '',
  };
}

 
function statValue(doc, model, stat, norm) {
  const order = BENCH_FOR_STAT[stat];
  if (!order) return null;
  for (const bench of order) {
    const hit = lookup(doc, model, bench, norm);
    if (hit) return hit;
  }
  return null;
}

 
function coverage(doc, model, norm) {
  const entry = typeof norm === 'function'
    ? entryOf(doc, model, norm) 
    : (doc && Array.isArray(doc.entries) ? doc.entries.find((e) => e.model === model) : null);
  if (!entry) {
    return { model, benchmarks: [], no_public_score: false, no_standard_score: false, conflict_count: 0, reason: null, known: false };
  }
  const bs = Object.keys(entry.benchmarks || {});
  return {
    model,
    benchmarks: bs,
    no_public_score: !!entry.no_public_score,
    no_standard_score: !!entry.no_standard_score,
    conflict_count: bs.filter((b) => entry.benchmarks[b].kind === 'conflict').length,
    reason: entry.reason || null,
    known: true,
  };
}

 
function dataCardIndex(doc, norm) {
  const normFn = typeof norm === 'function' ? norm : null;
  const out = {};
  if (!doc || !Array.isArray(doc.entries) || !normFn) return out;
  for (const entry of doc.entries) {
    if (!entry || typeof entry.model !== 'string') continue;
    
    if (entry.no_public_score) continue;
    
    
    if (entry.alias_of) continue;
    const key = normFn(entry.model);
    if (!key) continue;
    const base = {};
    const src = {};
    const unranked = [];
    for (const k of STAT_KEYS) {
      const hit = statValue(doc, entry.model, k, normFn);
      if (hit) {
        base[k] = hit.value;
        src[k] = {
          benchmark: hit.benchmark,
          value: hit.value,
          source_type: hit.source_type,
          origin: hit.origin,
          pageDate: hit.pageDate,
          url: hit.url,
          caveat: hit.caveat,
        };
      } else {
        base[k] = null;
        unranked.push(k);
      }
    }
    
    if (unranked.length === STAT_KEYS.length) continue;
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      
      delete out[key];
      out[key] = null; 
      continue;
    }
    out[key] = { model: entry.model, base, src, unranked, generated_at: doc.generated_at || null };
  }
  for (const k of Object.keys(out)) {
    if (out[k] === null) delete out[k];
  }
  return out;
}

module.exports = {
  STAT_KEYS,
  BENCH_FOR_STAT,
  NOT_RANKED,
  KIND_HINT,
  unitOf,
  formatValue,
  entryOf,
  lookup,
  statValue,
  coverage,
  dataCardIndex,
};
