'use strict';

 

const {
  SLOTS,
  VARIANTS,
  SCOPES,
  scopeChain,
  scopeKeyAt,
  formScopeOf,
  bindingKey,
} = require('./binding.cjs');

const PACKAGE_VERSION = 1;

 
const PACKAGE_ASSET_KEYS = ['id', 'sha256', 'ext', 'mime', 'kind', 'family', 'bytes', 'name', 'data'];

 
const PACKAGE_BINDING_KEYS = [
  'scope', 'provider', 'model', 'slot', 'variant', 'assetId',
  'posterAssetId', 'fit', 'objectPosition', 'loop', 'muted', 'credit',
];

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isSha256(v) {
  return typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
}

 
function scopeOf(scopeKey) {
  if (scopeKey === 'default') return { scope: 'default', provider: '', model: '' };
  const i = scopeKey.indexOf(':');
  const kind = scopeKey.slice(0, i);
  const rest = scopeKey.slice(i + 1);
  if (kind === 'model') {
    const s = rest.indexOf('/');
    return { scope: 'model', provider: rest.slice(0, s), model: rest.slice(s + 1) };
  }
  if (kind === 'card') return { scope: 'card', provider: '', model: rest };
  
  
  if (kind === 'form') return { scope: 'form', provider: '', model: rest };
  return { scope: 'provider', provider: rest, model: '' };
}

 
function scopeKeyOf(binding) {
  if (binding.scope === 'form') {
    const key = formScopeOf(binding.model || '');
    if (!key) return { error: 'bad-scope' };
    return { scopeKey: key };
  }
  const chain = scopeChain(binding.provider || '', binding.model || '');
  const at = scopeKeyAt(chain, binding.scope);
  if (at.error) return { error: at.error };
  return { scopeKey: at.scopeKey };
}

 
function parse(raw) {
  if (!isPlainObject(raw)) return { error: 'bad-shape' };
  if (raw.version !== PACKAGE_VERSION) return { error: 'bad-version' };
  const provider = typeof raw.provider === 'string' ? raw.provider : '';
  const model = typeof raw.model === 'string' ? raw.model : '';
  const no = typeof raw.no === 'string' || typeof raw.no === 'number' ? String(raw.no) : '';

  if (!Array.isArray(raw.assets)) return { error: 'bad-assets' };
  const seen = new Set();
  const assets = [];
  for (const a of raw.assets) {
    if (!isPlainObject(a)) return { error: 'bad-asset' };
    if (typeof a.id !== 'string' || a.id === '' || seen.has(a.id)) return { error: 'duplicate-asset-id' };
    seen.add(a.id);
    if (!isSha256(a.sha256)) return { error: 'bad-asset-sha' };
    if (typeof a.data !== 'string' || a.data === '') return { error: 'bad-asset-data' };
    const asset = { id: a.id, sha256: a.sha256, data: a.data };
    for (const k of PACKAGE_ASSET_KEYS) {
      if (k === 'id' || k === 'sha256' || k === 'data') continue;
      if (a[k] !== undefined && a[k] !== null) asset[k] = a[k];
    }
    assets.push(asset);
  }

  if (!Array.isArray(raw.bindings)) return { error: 'bad-bindings' };
  const bindings = [];
  for (const b of raw.bindings) {
    if (!isPlainObject(b)) return { error: 'bad-binding' };
    if (SCOPES.indexOf(b.scope) < 0) return { error: 'bad-scope' };
    if (typeof b.slot !== 'string' || SLOTS.indexOf(b.slot) < 0) return { error: 'bad-slot' };
    if (b.variant !== undefined && b.variant !== null && b.variant !== ''
      && VARIANTS.indexOf(b.variant) < 0) return { error: 'bad-variant' };
    if (typeof b.assetId !== 'string' || !seen.has(b.assetId)) return { error: 'binding-asset-not-in-pack' };
    if (b.posterAssetId !== undefined && b.posterAssetId !== null && b.posterAssetId !== ''
      && !seen.has(b.posterAssetId)) return { error: 'binding-poster-not-in-pack' };
    const binding = { scope: b.scope, slot: b.slot, assetId: b.assetId };
    if (typeof b.provider === 'string') binding.provider = b.provider;
    if (typeof b.model === 'string') binding.model = b.model;
    if (b.variant) binding.variant = b.variant;
    if (b.posterAssetId) binding.posterAssetId = b.posterAssetId;
    for (const k of ['fit', 'objectPosition', 'loop', 'muted', 'credit']) {
      if (b[k] !== undefined && b[k] !== null) binding[k] = b[k];
    }
    const sk = scopeKeyOf(binding);
    if (sk.error) return { error: 'bad-scope-key' };
    bindings.push(binding);
  }

  const attribution = typeof raw.attribution === 'string' ? raw.attribution : '';
  const licenseNote = typeof raw.licenseNote === 'string' ? raw.licenseNote : '';
  const pack = {
    version: PACKAGE_VERSION,
    provider,
    model,
    no,
    assets,
    bindings,
    attribution,
    licenseNote,
  };
  
  
  
  
  
  
  
  
  if (raw.personaOverrides !== undefined) {
    pack.personaOverrides = raw.personaOverrides;
  }
  return { pack };
}

 
function mergePersonaOverrides(current, incoming) {
  const cur = isPlainObject(current) ? current : {};
  const inc = isPlainObject(incoming) ? incoming : {};
  const out = Object.assign({}, cur);
  for (const no of Object.keys(inc)) {
    out[no] = inc[no];
  }
  return out;
}

 
function importedBinding(packBinding, idMap) {
  const b = Object.assign({}, packBinding);
  if (!idMap.has(b.assetId)) return { error: 'asset-id-unmapped' };
  b.assetId = idMap.get(b.assetId);
  if (b.posterAssetId) {
    if (!idMap.has(b.posterAssetId)) return { error: 'poster-id-unmapped' };
    b.posterAssetId = idMap.get(b.posterAssetId);
  }
  
  
  const sk = scopeKeyOf(b);
  if (sk.error) return { error: sk.error };
  const key = bindingKey(sk.scopeKey, b.slot, b.variant || null);
  const binding = { assetId: b.assetId };
  if (b.posterAssetId) binding.posterAssetId = b.posterAssetId;
  for (const k of ['fit', 'objectPosition', 'loop', 'muted', 'credit']) {
    if (b[k] !== undefined && b[k] !== null) binding[k] = b[k];
  }
  return { key, scopeKey: sk.scopeKey, slot: b.slot, variant: b.variant || null, binding };
}

module.exports = {
  PACKAGE_VERSION,
  PACKAGE_ASSET_KEYS,
  PACKAGE_BINDING_KEYS,
  isSha256,
  scopeOf,
  scopeKeyOf,
  parse,
  importedBinding,
  mergePersonaOverrides,
};