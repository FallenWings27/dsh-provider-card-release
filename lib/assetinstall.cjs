'use strict';
 

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const media = require('./media.cjs');

 
function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

 
function installOne(spec) {
  const srcFile = path.join(spec.src, spec.source);
  if (!fs.existsSync(srcFile)) return { error: `找不到素材 ${srcFile}` };
  const actualBytes = fs.statSync(srcFile).size;
  if (typeof spec.bytes === 'number' && Number.isFinite(spec.bytes) && actualBytes !== spec.bytes) {
    return { error: `素材大小与绑定表对不上（表 ${spec.bytes} / 实 ${actualBytes}）` };
  }
  const sha = sha256File(srcFile);
  if (spec.sha256 && sha !== spec.sha256) {
    return { error: `素材内容与绑定表对不上（表 ${spec.sha256.slice(0, 12)}… / 实 ${sha.slice(0, 12)}…）` };
  }
  const hit = media.findAssetBySha(spec.manifest, sha);
  if (hit && hit.id) return { id: hit.id, reused: true, sha, bytes: actualBytes };
  if (spec.check) return { error: `素材库里没有 ${spec.name}（sha ${sha.slice(0, 12)}…）` };
  if (!spec.apply) return { pending: true, sha, bytes: actualBytes };
  fs.mkdirSync(spec.assetsDir, { recursive: true });
  const id = media.newAssetId();
  const ext = path.extname(spec.name).replace('.', '') || 'webm';
  const mime = (media.TYPES[ext] && media.TYPES[ext].mime) || 'application/octet-stream';
  const dstFile = path.join(spec.assetsDir, `${id}.${ext}`);
  fs.copyFileSync(srcFile, dstFile);
  spec.manifest.assets[id] = Object.assign({
    id,
    ext,
    mime,
    bytes: actualBytes,
    sha256: sha,
    name: spec.name,
    createdAt: new Date().toISOString(),
  }, spec.extra || {});
  return { id, reused: false, sha, bytes: actualBytes, dstFile };
}

 
function installAssets(opts) {
  const store = opts.store;
  const src = opts.src;
  const apply = !!opts.apply;
  const check = !!opts.check;
  const role = opts.role || 'asset';
  const manifestFile = path.join(store, 'manifest.json');
  const assetsDir = path.join(store, 'assets');
  const manifest = media.readJson(fs, manifestFile, media.emptyManifest());
  if (!manifest.assets || typeof manifest.assets !== 'object') manifest.assets = {};

  const added = [];
  const reused = [];
  const pending = [];
  const problems = [];
  let addedAssets = 0;
  let dirty = false;

  for (const entry of opts.entries || []) {
    const tag = `#${entry.card} ${entry.tier}`;
    const mainLoopStart = typeof entry.loopStart === 'number' && Number.isFinite(entry.loopStart) && entry.loopStart > 0 ? entry.loopStart : null;
    const mainExtra = {
      role,
      card: entry.card === undefined ? null : entry.card,
      artTier: entry.tier === undefined ? null : entry.tier,
      effort: entry.effort || null,
      source: entry.source,
    };
    if (mainLoopStart !== null) mainExtra.loopStart = mainLoopStart;
    const main = installOne({
      manifest, assetsDir, src, apply, check,
      source: entry.source, sha256: entry.sha256, name: entry.name, bytes: entry.bytes,
      extra: mainExtra,
    });
    if (main.error) { problems.push(`${tag}: ${main.error}`); continue; }
    if (main.reused) {
      reused.push(Object.assign({}, entry, { id: main.id }));
      if (mainLoopStart !== null && manifest.assets[main.id] && manifest.assets[main.id].loopStart !== mainLoopStart) {
        manifest.assets[main.id].loopStart = mainLoopStart;
        dirty = true;
      } else if (mainLoopStart === null && manifest.assets[main.id] && 'loopStart' in manifest.assets[main.id]) {
        delete manifest.assets[main.id].loopStart;
        dirty = true;
      }
    }
    else if (main.pending) pending.push(Object.assign({}, entry, { id: null, sha: main.sha }));
    else { added.push(Object.assign({}, entry, { id: main.id })); addedAssets += 1; }

    if (!entry.cutoutSource) continue;
    const compLoopStart = typeof entry.cutoutLoopStart === 'number' && Number.isFinite(entry.cutoutLoopStart) && entry.cutoutLoopStart > 0 ? entry.cutoutLoopStart : null;
    const compExtra = {
      role: 'cutout',
      card: entry.card === undefined ? null : entry.card,
      artTier: entry.tier === undefined ? null : entry.tier,
      effort: entry.effort || null,
      source: entry.cutoutSource,
    };
    if (compLoopStart !== null) compExtra.loopStart = compLoopStart;
    const comp = installOne({
      manifest, assetsDir, src, apply, check,
      source: entry.cutoutSource, sha256: entry.cutoutSha256, name: entry.cutoutName, bytes: entry.cutoutBytes,
      extra: compExtra,
    });
    if (comp.error) {
      if (!main.reused && !main.pending) {
        if (main.dstFile) {
          try { fs.unlinkSync(main.dstFile); } catch (_) {}
        }
        if (main.id) delete manifest.assets[main.id];
        if (added.length > 0 && added[added.length - 1].id === main.id) {
          added.pop();
          addedAssets -= 1;
        }
      } else if (main.pending && pending.length > 0 && pending[pending.length - 1].source === entry.source) {
        pending.pop();
      }
      problems.push(`${tag}: ${comp.error}`);
      continue;
    }
    const compRec = Object.assign({}, entry, {
      id: comp.id || null,
      mainId: main.id || null,
      companion: true,
      name: entry.cutoutName || entry.name,
      bytes: entry.cutoutBytes || entry.bytes,
    });
    if (comp.reused) {
      reused.push(compRec);
      if (compLoopStart !== null && manifest.assets[comp.id] && manifest.assets[comp.id].loopStart !== compLoopStart) {
        manifest.assets[comp.id].loopStart = compLoopStart;
        dirty = true;
      } else if (compLoopStart === null && manifest.assets[comp.id] && 'loopStart' in manifest.assets[comp.id]) {
        delete manifest.assets[comp.id].loopStart;
        dirty = true;
      }
    }
    else if (comp.pending) { compRec.sha = comp.sha; pending.push(compRec); }
    else { added.push(compRec); addedAssets += 1; }
    
    if (main.id && comp.id && manifest.assets[main.id] && manifest.assets[main.id].cutout !== comp.id) {
      manifest.assets[main.id].cutout = comp.id;
      dirty = true;
    }
  }

  const count = Object.keys(manifest.assets).length;
  if (apply && (added.length > 0 || dirty)) media.atomicWriteJson(fs, path, manifestFile, manifest);
  return { manifest, manifestFile, assetsDir, added, reused, pending, problems, count, addedAssets };
}

module.exports = { installAssets, sha256File };
