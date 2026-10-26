 
'use strict';

const SKIN_ADAPTER_API_VERSION = 1;

 
const SKIN_ADAPTER_META_KEYS = ['id', 'priority', 'active', 'source', 'tested'];

 
const SKIN_ADAPTER_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,127}$/;

 
const SOURCES = ['builtin', 'external'];

 
const PRIORITY_MIN = -100;
const PRIORITY_MAX = 100;

 
function normalizeMeta(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'bad-shape' };
  const id = body.id;
  if (typeof id !== 'string' || !SKIN_ADAPTER_ID_RE.test(id)) return { error: 'bad-id' };

  const priority = body.priority === undefined ? 0 : body.priority;
  if (typeof priority !== 'number' || !Number.isInteger(priority) || priority < PRIORITY_MIN || priority > PRIORITY_MAX) {
    return { error: 'bad-priority' };
  }

  const active = body.active === undefined ? false : body.active;
  if (typeof active !== 'boolean') return { error: 'bad-active' };

  const source = body.source === undefined ? 'external' : body.source;
  if (SOURCES.indexOf(source) < 0) return { error: 'bad-source' };

  const tested = body.tested === undefined ? false : body.tested;
  if (typeof tested !== 'boolean') return { error: 'bad-tested' };

  return { meta: { id, priority, active, source, tested } };
}

 
function row(meta, registeredAt) {
  return {
    apiVersion: SKIN_ADAPTER_API_VERSION,
    id: meta.id,
    priority: meta.priority,
    active: meta.active,
    source: meta.source,
    tested: meta.tested,
    registeredAt: registeredAt || null,
  };
}

 
function rowsFromMap(map) {
  const rows = [];
  for (const entry of map.values()) {
    rows.push(row(entry.meta, entry.registeredAt));
  }
  rows.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return rows;
}

 
function diagnostics(rows) {
  const marks = {};
  for (const r of rows) {
    if (!r.tested) marks[r.id] = '未验证';
  }
  return {
    apiVersion: SKIN_ADAPTER_API_VERSION,
    adapterCount: rows.length,
    adapters: rows,
    marks,
  };
}

module.exports = {
  SKIN_ADAPTER_API_VERSION,
  SKIN_ADAPTER_META_KEYS,
  SKIN_ADAPTER_ID_RE,
  SOURCES,
  PRIORITY_MIN,
  PRIORITY_MAX,
  normalizeMeta,
  row,
  rowsFromMap,
  diagnostics,
};