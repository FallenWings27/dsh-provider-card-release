'use strict';
 

 
const STAT_KEYS = ['智力', '编码', '速度', '稳定', '性价比', '上下文'];

 
const BENCH_FOR_STAT = {
  
  
  
  
  智力: ['AA-Intelligence-v5.0.1', 'AA-Intelligence-v5.0', 'AA-Intelligence', 'AA-Intelligence(vendor-claimed)', 'BenchLM-Capability'],
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

 
const EFFORT_PRIORITY = ['max', 'xhigh', 'high', 'medium', 'low'];

 
const AA_LEGACY_VERSION = 'v4.3.2';

 
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
    
    const hit = doc.entries.find((e) => e && !e.alias_of && e.model === model);
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

 
function aaV5Lookup(doc, model, norm) {
  const sec = doc && doc.aa_index_v5;
  if (!sec || !Array.isArray(sec.records) || !model) return null;
  const normFn = typeof norm === 'function' ? norm : (m) => m;
  const want = normFn(model);
  if (!want) return null;
  const hits = sec.records.filter((r) => r && typeof r.model === 'string' && normFn(r.model) === want);
  if (hits.length !== 1) return null; 
  const r = hits[0];
  if (!Number.isFinite(r.score)) return null;
  
  const bench = r.benchmark || sec.benchmark;
  const quote = [bench, `${sec.effective} 生效 / ${r.collected || sec.collected} 采集`,
    r.upstream_model ? `：${r.upstream_model}` : ''].join('');
  return {
    benchmark: bench,
    value: r.score,
    max: null,
    effort: null,
    source_type: sec.source_type,
    origin: sec.origin,
    kind: 'single',
    caveat: null,
    caveat_detail: null,
    distinct_values: null,
    candidates: [{
      value: r.score,
      source_type: sec.source_type,
      effort: null,
      origin: sec.origin,
      url: r.url || sec.url || '',
      quote,
      compare: '',
      source_label: sec.source_label,
    }],
    text: formatValue(r.score, null),
    hint: '',
    url: r.url || sec.url || '',
    pageDate: r.collected || sec.collected || '',
  };
}

 
function effortLookup(doc, model, bench, norm) {
  const sec = doc && doc.aa_index_v5;
  if (!sec || !Array.isArray(sec.effort_records) || !model || !bench) return null;
  const normFn = typeof norm === 'function' ? norm : (m) => m;
  const want = normFn(model);
  if (!want) return null;
  const rows = sec.effort_records.filter(
    (r) =>
      r &&
      typeof r.model === 'string' &&
      String(r.benchmark) === String(bench) &&
      normFn(r.model) === want &&
      Number.isFinite(r.score)
  );
  if (!rows.length) return null;
  
  
  const ordered = EFFORT_PRIORITY.map((e) => rows.find((r) => r.effort === e)).filter(Boolean);
  const picked = ordered[0];
  if (!picked) return null;
  return {
    benchmark: bench,
    value: picked.score,
    max: null,
    effort: picked.effort,
    effort_picked: true,
    effort_note:
      `该轴没有不分档（plain）的成绩，按 ${EFFORT_PRIORITY.join(' > ')} 取 ${picked.effort} 档` +
      `（同一基准共 ${ordered.length} 档：${ordered.map((r) => r.effort).join(' / ')}）`,
    source_type: sec.source_type,
    origin: sec.origin,
    kind: 'single',
    caveat: null,
    caveat_detail: null,
    distinct_values: null,
    candidates: ordered.map((r) => ({
      value: r.score,
      source_type: sec.source_type,
      effort: r.effort,
      origin: sec.origin,
      url: r.url || sec.url || '',
      quote: [bench, `${r.effort} 档`, r.collected ? `${r.collected} 采集` : '',
        r.upstream_model ? `：${r.upstream_model}` : ''].join(''),
      compare: '',
      source_label: sec.source_label,
    })),
    text: formatValue(picked.score, null),
    hint: '',
    url: picked.url || sec.url || '',
    pageDate: picked.collected || sec.collected || '',
  };
}

 
function lookup(doc, model, bench, norm) {
  if (!doc || !Array.isArray(doc.entries)) return null;
  
  if (/^AA-Intelligence-v5[.]/.test(bench)) return aaV5Lookup(doc, model, norm);
  const entry = entryOf(doc, model, norm);
  if (!entry) return null;
  if (entry.no_public_score) return null;
  const b = entry.benchmarks[bench];
  if (!b) return null;
  const unit = unitOf(bench, b);
  const out = {
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
  
  
  
  if (bench === 'AA-Intelligence') out.version = AA_LEGACY_VERSION;
  return out;
}

 
function statValue(doc, model, stat, norm) {
  const order = BENCH_FOR_STAT[stat];
  if (!order) return null;
  for (const bench of order) {
    const hit = lookup(doc, model, bench, norm);
    if (hit) return hit;
  }
  for (const bench of order) {
    const hit = effortLookup(doc, model, bench, norm);
    if (hit) return hit;
  }
  return null;
}

 
function coverage(doc, model, norm) {
  const entry = typeof norm === 'function'
    ? entryOf(doc, model, norm) 
    : (doc && Array.isArray(doc.entries) ? doc.entries.find((e) => e && !e.alias_of && e.model === model) : null);
  if (!entry) {
    return { model, benchmarks: [], no_public_score: false, no_standard_score: false, conflict_count: 0, reason: null, known: false };
  }
  const bs = Object.keys(entry.benchmarks || {});
  
  const v5 = aaV5Lookup(doc, model, norm);
  if (v5) bs.push(v5.benchmark);
  return {
    model,
    benchmarks: bs,
    no_public_score: !!entry.no_public_score,
    no_standard_score: !!entry.no_standard_score,
    conflict_count: bs.filter((b) => entry.benchmarks[b] && entry.benchmarks[b].kind === 'conflict').length,
    reason: entry.reason || null,
    known: true,
  };
}

 
function buildDataCardEntry(doc, model, normFn) {
  const base = {};
  const src = {};
  const unranked = [];
  for (const k of STAT_KEYS) {
    const hit = statValue(doc, model, k, normFn);
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
      
      
      
      if (hit.effort) src[k].effort = hit.effort;
    } else {
      base[k] = null;
      unranked.push(k);
    }
  }
  
  if (unranked.length === STAT_KEYS.length) return null;
  return { model, base, src, unranked, generated_at: doc.generated_at || null };
}

 
function dataCardIndex(doc, norm) {
  const normFn = typeof norm === 'function' ? norm : null;
  const out = {};
  if (!doc || !Array.isArray(doc.entries) || !normFn) return out;
  const entryKeys = new Set();
  const blockedKeys = new Set();
  for (const entry of doc.entries) {
    if (!entry || typeof entry.model !== 'string') continue;
    const key = normFn(entry.model);
    if (!key) continue;
    
    
    
    if (entry.no_public_score || entry.alias_of) {
      blockedKeys.add(key);
      continue;
    }
    entryKeys.add(key);
    const card = buildDataCardEntry(doc, entry.model, normFn);
    if (!card) continue;
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      
      delete out[key];
      out[key] = null; 
      continue;
    }
    out[key] = card;
  }
  for (const k of Object.keys(out)) {
    if (out[k] === null) delete out[k];
  }
  
  
  
  const aa = doc.aa_index_v5;
  if (aa) {
    const aaRecs = []
      .concat(Array.isArray(aa.records) ? aa.records : [])
      .concat(Array.isArray(aa.effort_records) ? aa.effort_records : []);
    const aaSeen = new Set();
    for (const r of aaRecs) {
      if (!r || typeof r.model !== 'string') continue;
      const key = normFn(r.model);
      if (!key || entryKeys.has(key) || blockedKeys.has(key) || aaSeen.has(key)) continue;
      aaSeen.add(key);
      const card = buildDataCardEntry(doc, r.model, normFn);
      if (card) out[key] = card;
    }
  }
  return out;
}

 
const ARENA_BOARD_ORDER = ['text', 'text_style_control', 'webdev'];

