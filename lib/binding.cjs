'use strict';
 
const M = require('./media.cjs');




const { pairKey } = require('./measured.cjs');













const { normModel, matchCard, resolvePersonaForm } = require('./carddata.cjs');

 
const SLOTS = ['idle', 'summon', 'warning', 'recover'];
 
const PENDING_SLOTS = [];
 
const ALERT_SLOTS = ['warning', 'recover'];
 
const VARIANTS = ['hud', 'full'];
 
const SCOPES = ['model', 'card', 'form', 'provider', 'default'];
 
const BINDING_FIELDS = ['assetId', 'posterAssetId', 'mediaType', 'fit', 'objectPosition', 'loop', 'muted', 'credit', 'updatedAt'];
 
const BOOKKEEPING_FIELDS = ['updatedAt'];
 
const FIELDS = BINDING_FIELDS.concat(BOOKKEEPING_FIELDS);
 
const FITS = ['contain', 'cover'];
 
const MEDIA_TYPES = ['image', 'video'];
const DEFAULT_SCOPE = 'default';
 
const IDLE_SLOT = 'idle';
const MAX_ID_PART = 128;
const MAX_CREDIT = 120;
const MAX_POSITION = 64;

 
function isIdPart(value) {
  return typeof value === 'string'
    && value.length > 0 && value.length <= MAX_ID_PART
    && value.indexOf('#') < 0 && !/[\u0000-\u001f]/.test(value);
}

 
function cardIdentityOf(model) {
  if (!isIdPart(model)) return null;
  const ident = normModel(model);
  if (!isIdPart(ident)) return null;
  return ident;
}

 
function cardScopeOf(model) {
  const ident = cardIdentityOf(model);
  return ident ? `card:${ident}` : null;
}

 
const FORM_TOKEN = /^[a-z0-9][a-z0-9._-]*$/;
function isFormToken(value) {
  return typeof value === 'string' && isIdPart(value) && FORM_TOKEN.test(value);
}

 
function formScopeOf(form) {
  if (typeof form !== 'string' || form === '') return null;
  const body = form.indexOf('form:') === 0 ? form.slice('form:'.length) : form;
  const s = body.indexOf('/');
  if (s <= 0 || s === body.length - 1) return null;
  const family = body.slice(0, s);
  const formKey = body.slice(s + 1);
  if (formKey.indexOf('/') >= 0) return null; 
  if (!isFormToken(family) || !isFormToken(formKey)) return null;
  return `form:${family}/${formKey}`;
}

 
let catalogCache = null;
function cardCatalog() {
  if (catalogCache) return catalogCache;
  let doc = null;
  try {
    doc = require('../data/providers.json');
  } catch (e) {
    doc = null;
  }
  const cards = doc && Array.isArray(doc.cards) ? doc.cards : [];
  catalogCache = cards;
  return cards;
}

 
function representativeCardScopeOf(provider, model) {
  if (!isIdPart(model)) return null;
  const cards = cardCatalog();
  if (!cards.length) return null;
  let hit = null;
  try {
    hit = matchCard(cards, provider, model, {});
  } catch (e) {
    return null;
  }
  if (!hit || hit.generic || hit.dataCard) return null;
  const no = hit.no;
  if (typeof no !== 'string' || no === '') return null;
  for (const c of cards) {
    if (c && c.no === no && isIdPart(c.model)) {
      const ident = cardIdentityOf(c.model);
      return ident ? `card:${ident}` : null;
    }
  }
  return null;
}

 
function derivedFormOf(provider, model) {
  if (!isIdPart(model)) return null;
  const cards = cardCatalog();
  if (!cards.length) return null;
  let visual = null;
  try {
    visual = resolvePersonaForm(cards, provider, model);
  } catch (e) {
    return null;
  }
  if (!visual || !visual.familyId || !visual.formKey) return null;
  return `${visual.familyId}/${visual.formKey}`;
}

 
function scopeChain(provider, model, form) {
  const out = [];
  const hasModel = isIdPart(model);
  if (isIdPart(provider) && hasModel) out.push(`model:${provider}/${model}`);
  const card = cardScopeOf(model);
  if (card) out.push(card);
  const formKey = hasModel ? formScopeOf(form) : null;
  if (formKey) out.push(formKey);
  const rep = representativeCardScopeOf(provider, model);
  if (rep && rep !== card) out.push(rep);
  if (isIdPart(provider)) out.push(`provider:${provider}`);
  out.push(DEFAULT_SCOPE);
  return out;
}

 
function isScopeKey(value) {
  if (value === DEFAULT_SCOPE) return true;
  if (typeof value !== 'string') return false;
  const i = value.indexOf(':');
  if (i <= 0) return false;
  const kind = value.slice(0, i);
  const rest = value.slice(i + 1);
  if (kind !== 'model' && kind !== 'card' && kind !== 'form' && kind !== 'provider') return false;
  if (rest === '' || rest.indexOf('#') >= 0) return false;
  if (kind === 'model') {
    const s = rest.indexOf('/');
    if (s <= 0 || s === rest.length - 1) return false;
    return isIdPart(rest.slice(0, s)) && isIdPart(rest.slice(s + 1));
  }
  
  
  if (kind === 'form') {
    const s = rest.indexOf('/');
    if (s <= 0 || s === rest.length - 1) return false;
    if (rest.indexOf('/', s + 1) >= 0) return false;
    return isFormToken(rest.slice(0, s)) && isFormToken(rest.slice(s + 1));
  }
  
  if (kind === 'card') return isIdPart(rest) && !/[\s/]/.test(rest);
  return isIdPart(rest);
}

 
function scopeKeyAt(chain, scope) {
  if (scope === undefined || scope === null || scope === '') {
    return { scopeKey: chain[chain.length - 1] };
  }
  if (SCOPES.indexOf(scope) < 0) return { error: 'bad-scope' };
  const prefix = scope === DEFAULT_SCOPE ? DEFAULT_SCOPE : `${scope}:`;
  const hit = chain.find((k) => k.indexOf(prefix) === 0);
  if (!hit) return { error: `scope-unavailable:${scope}` };
  return { scopeKey: hit };
}

 
function bindingKey(scopeKey, slot, variant) {
  const base = `${scopeKey}#${slot}`;
  if (variant === undefined || variant === null || variant === '') return base;
  return `${base}#${variant}`;
}

 
function parseBindingKey(key) {
  if (typeof key !== 'string') return null;
  const parts = key.split('#');
  if (parts.length < 2 || parts.length > 3) return null;
  const scopeKey = parts[0];
  const slot = parts[1];
  const variant = parts.length === 3 ? parts[2] : null;
  if (!isScopeKey(scopeKey)) return null;
  if (SLOTS.indexOf(slot) < 0) return null;
  if (variant !== null && VARIANTS.indexOf(variant) < 0) return null;
  return { scopeKey, slot, variant };
}

 
function normalizeBinding(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const k of BINDING_FIELDS) {
    const v = raw[k];
    if (v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}

 
function assetOf(manifest, id) {
  const assets = (manifest && manifest.assets) || {};
  return M.isAssetId(id) && assets[id] ? assets[id] : null;
}

 
function resolveCutout(asset, manifest) {
  if (!asset || typeof asset.cutout !== 'string' || asset.cutout === '') return null;
  return assetOf(manifest, asset.cutout) ? asset.cutout : null;
}

 
function resolveCutoutStill(asset, manifest) {
  if (!asset || typeof asset.cutoutStill !== 'string' || asset.cutoutStill === '') return null;
  return assetOf(manifest, asset.cutoutStill) ? asset.cutoutStill : null;
}

 
function cutoutFamilyOf(manifest, cutoutAssetId) {
  if (cutoutAssetId === null || cutoutAssetId === undefined) return null;
  const a = assetOf(manifest, cutoutAssetId);
  if (!a) return null;
  const fam = familyOf(a);
  return fam === 'video' ? 'video' : (fam === 'image' ? 'image' : null);
}

 
function familyOf(asset) {
  return M.familyOf(asset);
}

function isPosition(value) {
  return typeof value === 'string' && value.length <= MAX_POSITION
    && !/[\u0000-\u001f]/.test(value) && !/[;{}]/.test(value);
}

 
function validateBinding(binding, manifest) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return { error: 'bad-binding' };
  if (binding.updatedAt !== undefined) return { error: 'bad-updatedAt' };
  const raw = normalizeBinding(binding);
  if (!raw) return { error: 'bad-binding' };
  if (!M.isAssetId(raw.assetId)) return { error: 'bad-assetId' };
  if (raw.posterAssetId !== undefined && !M.isAssetId(raw.posterAssetId)) return { error: 'bad-posterAssetId' };
  
  if (raw.mediaType !== undefined && MEDIA_TYPES.indexOf(raw.mediaType) < 0) return { error: 'bad-mediaType' };
  if (raw.fit !== undefined && (typeof raw.fit !== 'string' || FITS.indexOf(raw.fit) < 0)) return { error: 'bad-fit' };
  if (raw.loop !== undefined && typeof raw.loop !== 'boolean') return { error: 'bad-loop' };
  if (raw.muted !== undefined && typeof raw.muted !== 'boolean') return { error: 'bad-muted' };
  if (raw.objectPosition !== undefined && !isPosition(raw.objectPosition)) return { error: 'bad-objectPosition' };
  if (raw.credit !== undefined && (typeof raw.credit !== 'string' || raw.credit.length > MAX_CREDIT)) {
    return { error: 'bad-credit' };
  }
  
  const ids = [raw.assetId, raw.posterAssetId].filter((x) => x !== undefined);
  for (const id of ids) {
    const asset = assetOf(manifest, id);
    if (!asset) return { error: `asset-not-found:${id}` };
    const fam = familyOf(asset);
    if (raw.mediaType !== undefined && fam !== null && raw.mediaType !== fam) {
      return { error: `mediaType-mismatch:${id}` };
    }
  }
  return { binding: pickFields(raw) };
}

 
function pickFields(raw) {
  const out = {};
  for (const k of BINDING_FIELDS) {
    if (k === 'updatedAt') continue;
    if (raw[k] !== undefined) out[k] = raw[k];
  }
  return out;
}

 
function normalizeBindings(raw) {
  const src = (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.bindings) || {};
  const out = {};
  for (const key of Object.keys(src)) {
    if (!parseBindingKey(key)) continue;
    const b = normalizeBinding(src[key]);
    if (!b || !M.isAssetId(b.assetId)) continue;
    out[key] = b;
  }
  return { version: 1, bindings: out };
}

 
function emptyBindings() {
  return { version: 1, bindings: {} };
}

 
function resolveBinding(bindings, chain, slot, variant) {
  if (SLOTS.indexOf(slot) < 0) return { error: 'bad-slot' };
  const table = tableOf(bindings);
  
  if (ALERT_SLOTS.indexOf(slot) >= 0) {
    const own = findInChain(table, chain, slot, variant, 'slot');
    if (own) return own;
    const fallback = findInChain(table, chain, IDLE_SLOT, variant, 'idle');
    if (fallback) return fallback;
    return { key: null, why: null };
  }
  const wantSlots = slot === IDLE_SLOT ? [IDLE_SLOT] : [slot, IDLE_SLOT];
  for (const scopeKey of chain) {
    for (const wantSlot of wantSlots) {
      const variants = variant ? [variant, null] : [null];
      for (const v of variants) {
        const key = bindingKey(scopeKey, wantSlot, v);
        const hit = table[key];
        if (hit) {
          return { key, scopeKey, slot: wantSlot, variant: v, binding: hit, why: wantSlot === slot ? 'slot' : 'idle' };
        }
      }
    }
  }
  return { key: null, why: null };
}

 
function findInChain(table, chain, wantSlot, variant, why) {
  const variants = variant ? [variant, null] : [null];
  for (const scopeKey of chain) {
    for (const v of variants) {
      const key = bindingKey(scopeKey, wantSlot, v);
      const hit = table[key];
      if (hit) {
        return { key, scopeKey, slot: wantSlot, variant: v, binding: hit, why };
      }
    }
  }
  return null;
}

 
function tableOf(bindings) {
  if (!bindings || typeof bindings !== 'object') return {};
  if (bindings.bindings && typeof bindings.bindings === 'object' && !Array.isArray(bindings.bindings)) {
    return bindings.bindings;
  }
  return bindings;
}

 
function setBinding(bindings, key, patch, nowIso) {
  if (!parseBindingKey(key)) return { error: 'bad-key' };
  if (typeof nowIso !== 'string' || nowIso === '') return { error: 'bad-nowIso' };
  const incoming = normalizeBinding(patch);
  if (!incoming) return { error: 'bad-patch' };
  const table = tableOf(bindings);
  const next = Object.assign({}, table[key] || {});
  for (const k of BINDING_FIELDS) {
    if (patch[k] === null) delete next[k];
    else if (incoming[k] !== undefined) next[k] = incoming[k];
  }
  next.updatedAt = nowIso;
  return {
    bindings: { version: 1, bindings: Object.assign({}, table, { [key]: next }) },
  };
}

 
function clearBinding(bindings, key) {
  if (!parseBindingKey(key)) return { error: 'bad-key' };
  const table = tableOf(bindings);
  const next = Object.assign({}, table);
  delete next[key];
  return { bindings: { version: 1, bindings: next } };
}

 
function planBindingRequest(method, query, body) {
  const m = String(method || '').toUpperCase();
  if (m === 'GET') {
    if (query.key !== undefined && query.key !== null && query.key !== '') {
      if (!parseBindingKey(query.key)) return { error: 'bad-key' };
      return { action: 'get', key: query.key };
    }
    if (query.resolve !== undefined && query.resolve !== null && query.resolve !== '') {
      if (parseSlot(query.slot).error) return { error: 'bad-slot' };
      const chain = scopeChain(query.provider, query.model, derivedFormOf(query.provider, query.model));
      const v = parseVariant(query.variant);
      if (v.error) return { error: 'bad-variant' };
      return { action: 'resolve', chain, slot: query.slot, variant: v.variant || null };
    }
    return { action: 'list' };
  }
  if (m === 'POST') {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'bad-body' };
    const slot = parseSlot(body.slot);
    if (slot.error) return { error: 'bad-slot' };
    const chain = scopeChain(body.provider, body.model, derivedFormOf(body.provider, body.model));
    
    
    
    const requested = body.scope === undefined || body.scope === null || body.scope === '' ? null : body.scope;
    const at = requested === null
      ? { scopeKey: chain[0] }
      : scopeKeyAt(chain, requested);
    if (at.error) return { error: at.error === 'bad-scope' ? 'bad-scope' : `scope-unavailable:${requested}` };
    const v = parseVariant(body.variant);
    if (v.error) return { error: 'bad-variant' };
    const key = bindingKey(at.scopeKey, body.slot, v.variant || null);
    return {
      action: 'set',
      key,
      scopeKey: at.scopeKey,
      scopeRequested: requested,
      slot: body.slot,
      variant: v.variant || null,
      binding: body.binding,
    };
  }
  if (m === 'DELETE') {
    
    
    
    if (query.removeAsset !== undefined && query.removeAsset !== null && query.removeAsset !== '') {
      if (!M.isAssetId(query.removeAsset)) return { error: 'bad-assetId' };
      return { action: 'remove-asset', assetId: query.removeAsset };
    }
    if (!parseBindingKey(query.key)) return { error: 'bad-key' };
    return { action: 'clear', key: query.key };
  }
  return { error: 'bad-method' };
}

