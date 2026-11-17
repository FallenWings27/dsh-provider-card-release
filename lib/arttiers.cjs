'use strict';
 

 
const carddata = require('./carddata.cjs');
const EFFORT_LADDER = require('./carddata.cjs').EFFORT_LINE_LADDER;

const TIERS_DOC = require('../data/art-tiers.json');

 
let SCENES_CACHE = null;
function scenesDoc() {
  if (SCENES_CACHE) return SCENES_CACHE;
  try {
    
    SCENES_CACHE = require('../data/art-scenes.json');
  } catch (_error) {
    SCENES_CACHE = { version: 0, scenes: {} };
  }
  return SCENES_CACHE;
}

 
const BASE_TIER = TIERS_DOC.base || 'plain';

 
function normEffort(effort) {
  if (effort === null || effort === undefined) return '';
  return String(effort).trim().toLowerCase();
}

 
function tierDoc(tierId, doc) {
  const d = doc || TIERS_DOC;
  const list = Array.isArray(d.artTiers) ? d.artTiers : [];
  return list.find((t) => t && t.id === tierId) || null;
}

 
function tierRank(tierId, doc) {
  const t = tierDoc(tierId, doc);
  return t ? Number(t.rank) : -1;
}

 
function effortToTier(effort, doc) {
  const d = doc || TIERS_DOC;
  const map = d.effortToTier || {};
  const key = normEffort(effort);
  if (!key) return null;
  const id = map[key];
  if (!id) return null;
  return tierDoc(id, d) ? id : null;
}

 
function declaredEfforts(card) {
  const raw = card && Array.isArray(card.efforts) ? card.efforts : [];
  const out = [];
  for (const e of raw) {
    const key = normEffort(e);
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

 
function cardArtTiers(card, doc) {
  const ids = [];
  for (const e of declaredEfforts(card)) {
    const t = effortToTier(e, doc);
    if (t && !ids.includes(t)) ids.push(t);
  }
  if (ids.length === 0) ids.push(BASE_TIER);
  ids.sort((a, b) => tierRank(a, doc) - tierRank(b, doc));
  return ids;
}

 
function baseArtTier(card, doc) {
  const tiers = cardArtTiers(card, doc);
  return tiers.length ? tiers[0] : BASE_TIER;
}

 
function artTierOf(card, effort, doc) {
  const tiers = cardArtTiers(card, doc);
  if (tiers.length === 0) return null;
  const want = normEffort(effort);
  
  if (!want) return tiers[0];
  const declared = declaredEfforts(card);
  
  if (declared.includes(want)) {
    const t = effortToTier(want, doc);
    if (t) return t;
  }
  
  const idx = EFFORT_LADDER.indexOf(want);
  if (idx >= 0) {
    for (let i = idx + 1; i < EFFORT_LADDER.length; i += 1) {
      const key = EFFORT_LADDER[i];
      if (!declared.includes(key)) continue;
      const t = effortToTier(key, doc);
      if (t) return t;
    }
  }
  
  return tiers[0];
}

 
function sceneEntry(no, tierId, doc) {
  const d = doc || scenesDoc();
  const per = (d.scenes || {})[String(no || '')];
  if (!per) return null;
  return per[String(tierId || '')] || null;
}

 
function sceneEligible(card) {
  return Boolean(card && card.no);
}

 
function scopedArtEntry(card, tier, kind, doc, opts) {
  const d = doc || {};
  const o = opts || {};
  const cards = Array.isArray(o.cards) ? o.cards : [card];
  
  const root = cards.find((c) => c && card && String(c.no) === String(card.no)) || card;
  const perCard = (d[kind] || {})[String((card && card.no) || '')];
  const legacy = perCard ? perCard[tier] : null;
  if (!root || !root.visualFamily) return legacy && !legacy.form ? legacy : null;
  if (!o.model) return null;
  const visual = carddata.resolvePersonaForm(cards, o.provider, o.model);
  if (!visual || visual.familyId !== root.visualFamily || !visual.formKey) return null;
  const member = root.forms && root.forms[visual.formKey];
  if (!member || member.availability === 'reserved') return null;
  const scope = visual.familyId + '/' + visual.formKey;
  const byForm = d.forms && d.forms[scope];
  const explicit = byForm && byForm[kind] && byForm[kind][tier];
  if (explicit) return !explicit.form || explicit.form === scope ? explicit : null;
  return legacy && legacy.form === scope ? legacy : null;
}

 
function sceneCandidates(card, effort, opts) {
  const o = opts || {};
  const resolved = artTierOf(card, effort, o.tiersDoc);
  const base = baseArtTier(card, o.tiersDoc);
  if (!sceneEligible(card, o.tiersDoc)) {
    return { tier: resolved, candidates: [] };
  }
  const wanted = [];
  if (resolved) wanted.push(resolved);
  if (base && !wanted.includes(base)) wanted.push(base);
  const out = [];
  for (const tier of wanted) {
    const entry = scopedArtEntry(card, tier, 'scenes', o.scenesDoc || scenesDoc(), o);
    if (entry) {
      const item = { tier, sha256: entry.sha256, bytes: entry.bytes || null, name: entry.name || null };
      if (typeof entry.loopStart === 'number' && Number.isFinite(entry.loopStart) && entry.loopStart > 0) {
        item.loopStart = entry.loopStart;
      }
      out.push(item);
    }
  }
  return { tier: resolved, candidates: out };
}

 
function artScenePlan(card, effort, opts) {
  const o = opts || {};
  const plan = sceneCandidates(card, effort, o);
  return {
    no: card && card.no ? String(card.no) : '',
    tier: plan.tier,
    candidates: plan.candidates,
  };
}

 
let LAYERS_CACHE = null;
function layersDoc() {
  if (LAYERS_CACHE) return LAYERS_CACHE;
  try {
    
    LAYERS_CACHE = require('../data/art-layers.json');
  } catch (_error) {
    LAYERS_CACHE = { version: 0, levels: {}, figures: {}, ambience: {} };
  }
  return LAYERS_CACHE;
}

 
function layerEntry(no, tierId, kind, doc) {
  const d = doc || layersDoc();
  const per = (d[kind] || {})[String(no || '')];
  if (!per) return null;
  return per[String(tierId || '')] || null;
}

 
function figureBinding(card, effort, opts) {
  const o = opts || {};
  const tier = artTierOf(card, effort, o.tiersDoc);
  if (!tier) return null;
  const entry = scopedArtEntry(card, tier, 'figures', o.layersDoc || layersDoc(), o);
  if (!entry) return null;
  return {
    no: card && card.no ? String(card.no) : '',
    tier,
    effort: normEffort(effort) || null,
    binding: entry,
  };
}

 
function ambienceBinding(card, effort, opts) {
  const o = opts || {};
  const tier = artTierOf(card, effort, o.tiersDoc);
  if (!tier) return null;
  const td = tierDoc(tier, o.tiersDoc) || {};
  const level = td.ambience || 'none';
  const doc = o.layersDoc || layersDoc();
  const levels = doc.levels || {};
  const opacity = typeof levels[level] === 'number' ? levels[level] : 0;
  const entry = scopedArtEntry(card, tier, 'ambience', doc, o);
  return {
    no: card && card.no ? String(card.no) : '',
    tier,
    level,
    opacity,
    binding: entry || null,
  };
}

module.exports = {
  ART_TIERS_DOC: TIERS_DOC,
  scenesDoc,
  layersDoc,
  BASE_TIER,
  EFFORT_LADDER,
  artTierOf,
  baseArtTier,
  cardArtTiers,
  declaredEfforts,
  effortToTier,
  normEffort,
  scopedArtEntry,
  sceneCandidates,
  sceneEligible,
  sceneEntry,
  artScenePlan,
  layerEntry,
  figureBinding,
  ambienceBinding,
  tierDoc,
  tierRank,
};