function arenaOf(doc, model, norm) {
  const sec = doc && doc.arena;
  if (!sec || !model) return null;
  const plainList = Array.isArray(sec.records) ? sec.records : [];
  const effortList = Array.isArray(sec.effort_records) ? sec.effort_records : [];
  if (!plainList.length && !effortList.length) return null;
  const normFn = typeof norm === 'function' ? norm : (m) => m;
  const want = normFn(model);
  if (!want) return null;
  const plainRows = plainList.filter((r) => r && typeof r.model === 'string' && normFn(r.model) === want);
  const effortRows = effortList.filter((r) => r && typeof r.model === 'string' && normFn(r.model) === want);
  if (!plainRows.length && !effortRows.length) return null;
  const labels = {};
  for (const b of sec.boards || []) labels[b.board] = b.label;
  const byBoard = {};
  for (const board of ARENA_BOARD_ORDER) {
    let r = plainRows.find((x) => x.board === board) || null;
    let isEffort = false;
    if (!r) {
      for (const eff of EFFORT_PRIORITY) {
        const hit = effortRows.find((x) => x.board === board && x.effort === eff);
        if (hit) {
          r = hit;
          isEffort = true;
          break;
        }
      }
    }
    if (!r) continue;
    const item = {
      rank: r.rank,
      rating: isEffort ? r.score : r.rating,
      ci: r.ci || null,
      votes: r.votes === null || r.votes === undefined ? null : r.votes,
      collected: r.collected || '',
      url: r.url || '',
      upstream_model: r.upstream_model || '',
    };
    if (isEffort) item.effort = r.effort;
    byBoard[board] = item;
  }
  const board = ARENA_BOARD_ORDER.find((b) => byBoard[b]) || null;
  if (!board) return null;
  const out = {
    board,
    label: labels[board] || board,
    rank: byBoard[board].rank,
    rating: byBoard[board].rating,
    ci: byBoard[board].ci,
    votes: byBoard[board].votes,
    byBoard,
    source_label: sec.source_label || 'LMArena',
    metric: sec.metric || 'rating',
    note: sec.note || '',
    collected: byBoard[board].collected || '',
  };
  if (byBoard[board].effort) out.effort = byBoard[board].effort;
  return out;
}

module.exports = {
  STAT_KEYS,
  BENCH_FOR_STAT,
  NOT_RANKED,
  KIND_HINT,
  EFFORT_PRIORITY,
  AA_LEGACY_VERSION,
  unitOf,
  formatValue,
  entryOf,
  lookup,
  effortLookup,
  statValue,
  coverage,
  dataCardIndex,
  arenaOf,
};