function parseSlot(slot) {
  if (typeof slot !== 'string' || SLOTS.indexOf(slot) < 0) return { error: 'bad-slot' };
  return { slot };
}

function parseVariant(variant) {
  if (variant === undefined || variant === null || variant === '') return { variant: null };
  if (typeof variant !== 'string' || VARIANTS.indexOf(variant) < 0) return { error: 'bad-variant' };
  return { variant };
}

 
function mediaPlan(binding, manifest) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return { error: 'bad-binding' };
  const asset = assetOf(manifest, binding.assetId);
  if (!asset) return { error: 'asset-not-found' };
  const fam = familyOf(asset);
  if (fam === null) return { error: 'asset-unknown-family' };
  if (binding.posterAssetId !== undefined) {
    const poster = assetOf(manifest, binding.posterAssetId);
    if (!poster) return { error: 'poster-not-found' };
  }
  const cutoutAssetId = resolveCutout(asset, manifest);
  return {
    plan: {
      kind: fam === 'video' ? 'video' : 'image',
      assetId: asset.id,
      mime: asset.mime,
      posterAssetId: binding.posterAssetId === undefined ? null : binding.posterAssetId,
      
      
      cutoutAssetId,
      
      
      cutoutKind: cutoutFamilyOf(manifest, cutoutAssetId),
      cutoutStillAssetId: resolveCutoutStill(asset, manifest),
      fit: binding.fit === undefined ? 'cover' : binding.fit,
      objectPosition: binding.objectPosition === undefined ? 'center' : binding.objectPosition,
      loop: binding.loop === undefined ? true : binding.loop,
      muted: binding.muted === undefined ? true : binding.muted,
      credit: binding.credit === undefined ? null : binding.credit,
    },
  };
}

 
function bindingsOfScope(bindings, scopeKey) {
  const out = {};
  const src = (bindings && bindings.bindings) || bindings || {};
  for (const key of Object.keys(src)) {
    const parsed = parseBindingKey(key);
    if (parsed && parsed.scopeKey === scopeKey) {
      out[key] = Object.assign({ slot: parsed.slot, variant: parsed.variant }, src[key]);
    }
  }
  return out;
}

 
function splitScopeKey(scopeKey) {
  if (scopeKey === DEFAULT_SCOPE) return { scope: DEFAULT_SCOPE, provider: '', model: '' };
  const i = scopeKey.indexOf(':');
  if (i <= 0) return null;
  const scope = scopeKey.slice(0, i);
  const rest = scopeKey.slice(i + 1);
  if (scope === 'provider') return rest === '' ? null : { scope, provider: rest, model: '' };
  if (scope === 'card') return rest === '' ? null : { scope, provider: '', model: rest };
  if (scope === 'form') return rest === '' ? null : { scope, provider: '', model: rest };
  if (scope === 'model') {
    const s = rest.indexOf('/');
    if (s <= 0 || s === rest.length - 1) return null;
    return { scope, provider: rest.slice(0, s), model: rest.slice(s + 1) };
  }
  return null;
}

 
function bindingsRows(bindings) {
  const src = (bindings && bindings.bindings) || bindings || {};
  const out = [];
  for (const key of Object.keys(src)) {
    const parsed = parseBindingKey(key);
    if (!parsed) continue;
    const parts = splitScopeKey(parsed.scopeKey);
    if (!parts) continue;
    const b = src[key] || {};
    out.push({
      key,
      scopeKey: parsed.scopeKey,
      scope: parts.scope,
      provider: parts.provider,
      model: parts.model,
      slot: parsed.slot,
      variant: parsed.variant,
      assetId: b.assetId === undefined ? null : b.assetId,
      posterAssetId: b.posterAssetId === undefined ? null : b.posterAssetId,
      mediaType: b.mediaType === undefined ? null : b.mediaType,
      fit: b.fit === undefined ? null : b.fit,
      objectPosition: b.objectPosition === undefined ? null : b.objectPosition,
      loop: b.loop === undefined ? null : b.loop,
      muted: b.muted === undefined ? null : b.muted,
      credit: b.credit === undefined ? null : b.credit,
      updatedAt: b.updatedAt === undefined ? null : b.updatedAt,
    });
  }
  out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return out;
}

 
function bindingsCapabilities(bindings) {
  const src = (bindings && bindings.bindings) || bindings || {};
  const seen = new Map();
  const slotCounts = {};
  for (const key of Object.keys(src)) {
    const parsed = parseBindingKey(key);
    if (!parsed) continue;
    slotCounts[parsed.slot] = (slotCounts[parsed.slot] || 0) + 1;
    const parts = splitScopeKey(parsed.scopeKey);
    if (!parts || parts.scope === DEFAULT_SCOPE) continue; 
    const provider = parts.provider;
    const model = parts.model;
    if (provider === '') continue; 
    const pk = pairKey(provider, model);
    if (!seen.has(pk)) seen.set(pk, { provider, model, slots: [] });
    if (seen.get(pk).slots.indexOf(parsed.slot) < 0) seen.get(pk).slots.push(parsed.slot);
  }
  const pairs = [...seen.values()].sort((a, b) => {
    const ka = pairKey(a.provider, a.model);
    const kb = pairKey(b.provider, b.model);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return {
    scopes: SCOPES,
    slots: SLOTS,
    variants: VARIANTS,
    fits: FITS,
    kinds: MEDIA_TYPES,
    bindingFields: BINDING_FIELDS.filter((f) => BOOKKEEPING_FIELDS.indexOf(f) < 0),
    pendingSlots: PENDING_SLOTS,
    pairs,
    slotCounts,
  };
}

module.exports = {
  SLOTS,
  PENDING_SLOTS,
  ALERT_SLOTS,
  VARIANTS,
  SCOPES,
  BINDING_FIELDS,
  FITS,
  MEDIA_TYPES,
  DEFAULT_SCOPE,
  IDLE_SLOT,
  MAX_ID_PART,
  MAX_CREDIT,
  MAX_POSITION,
  isIdPart,
  scopeChain,
  cardScopeOf,
  cardIdentityOf,
  formScopeOf,
  isFormToken,
  cardCatalog,
  representativeCardScopeOf,
  derivedFormOf,
  isScopeKey,
  scopeKeyAt,
  planBindingRequest,
  mediaPlan,
  bindingKey,
  parseBindingKey,
  normalizeBinding,
  assetOf,
  familyOf,
  validateBinding,
  normalizeBindings,
  emptyBindings,
  resolveBinding,
  setBinding,
  clearBinding,
  bindingsOfScope,
  bindingsRows,
  splitScopeKey,
  bindingsCapabilities,
};
