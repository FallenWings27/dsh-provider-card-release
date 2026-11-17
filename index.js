 
import { createRequire } from 'node:module';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import * as nodeOs from 'node:os';
import * as nodeCrypto from 'node:crypto';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const media = require('./lib/media.cjs');
const binding = require('./lib/binding.cjs');
const pkg = require('./lib/package.cjs');
const skin = require('./lib/skin.cjs');
const quotas = require('./lib/quotas.cjs');
const notifier = require('./lib/notifier.cjs');
const measured = require('./lib/measured.cjs');


const sessionspeed = require('./lib/sessionspeed.cjs');



const ledgercache = require('./lib/ledgercache.cjs');

const carddata = require('./lib/carddata.cjs');

const arttiers = require('./lib/arttiers.cjs');
const cardCatalog = require('./data/providers.json');


const benchDoc = require('./data/benchmarks.json');




const publicSpeedDoc = require('./data/speed-public.json');

const fs = nodeFs.promises;

 
const TAG = '[@mirai27/dsh-provider-card]';

let activePluginInstance = null;
const storeLocks = new Map();

 
function withStoreLock(store, fn) {
  const lockKey = store && store.root ? store.root : store;
  const prev = storeLocks.get(lockKey) || Promise.resolve();
  const run = prev.then(() => fn());
  const tail = run.catch(() => {}).finally(() => {
    if (storeLocks.get(lockKey) === tail) storeLocks.delete(lockKey);
  });
  storeLocks.set(lockKey, tail);
  return run;
}

 
function dataRoot() {
  const home = process.env.DSH_HOME || nodePath.join(nodeOs.homedir(), '.dsh');
  return nodePath.join(home, 'provider-card');
}

export function apply(ctx) {
  let store;
  try {
    store = prepareStore();
  } catch (err) {
    console.error(`${TAG} media probe disabled: data dir unwritable: ${err && err.message}`);
    return;
  }

  const instanceToken = Symbol('dsh-provider-card');
  activePluginInstance = instanceToken;

  
  
  
  
  const skinRegistry = new Map();
  const skinRegistryApi = {
    apiVersion: skin.SKIN_ADAPTER_API_VERSION,
    register(meta) {
      const normalized = skin.normalizeMeta(meta);
      if (normalized.error) return { ok: false, reason: normalized.error };
      const registeredAt = new Date().toISOString();
      skinRegistry.set(normalized.meta.id, { meta: normalized.meta, registeredAt });
      return { ok: true, adapter: skin.row(normalized.meta, registeredAt) };
    },
    unregister(id) {
      const removed = typeof id === 'string' ? skinRegistry.delete(id) : false;
      return { ok: true, removed, id };
    },
    list() {
      return skin.rowsFromMap(skinRegistry);
    },
  };
  
  if (typeof ctx.provide === 'function') {
    ctx.provide('dshProviderCardSkinAdapterRegistry', skinRegistryApi);
  }

  const cleanupPluginState = () => {
    skinRegistry.clear();
    if (activePluginInstance !== instanceToken) return;
    activePluginInstance = null;
    quotaFaceState = null;
    sessionSpeedScanner = null;
    measuredFaceState = null;
    ledgerCacheInstance = null;
    seenBridgeDoc = null;
  };
  let stateEffectAttached = false;
  if (typeof ctx.effect === 'function') {
    ctx.effect(() => cleanupPluginState, `${TAG} plugin state`);
    stateEffectAttached = true;
  }

  ctx.inject(['connection'], (scope) => {
    const connection = scope.get('connection');
    const register = connection && connection.fetch && connection.fetch.register;
    if (typeof register !== 'function') {
      console.error(`${TAG} media probe disabled: connection.fetch.register missing`);
      return;
    }
    
    
    
    
    const registered = new Set();
    for (const route of media.ALL_ROUTES) {
      if (registered.has(route.path)) continue;
      registered.add(route.path);
      const handler = route.path.endsWith('/assets/upload')
        ? uploadHandler(store)
        : route.path.endsWith('/assets/media')
          ? mediaHandler(store)
          : route.path.endsWith('/assets/scene')
            ? sceneHandler(store)
            : route.path.endsWith('/assets/layers')
              ? layersHandler(store)
            : route.path.endsWith('/assets/bindings')
              ? bindingsHandler(store)
              : route.path.endsWith('/package')
                ? packageHandler(store)
                : route.path.endsWith('/skin-adapter')
                  ? skinAdapterHandler(skinRegistry)
                  : route.path.endsWith('/quotas')
                    ? quotasHandler(store)
                    : route.path.endsWith('/measured')
                      ? measuredHandler(store)
                      : route.path.endsWith('/persona')
                        ? personaHandler(store)
                        : configHandler(store);
      scope.effect(
        () => register({ ...route, fetch: linkTap(route.path, handler) }),
        `${TAG} ${route.path} Fetch route`,
      );
    }
    scope.effect(() => mountClientBridge(), `${TAG} client bridge`);
    scope.effect(() => mountSeenBridge(), `${TAG} seen bridge`);
    if (!stateEffectAttached) {
      scope.effect(() => cleanupPluginState, `${TAG} plugin state`);
    }
    
    
    scope.effect(
      () => scheduleSessionSpeedFirstScan(),
      `${TAG} session speed first scan`,
    );
    console.log(`${TAG} media probe routes registered under ${store.root}`);
  });
}

 
function mountClientBridge() {
  const bridge = {
    urls: media.ROUTE_URLS,
    slots: binding.SLOTS,
    variants: binding.VARIANTS,
    kinds: binding.MEDIA_TYPES,
  };
  const w = globalThis;
  Object.defineProperty(w, '__DSH_PROVIDER_CARD__', {
    value: bridge,
    configurable: true,
    enumerable: false,
    writable: true,
  });
  return () => {
    if (w.__DSH_PROVIDER_CARD__ === bridge) {
      try { delete w.__DSH_PROVIDER_CARD__; } catch { w.__DSH_PROVIDER_CARD__ = undefined; }
    }
  };
}

 
function packageSeedDir() {
  return nodePath.join(nodePath.dirname(fileURLToPath(import.meta.url)), 'seed');
}

 
export function prepareStore(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const root = typeof o.root === 'string' && o.root ? o.root : dataRoot();
  const assetsDir = nodePath.join(root, 'assets');
  nodeFs.mkdirSync(assetsDir, { recursive: true });
  const probeFile = nodePath.join(root, '.probe');
  nodeFs.writeFileSync(probeFile, 'ok'); 
  try { nodeFs.unlinkSync(probeFile); } catch {   }
  const store = {
    root,
    assetsDir,
    manifestFile: nodePath.join(root, 'manifest.json'),
    bindingsFile: nodePath.join(root, 'bindings.json'),
    configFile: nodePath.join(root, 'config.json'),
    metaFile: nodePath.join(root, 'package-meta.json'),
    
    
    personaFile: nodePath.join(root, 'persona-overrides.json'),
    fs: nodeFs,
    path: nodePath,
    crypto: nodeCrypto,
  };
  const seedDir = typeof o.seedDir === 'string' && o.seedDir ? o.seedDir : packageSeedDir();
  let seeded;
  try {
    seeded = media.seedStore(nodeFs, nodePath, {
      seedDir,
      assetsDir: store.assetsDir,
      manifestFile: store.manifestFile,
      bindingsFile: store.bindingsFile,
    });
  } catch (e) {
    
    seeded = {
      seeded: false,
      skipped: false,
      reason: 'seed-failed',
      assets: 0,
      bindings: 0,
      warnings: [],
      error: `seed 播种失败：${e && e.message}`,
    };
  }
  store.seed = seeded;
  if (seeded && seeded.error) console.error(`${TAG} ${seeded.error}`);
  return store;
}

function readManifest(store) {
  return store.fs === nodeFs.promises
    ? media.readJson(nodeFs, store.manifestFile, media.emptyManifest)
    : media.readJson(store.fs, store.manifestFile, media.emptyManifest);
}

function readConfig(store) {
  return media.readJson(nodeFs, store.configFile, media.defaultConfig);
}

 
function readBindings(store) {
  return binding.normalizeBindings(media.readJson(nodeFs, store.bindingsFile, binding.emptyBindings));
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

 
function trackWriteStream(ws) {
  let error = null;
  let closed = Boolean(ws.closed);
  const closedPromise = closed
    ? Promise.resolve()
    : new Promise((resolve) => {
        ws.once('close', () => {
          closed = true;
          resolve();
        });
      });
  ws.on('error', (err) => {
    if (!error) error = err;
  });
  return {
    waitDrain() {
      if (error) return Promise.reject(error);
      if (closed || ws.destroyed || ws.writableEnded) return Promise.resolve(false);
      return new Promise((resolve, reject) => {
        const cleanup = () => {
          ws.removeListener('drain', onDrain);
          ws.removeListener('close', onClose);
          ws.removeListener('error', onError);
        };
        const onDrain = () => { cleanup(); resolve(true); };
        const onClose = () => { cleanup(); resolve(false); };
        const onError = (err) => { cleanup(); reject(err); };
        ws.once('drain', onDrain);
        ws.once('close', onClose);
        ws.once('error', onError);
      });
    },
    async abortAndWaitClose() {
      if (!closed) {
        try { ws.destroy(); } catch {   }
      }
      await closedPromise;
    },
    async endAndWaitClose() {
      if (closed || ws.destroyed) {
        await closedPromise;
        return;
      }
      if (!ws.writableEnded) ws.end();
      await closedPromise;
      if (error) throw error;
    },
  };
}

 
function cancelBodyQuiet(body) {
  if (!body || body.locked || typeof body.cancel !== 'function') return;
  try { Promise.resolve(body.cancel()).catch(() => {}); } catch {   }
}

 
function uploadHandler(store) {
  return async (request) => {
    const q = new URL(request.url).searchParams;
    const type = String(q.get('type') || '').toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(media.TYPES, type)) {
      return json(400, { ok: false, reason: 'bad-request', detail: 'type not allowed' });
    }
    const name = media.safeName(q.get('name'));
    const declaredSha = q.get('sha256');
    if (declaredSha && !media.isSha(String(declaredSha).toLowerCase())) {
      return json(400, { ok: false, reason: 'bad-request', detail: 'sha256 malformed' });
    }
    
    
    const cutoutOfRaw = q.get('cutoutOf');
    let cutoutOfId = null;
    if (cutoutOfRaw !== null && cutoutOfRaw !== '') {
      cutoutOfId = String(cutoutOfRaw);
      if (!media.isAssetId(cutoutOfId)) {
        return json(400, { ok: false, reason: 'bad-request', detail: 'cutoutOf malformed' });
      }
      if (!readManifest(store).assets[cutoutOfId]) {
        return json(400, { ok: false, reason: 'bad-request', detail: 'cutoutOf not found' });
      }
    }
    
    
    
    
    const stillCutoutOfRaw = q.get('stillCutoutOf');
    let stillCutoutOfId = null;
    if (stillCutoutOfRaw !== null && stillCutoutOfRaw !== '') {
      stillCutoutOfId = String(stillCutoutOfRaw);
      if (!media.isAssetId(stillCutoutOfId)) {
        return json(400, { ok: false, reason: 'bad-request', detail: 'stillCutoutOf malformed' });
      }
      if (!readManifest(store).assets[stillCutoutOfId]) {
        return json(400, { ok: false, reason: 'bad-request', detail: 'stillCutoutOf not found' });
      }
    }
    const cfg = readConfig(store);
    const cap = media.TYPES[type].family === 'video' ? cfg.maxVideoBytes : cfg.maxImageBytes;
    const declaredLen = Number(request.headers.get('content-length'));
    if (Number.isFinite(declaredLen) && declaredLen > cap) {
      return json(413, { ok: false, reason: 'too-large', limitBytes: cap });
    }
    const usedBytes = media.manifestBytes(readManifest(store));
    if (usedBytes >= cfg.totalBytes) {
      return json(429, { ok: false, reason: 'quota-exceeded', usedBytes, totalBytes: cfg.totalBytes });
    }
    if (!request.body || typeof request.body.getReader !== 'function') {
      return json(400, { ok: false, reason: 'bad-request', detail: 'empty body' });
    }
    const id = media.newAssetId();
    const tmp = nodePath.join(store.assetsDir, `.tmp-${id}`);
    const hash = nodeCrypto.createHash('sha256');
    let received = 0;
    let head = Buffer.alloc(0);
    let aborted = Boolean(request.signal && request.signal.aborted);
    let tracker = null;
    let bodyStream = null;
    let onClose = null;
    try {
      if (aborted) {
        cancelBodyQuiet(request.body);
        return json(499, { ok: false, reason: 'client-closed' });
      }
      const ws = nodeFs.createWriteStream(tmp);
      tracker = trackWriteStream(ws);
      bodyStream = Readable.fromWeb(request.body);
      onClose = () => {
        aborted = true;
        try { ws.destroy(); } catch {   }
        try { bodyStream.destroy(); } catch {   }
      };
      if (request.signal) request.signal.addEventListener('abort', onClose, { once: true });
      for await (const chunk of bodyStream) {
        if (aborted) break;
        const buf = Buffer.from(chunk.buffer ? chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) : chunk);
        received += buf.length;
        if (received > cap) {
          try { bodyStream.destroy(); } catch {   }
          cancelBodyQuiet(request.body);
          await tracker.abortAndWaitClose();
          await unlinkQuiet(tmp);
          return json(413, { ok: false, reason: 'too-large', limitBytes: cap, receivedBytes: received });
        }
        if (head.length < media.LIMITS.firstChunkPeek) {
          head = Buffer.concat([head, buf.subarray(0, media.LIMITS.firstChunkPeek - head.length)]);
        }
        hash.update(buf);
        if (!ws.write(buf)) {
          const canContinue = await tracker.waitDrain();
          if (!canContinue) break;
        }
      }
      if (aborted) {
        await tracker.abortAndWaitClose();
        await unlinkQuiet(tmp);
        return json(499, { ok: false, reason: 'client-closed' });
      }
      await tracker.endAndWaitClose();
      if (received === 0) {
        await unlinkQuiet(tmp);
        return json(400, { ok: false, reason: 'bad-request', detail: 'zero bytes' });
      }
      const probed = media.probeType(head);
      if (probed === null) {
        await unlinkQuiet(tmp);
        return json(415, { ok: false, reason: 'type-mismatch', detail: 'unknown signature' });
      }
      if (probed !== type) {
        await unlinkQuiet(tmp);
        return json(415, { ok: false, reason: 'type-mismatch', detail: `looks like ${probed}` });
      }
      const sha = hash.digest('hex');
      if (declaredSha && sha !== String(declaredSha).toLowerCase()) {
        await unlinkQuiet(tmp);
        return json(400, { ok: false, reason: 'bad-request', detail: 'sha256 mismatch' });
      }
      return await withStoreLock(store, async () => {
        const manifest = readManifest(store);
        const freshCfg = readConfig(store);
        const freshUsedBytes = media.manifestBytes(manifest);
        const missingTarget =
          (cutoutOfId !== null && (!manifest.assets || !manifest.assets[cutoutOfId])) ||
          (stillCutoutOfId !== null && (!manifest.assets || !manifest.assets[stillCutoutOfId]));
        if (missingTarget) {
          await unlinkQuiet(tmp);
          const missingWhich =
            cutoutOfId !== null && (!manifest.assets || !manifest.assets[cutoutOfId])
              ? 'cutoutOf not found'
              : 'stillCutoutOf not found';
          return json(409, { ok: false, reason: 'target-missing', detail: missingWhich });
        }
        const dupe = media.findAssetBySha(manifest, sha);
        if (dupe && dupe.id !== id) {
          await unlinkQuiet(tmp); 
          
          if (cutoutOfId !== null || stillCutoutOfId !== null) {
            if (cutoutOfId !== null) manifest.assets[cutoutOfId].cutout = dupe.id;
            if (stillCutoutOfId !== null) manifest.assets[stillCutoutOfId].cutoutStill = dupe.id;
            media.atomicWriteJson(nodeFs, nodePath, store.manifestFile, manifest);
          }
          return json(200, { ok: true, id: dupe.id, deduped: true, bytes: dupe.bytes, cutoutOf: cutoutOfId, stillCutoutOf: stillCutoutOfId });
        }
        if (freshUsedBytes + received > freshCfg.totalBytes) {
          await unlinkQuiet(tmp);
          return json(429, { ok: false, reason: 'quota-exceeded', usedBytes: freshUsedBytes, incomingBytes: received, totalBytes: freshCfg.totalBytes });
        }
        const finalName = `${id}.${type}`;
        const finalPath = nodePath.join(store.assetsDir, finalName);
        await nodeFs.promises.rename(tmp, finalPath);
        try {
          manifest.assets[id] = media.normalizeAsset({
            id,
            ext: type,
            mime: media.TYPES[type].mime,
            bytes: received,
            sha256: sha,
            name: name || undefined,
            createdAt: new Date().toISOString(),
          });
          
          if (cutoutOfId !== null) manifest.assets[cutoutOfId].cutout = id;
          if (stillCutoutOfId !== null) manifest.assets[stillCutoutOfId].cutoutStill = id;
          media.atomicWriteJson(nodeFs, nodePath, store.manifestFile, manifest);
        } catch (writeErr) {
          await unlinkQuiet(finalPath);
          throw writeErr;
        }
        return json(200, { ok: true, id, bytes: received, mime: media.TYPES[type].mime, sha256: sha, cutoutOf: cutoutOfId, stillCutoutOf: stillCutoutOfId });
      });
    } catch (err) {
      if (tracker) await tracker.abortAndWaitClose();
      await unlinkQuiet(tmp);
      if (aborted) {
        return json(499, { ok: false, reason: 'client-closed' });
      }
      console.error(`${TAG} upload failed: ${err && err.message}`);
      return json(500, { ok: false, reason: 'internal' });
    } finally {
      if (request.signal && onClose) {
        request.signal.removeEventListener('abort', onClose);
      }
    }
  };
}

 
async function unlinkQuiet(file) {
  try { await fs.unlink(file); return true; } catch {   return false; }
}

 
function mediaHandler(store) {
  return async (request) => {
    const q = new URL(request.url).searchParams;
    const id = q.get('assetId');
    if (!media.isAssetId(id)) {
      return json(400, { ok: false, reason: 'bad-request', detail: 'assetId malformed' });
    }
    const manifest = readManifest(store);
    const asset = manifest.assets && manifest.assets[id];
    const ext = asset && asset.ext;
    if (!asset || !Object.prototype.hasOwnProperty.call(media.TYPES, ext)) {
      return json(404, { ok: false, reason: 'not-found' });
    }
    const file = nodePath.join(store.assetsDir, `${asset.id}.${asset.ext}`);
    let size;
    try {
      size = (await fs.stat(file)).size;
    } catch {
      return json(404, { ok: false, reason: 'not-found', detail: 'file missing' });
    }
    const range = media.parseRange(request.headers.get('range'), size);
    const baseHeaders = {
      'accept-ranges': 'bytes',
      'content-type': asset.mime || media.TYPES[ext].mime,
      'etag': `"${asset.sha256 || String(size)}"`,
      'cache-control': 'private, max-age=0',
    };
    if (request.method === 'HEAD') {
      return new Response(null, { status: range.kind === 'partial' ? 206 : (range.kind === 'invalid' ? 416 : 200), headers: { ...baseHeaders, ...(range.kind === 'partial' ? { 'content-range': `bytes ${range.start}-${range.end}/${size}`, 'content-length': String(range.end - range.start + 1) } : { 'content-length': String(size) }) } });
    }
    if (range.kind === 'invalid') {
      return new Response(null, { status: 416, headers: { ...baseHeaders, 'content-range': `bytes */${size}` } });
    }
    const start = range.kind === 'partial' ? range.start : 0;
    const end = range.kind === 'partial' ? range.end : size - 1;
    const body = Readable.toWeb(nodeFs.createReadStream(file, { start, end }));
    return new Response(body, {
      status: range.kind === 'partial' ? 206 : 200,
      headers: {
        ...baseHeaders,
        'content-length': String(end - start + 1),
        ...(range.kind === 'partial' ? { 'content-range': `bytes ${start}-${end}/${size}` } : {}),
      },
    });
  };
}

 
function sceneHandler(store) {
  return async (request) => {
    const q = new URL(request.url).searchParams;
    const provider = String(q.get('provider') || '');
    const model = String(q.get('model') || '');
    if (!provider || !model) {
      return json(400, { ok: false, reason: 'bad-request', detail: 'provider and model required' });
    }
    const cards = cardCatalog && Array.isArray(cardCatalog.cards) ? cardCatalog.cards : [];
    const card = carddata.matchCard(cards, provider, model);
    if (!card || !card.no) {
      return json(200, { ok: true, no: null, tier: null, assetId: null, reason: 'no-card' });
    }
    const effortRaw = q.get('effort');
    const effort = effortRaw === null || effortRaw === '' ? (card.def || null) : String(effortRaw);
    const plan = arttiers.artScenePlan(card, effort, { cards, provider, model });
    const manifest = readManifest(store);
    for (const cand of plan.candidates) {
      const asset = media.findAssetBySha(manifest, cand.sha256);
      if (asset && asset.id) {
        const sceneBinding = { assetId: asset.id };
        if (typeof cand.loopStart === 'number' && Number.isFinite(cand.loopStart) && cand.loopStart > 0) {
          sceneBinding.loopStart = cand.loopStart;
        }
        const resolved = binding.mediaPlan(sceneBinding, manifest);
        if (!resolved.plan) continue;
        return json(200, {
          ok: true,
          no: plan.no,
          tier: cand.tier,
          assetId: asset.id,
          plan: resolved.plan,
          mime: asset.mime || null,
          bytes: asset.bytes || null,
          fellBack: cand.tier !== plan.tier,
          reason: null,
        });
      }
      
      console.warn(`${TAG} art-scene 缺件：卡 ${plan.no} 档 ${cand.tier}（${cand.name} sha ${String(cand.sha256).slice(0, 12)}…）不在素材库里 ⇒ 回落基线档`);
    }
    return json(200, {
      ok: true,
      no: plan.no,
      tier: plan.tier,
      assetId: null,
      fellBack: false,
      reason: plan.candidates.length ? 'asset-missing' : 'no-scene-for-tier',
    });
  };
}

 
function layersHandler(store) {
  return async (request) => {
    const q = new URL(request.url).searchParams;
    const provider = String(q.get('provider') || '');
    const model = String(q.get('model') || '');
    if (!provider || !model) {
      return json(400, { ok: false, reason: 'bad-request', detail: 'provider and model required' });
    }
    const cards = cardCatalog && Array.isArray(cardCatalog.cards) ? cardCatalog.cards : [];
    const card = carddata.matchCard(cards, provider, model);
    if (!card || !card.no) {
      return json(200, {
        ok: true, no: null, tier: null, figure: null, figureReason: 'no-card',
        ambience: null, ambienceReason: 'no-card',
      });
    }
    const effortRaw = q.get('effort');
    const effort = effortRaw === null || effortRaw === '' ? (card.def || null) : String(effortRaw);
    const fig = arttiers.figureBinding(card, effort, { cards, provider, model });
    const amb = arttiers.ambienceBinding(card, effort, { cards, provider, model });
    const manifest = readManifest(store);
    let figure = null;
    let figureReason = null;
    if (fig) {
      const res = binding.mediaPlanFromShas(fig.binding, manifest);
      if (res.plan) figure = res.plan;
      else {
        figureReason = 'asset-missing';
        console.warn(`${TAG} L1 缺件：卡 ${fig.no} 档 ${fig.tier}（${fig.binding.name} sha ${String(fig.binding.sha256).slice(0, 12)}…）不在素材库里 ⇒ 回落现役立绘`);
      }
    } else {
      figureReason = 'no-figure-for-tier';
    }
    let ambience = null;
    let ambienceReason = null;
    if (amb) {
      const slot = { level: amb.level, opacity: amb.opacity, plan: null };
      if (amb.binding) {
        const res = binding.mediaPlanFromShas(amb.binding, manifest);
        if (res.plan) slot.plan = res.plan;
        else {
          ambienceReason = 'asset-missing';
          console.warn(`${TAG} L2 缺件：卡 ${amb.no} 档 ${amb.tier} 强度 ${amb.level}（${amb.binding.name} sha ${String(amb.binding.sha256).slice(0, 12)}…）不在素材库里 ⇒ 氛围层空着`);
        }
      } else {
        ambienceReason = 'no-ambience-for-tier';
      }
      ambience = slot;
    } else {
      ambienceReason = 'no-card-tier';
    }
    return json(200, {
      ok: true,
      no: fig ? fig.no : (amb ? amb.no : ''),
      tier: fig ? fig.tier : (amb ? amb.tier : null),
      effort: fig ? fig.effort : null,
      figure,
      figureReason,
      ambience,
      ambienceReason,
    });
  };
}

 
function bindingsHandler(store) {
  return async (request) => {
    const q = new URL(request.url).searchParams;
    const query = {
      key: q.get('key'),
      resolve: q.get('resolve'),
      provider: q.get('provider'),
      model: q.get('model'),
      slot: q.get('slot'),
      variant: q.get('variant'),
      
      
      
      removeAsset: q.get('removeAsset'),
    };
    let body = null;
    if (request.method === 'POST') {
      try {
        body = await request.json();
      } catch {
        return json(400, { ok: false, reason: 'bad-request', detail: 'json expected' });
      }
    }
    const plan = binding.planBindingRequest(request.method, query, body);
    if (plan.error) {
      return json(400, { ok: false, reason: 'bad-request', detail: plan.error });
    }

    if (plan.action === 'get') {
      const table = readBindings(store).bindings;
      const hit = table[plan.key];
      if (!hit) return json(404, { ok: false, reason: 'not-found' });
      return json(200, { ok: true, key: plan.key, binding: hit });
    }

    if (plan.action === 'resolve') {
      const table = readBindings(store).bindings;
      const manifest = readManifest(store);
      const aliveHit = binding.resolveBinding(table, plan.chain, plan.slot, plan.variant, { manifest });
      const hit = aliveHit.binding ? aliveHit : binding.resolveBinding(table, plan.chain, plan.slot, plan.variant);
      if (!hit.binding) {
        return json(200, { ok: true, key: hit.key, why: hit.why, resolved: null, plan: null });
      }
      const rendered = binding.mediaPlan(hit.binding, manifest);
      if (rendered.error) {
        
        return json(200, { ok: true, key: hit.key, why: hit.why, resolved: hit.binding, plan: null, stale: rendered.error });
      }
      return json(200, {
        ok: true,
        key: hit.key,
        why: hit.why,
        resolved: hit.binding,
        plan: rendered.plan,
      });
    }

    if (plan.action === 'list') {
      const doc = readBindings(store);
      const manifest = readManifest(store);
      const stale = [];
      for (const key of Object.keys(doc.bindings)) {
        const b = doc.bindings[key];
        if (!binding.assetOf(manifest, b.assetId)) stale.push(key);
      }
      return json(200, {
        ok: true,
        bindings: doc.bindings,
        stale,
        
        assets: media.assetRows(manifest),
        config: readConfig(store),
        
        rows: binding.bindingsRows(doc),
        
        
        capabilities: binding.bindingsCapabilities(doc),
      });
    }

    if (plan.action === 'clear') {
      return await withStoreLock(store, async () => {
        const doc = readBindings(store);
        const cleared = binding.clearBinding(doc, plan.key);
        if (cleared.error) return json(400, { ok: false, reason: 'bad-request', detail: cleared.error });
        media.atomicWriteJson(nodeFs, nodePath, store.bindingsFile, cleared.bindings);
        return json(200, { ok: true, key: plan.key, removed: true, bindings: cleared.bindings.bindings });
      });
    }

    
    
    
    if (plan.action === 'remove-asset') {
      return await withStoreLock(store, async () => {
        const manifest = readManifest(store);
        const asset = manifest.assets && manifest.assets[plan.assetId];
        if (!media.isAssetId(plan.assetId) || !asset) {
          return json(404, { ok: false, reason: 'not-found' });
        }
        const doc = readBindings(store);
        const refs = Object.keys(doc.bindings).filter((k) => {
          const b = doc.bindings[k] || {};
          return (
            b.assetId === plan.assetId ||
            b.posterAssetId === plan.assetId ||
            b.cutout === plan.assetId ||
            b.cutoutStill === plan.assetId
          );
        });
        if (refs.length > 0) {
          return json(409, { ok: false, reason: 'asset-in-use', refs });
        }
        const ext = Object.prototype.hasOwnProperty.call(media.TYPES, asset.ext) ? asset.ext : 'png';
        
        
        
        
        for (const otherId of Object.keys(manifest.assets)) {
          const other = manifest.assets[otherId];
          if (other && other.cutout === plan.assetId) delete other.cutout;
          if (other && other.cutoutStill === plan.assetId) delete other.cutoutStill;
        }
        delete manifest.assets[plan.assetId];
        media.atomicWriteJson(nodeFs, nodePath, store.manifestFile, manifest);
        const file = nodePath.join(store.assetsDir, `${plan.assetId}.${ext}`);
        const fileRemoved = await unlinkQuiet(file);
        if (!fileRemoved) console.error(`${TAG} remove-asset: manifest row dropped but file gone: ${plan.assetId}`);
        return json(200, {
          ok: true,
          removed: true,
          id: plan.assetId,
          fileRemoved,
          assets: media.assetRows(manifest),
        });
      });
    }

    
    return await withStoreLock(store, async () => {
      const manifest = readManifest(store);
      const checked = binding.validateBinding(Object.assign({}, plan.binding, { slot: plan.slot }), manifest);
      if (checked.error) {
        return json(checked.error === 'bad-binding' ? 400 : 422, { ok: false, reason: checked.error });
      }
      const doc = readBindings(store);
      const written = binding.setBinding(doc, plan.key, checked.binding, new Date().toISOString());
      if (written.error) return json(400, { ok: false, reason: 'bad-request', detail: written.error });
      media.atomicWriteJson(nodeFs, nodePath, store.bindingsFile, written.bindings);
      return json(200, { ok: true, key: plan.key, scopeKey: plan.scopeKey, binding: written.bindings.bindings[plan.key] });
    });
  };
}

 
function configHandler(store) {
  return async (request) => {
    if (request.method === 'GET') {
      return json(200, { ok: true, config: readConfig(store) });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { ok: false, reason: 'bad-request', detail: 'json expected' });
    }
    return await withStoreLock(store, async () => {
      const merged = media.mergeConfig(readConfig(store), body);
      if (merged.error) {
        return json(400, { ok: false, reason: merged.error });
      }
      media.atomicWriteJson(nodeFs, nodePath, store.configFile, merged.config);
      return json(200, { ok: true, config: merged.config });
    });
  };
}

 
function catalogCards() {
  return cardCatalog && Array.isArray(cardCatalog.cards) ? cardCatalog.cards : [];
}

 
function readPersonaOverrides(store) {
  const raw = media.readJson(nodeFs, store.personaFile, {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw;
}

 
function readLocalePayload() {
  const out = { ui: {}, cards: {} };
  const readOne = (rel) => {
    try {
      const p = require.resolve(rel);
      const j = JSON.parse(nodeFs.readFileSync(p, 'utf8'));
      return (j && typeof j === 'object' && !Array.isArray(j)) ? j : null;
    } catch (_error) {
      return null;
    }
  };
  const ui = readOne('./src/i18n/ui.en.json');
  if (ui) out.ui = ui;
  const cards = readOne('./data/providers.en.json');
  if (cards && cards.cards && typeof cards.cards === 'object' && !Array.isArray(cards.cards)) {
    out.cards = cards.cards;
  }
  return out;
}

 
function personaHandler(store) {
  return async (request) => {
    const method = String(request.method || 'GET').toUpperCase();
    if (method === 'GET') {
      
      let wantLocale = false;
      try {
        wantLocale = new URL(request.url).searchParams.get('locale') === '1';
      } catch (_error) {
        wantLocale = false;
      }
      const body = { ok: true, overrides: readPersonaOverrides(store) };
      if (wantLocale) body.locale = readLocalePayload();
      return json(200, body);
    }
    if (method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json(400, { ok: false, reason: 'bad-request', detail: 'json expected' });
      }
      const checked = carddata.validatePersonaOverrides(catalogCards(), body);
      if (!checked.ok) {
        return json(400, { ok: false, reason: checked.reason, detail: checked.detail || null });
      }
      return await withStoreLock(store, async () => {
        media.atomicWriteJson(nodeFs, nodePath, store.personaFile, checked.normalized);
        return json(200, { ok: true, overrides: checked.normalized });
      });
    }
    
    let no = null;
    try {
      no = new URL(request.url).searchParams.get('no');
    } catch (_error) {
      no = null;
    }
    return await withStoreLock(store, async () => {
      const cur = readPersonaOverrides(store);
      if (no === null || no === undefined || no === '') {
        media.atomicWriteJson(nodeFs, nodePath, store.personaFile, {});
        return json(200, { ok: true, overrides: {} });
      }
      const known = catalogCards().some((c) => c && String(c.no) === String(no));
      if (!known) return json(400, { ok: false, reason: 'unknown-card:' + no });
      const next = Object.assign({}, cur);
      delete next[String(no)];
      media.atomicWriteJson(nodeFs, nodePath, store.personaFile, next);
      return json(200, { ok: true, overrides: next });
    });
  };
}

 
function readMeta(store) {
  return media.readJson(nodeFs, store.metaFile, { attribution: '', licenseNote: '' });
}

 
async function storeAssetBuffer(store, { type, name, buffer }) {
  const t = String(type || '').toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(media.TYPES, t)) {
    return { status: 400, json: { ok: false, reason: 'bad-request', detail: 'type not allowed' } };
  }
  const cfg = readConfig(store);
  const cap = media.TYPES[t].family === 'video' ? cfg.maxVideoBytes : cfg.maxImageBytes;
  if (buffer.length === 0) {
    return { status: 400, json: { ok: false, reason: 'bad-request', detail: 'zero bytes' } };
  }
  if (buffer.length > cap) {
    return { status: 413, json: { ok: false, reason: 'too-large', limitBytes: cap, receivedBytes: buffer.length } };
  }
  const manifest = readManifest(store);
  const usedBytes = media.manifestBytes(manifest);
  if (usedBytes >= cfg.totalBytes) {
    return { status: 429, json: { ok: false, reason: 'quota-exceeded', usedBytes, totalBytes: cfg.totalBytes } };
  }
  const probed = media.probeType(buffer.subarray(0, media.LIMITS.firstChunkPeek));
  if (probed === null) {
    return { status: 415, json: { ok: false, reason: 'type-mismatch', detail: 'unknown signature' } };
  }
  if (probed !== t) {
    return { status: 415, json: { ok: false, reason: 'type-mismatch', detail: `looks like ${probed}` } };
  }
  const sha = nodeCrypto.createHash('sha256').update(buffer).digest('hex');
  const dupe = media.findAssetBySha(manifest, sha);
  if (dupe) {
    
    return { status: 200, json: { ok: true, id: dupe.id, deduped: true, bytes: dupe.bytes }, id: dupe.id };
  }
  if (usedBytes + buffer.length > cfg.totalBytes) {
    return { status: 429, json: { ok: false, reason: 'quota-exceeded', usedBytes, incomingBytes: buffer.length, totalBytes: cfg.totalBytes } };
  }
  const id = media.newAssetId();
  const finalName = `${id}.${t}`;
  const finalPath = nodePath.join(store.assetsDir, finalName);
  try {
    await nodeFs.promises.writeFile(finalPath, buffer);
    manifest.assets[id] = media.normalizeAsset({
      id,
      ext: t,
      mime: media.TYPES[t].mime,
      bytes: buffer.length,
      sha256: sha,
      name: name || undefined,
      createdAt: new Date().toISOString(),
    });
    media.atomicWriteJson(nodeFs, nodePath, store.manifestFile, manifest);
  } catch (err) {
    await unlinkQuiet(finalPath);
    console.error(`${TAG} package import asset write failed: ${err && err.message}`);
    return { status: 500, json: { ok: false, reason: 'internal' } };
  }
  return { status: 200, json: { ok: true, id, bytes: buffer.length, mime: media.TYPES[t].mime, sha256: sha }, id };
}

 
function cardNoOf(provider, model) {
  const cards = cardCatalog && Array.isArray(cardCatalog.cards) ? cardCatalog.cards : [];
  const hit = cards.find((c) => c && c.provider === provider && c.model === model);
  return hit && hit.no ? String(hit.no) : '';
}

 
function packageHandler(store) {
  return async (request) => {
    if (request.method === 'GET') {
      const manifest = readManifest(store);
      const doc = readBindings(store);
      const meta = readMeta(store);

      
      const referenced = new Set();
      for (const key of Object.keys(doc.bindings)) {
        const b = doc.bindings[key] || {};
        if (b.assetId) referenced.add(b.assetId);
        if (b.posterAssetId) referenced.add(b.posterAssetId);
      }
      const assetIds = [...referenced].filter((id) => manifest.assets && manifest.assets[id]);

      
      const packedIds = new Set();
      const assets = [];
      for (const id of assetIds) {
        const a = manifest.assets[id];
        let data = '';
        try {
          data = await nodeFs.promises
            .readFile(nodePath.join(store.assetsDir, `${a.id}.${a.ext}`))
            .then((buf) => buf.toString('base64'));
        } catch {
          continue; 
        }
        packedIds.add(a.id);
        assets.push({
          id: a.id,
          sha256: a.sha256,
          data,
          ext: a.ext,
          mime: a.mime,
          kind: a.kind || undefined,
          family: a.family || undefined,
          bytes: a.bytes,
          name: a.name || undefined,
        });
      }

      
      let firstCard = { provider: '', model: '' };
      const bindings = [];
      for (const key of Object.keys(doc.bindings)) {
        const parsed = binding.parseBindingKey(key);
        const b = doc.bindings[key] || {};
        if (!parsed || !b.assetId || !packedIds.has(b.assetId)) continue;
        const s = pkg.scopeOf(parsed.scopeKey);
        const row = { scope: s.scope, slot: parsed.slot, assetId: b.assetId };
        if (s.scope !== 'default') {
          row.provider = s.provider;
          row.model = s.model;
          if (!firstCard.provider) firstCard = { provider: s.provider, model: s.model };
        }
        if (parsed.variant) row.variant = parsed.variant;
        if (b.posterAssetId && packedIds.has(b.posterAssetId)) row.posterAssetId = b.posterAssetId;
        for (const k of ['fit', 'objectPosition', 'loop', 'muted', 'credit']) {
          if (b[k] !== undefined && b[k] !== null) row[k] = b[k];
        }
        bindings.push(row);
      }

      const no = firstCard.provider ? cardNoOf(firstCard.provider, firstCard.model) : '';
      return json(200, {
        version: pkg.PACKAGE_VERSION,
        provider: firstCard.provider,
        model: firstCard.model,
        no,
        assets,
        bindings,
        attribution: meta.attribution || '',
        licenseNote: meta.licenseNote || '',
        
        
        
        personaOverrides: readPersonaOverrides(store),
      });
    }

    
    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { ok: false, reason: 'bad-request', detail: 'json expected' });
    }
    const parsed = pkg.parse(body);
    if (parsed.error) {
      return json(400, { ok: false, reason: 'bad-request', detail: parsed.error });
    }
    const pack = parsed.pack;

    
    
    
    
    
    let personaIncoming = null;
    if (pack.personaOverrides !== undefined) {
      const checked = carddata.validatePersonaOverrides(catalogCards(), pack.personaOverrides);
      if (!checked.ok) {
        return json(400, { ok: false, reason: checked.reason, detail: checked.detail || null });
      }
      personaIncoming = checked.normalized;
    }

    return await withStoreLock(store, async () => {
      
      const idMap = new Map();
      let deduped = 0;
      for (const asset of pack.assets) {
        const buffer = Buffer.from(asset.data, 'base64');
        const res = await storeAssetBuffer(store, {
          type: typeof asset.ext === 'string' && asset.ext ? asset.ext : '',
          name: typeof asset.name === 'string' ? asset.name : '',
          buffer,
        });
        if (res.status !== 200) {
          return json(res.status, res.json);
        }
        idMap.set(asset.id, res.id);
        if (res.json.deduped) deduped += 1;
      }

      
      const manifest = readManifest(store);
      const prepared = [];
      for (const pb of pack.bindings) {
        const imported = pkg.importedBinding(pb, idMap);
        if (imported.error) {
          return json(422, { ok: false, reason: imported.error });
        }
        const checked = binding.validateBinding(Object.assign({}, imported.binding, { slot: imported.slot }), manifest);
        if (checked.error) {
          return json(checked.error === 'bad-binding' ? 400 : 422, { ok: false, reason: checked.error });
        }
        prepared.push({ key: imported.key, scopeKey: imported.scopeKey, binding: checked.binding });
      }

      
      const doc = readBindings(store);
      let written = doc;
      const nowIso = new Date().toISOString();
      for (const item of prepared) {
        const next = binding.setBinding(written, item.key, item.binding, nowIso);
        if (next.error) return json(400, { ok: false, reason: 'bad-request', detail: next.error });
        written = next.bindings;
      }
      media.atomicWriteJson(nodeFs, nodePath, store.bindingsFile, written);

      
      media.atomicWriteJson(nodeFs, nodePath, store.metaFile, {
        attribution: pack.attribution || '',
        licenseNote: pack.licenseNote || '',
      });

      
      
      
      if (personaIncoming !== null) {
        const merged = pkg.mergePersonaOverrides(readPersonaOverrides(store), personaIncoming);
        media.atomicWriteJson(nodeFs, nodePath, store.personaFile, merged);
      }

      return json(200, {
        ok: true,
        importedAssets: pack.assets.length,
        deduped,
        importedBindings: pack.bindings.length,
        importedPersonaOverrides: personaIncoming === null ? 0 : Object.keys(personaIncoming).length,
      });
    });
  };
}

 
function skinAdapterHandler(registry) {
  return async (request) => {
    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json(400, { ok: false, reason: 'bad-request', detail: 'json expected' });
      }
      const normalized = skin.normalizeMeta(body);
      if (normalized.error) {
        return json(400, { ok: false, reason: normalized.error });
      }
      const registeredAt = new Date().toISOString();
      registry.set(normalized.meta.id, { meta: normalized.meta, registeredAt });
      return json(200, { ok: true, adapter: skin.row(normalized.meta, registeredAt) });
    }

    if (request.method === 'DELETE') {
      const id = new URL(request.url).searchParams.get('id') || '';
      const removed = id ? registry.delete(id) : false;
      return json(200, { ok: true, removed, id });
    }

    
    const rows = skin.rowsFromMap(registry);
    return json(200, { ok: true, ...skin.diagnostics(rows) });
  };
}

 

 
let quotaFaceState = null;

function quotaFace() {
  if (!quotaFaceState) {
    quotaFaceState = {
      events: quotas.createQuotaEvents(),
      notifier: notifier.createNotifier(),
      
      
      cg: null,
    };
  }
  return quotaFaceState;
}

 
function runtimeHome() {
  return process.env.DSH_HOME || nodePath.join(nodeOs.homedir(), '.dsh');
}

 
function readRuntimeSnapshot() {
  const file = nodePath.join(runtimeHome(), quotas.RUNTIME_SNAPSHOT_FILENAME);
  try {
    const text = nodeFs.readFileSync(file, 'utf8');
    return { file, readable: true, snapshot: JSON.parse(text), error: null };
  } catch (err) {
    return {
      file,
      readable: false,
      snapshot: null,
      error: err && err.message ? String(err.message) : String(err),
    };
  }
}

 
function readNameMapDoc() {
  const doc = readNameMapRaw();
  return doc ? quotas.loadNameMap(doc) : null;
}

 
function readNameMapRaw() {
  try {
    const file = require.resolve('./data/name-map.json');
    return JSON.parse(nodeFs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

 
function quotasHandler(store) {
  return async (request) => {
    const q = new URL(request.url).searchParams;
    const provider = (q.get('provider') || '').trim();
    const model = (q.get('model') || '').trim();
    const nowMs = Date.now();
    const nameMap = readNameMapDoc();
    const face = quotaFace();
    const read = readRuntimeSnapshot();

    const evaluated = read.readable
      ? quotas.evaluate(read.snapshot, { now: () => nowMs })
      : { routes: {} };
    const allRows = read.readable
      ? quotas.snapshotRows(read.snapshot, evaluated, {
          nameMap,
          now: nowMs,
          labels: notifier.WINDOW_LABELS,
        })
      : [];
    
    
    const events = face.events.ingest(read.readable ? read.snapshot : { routes: {} }, {
      now: () => nowMs,
    });

    const selection = provider && model ? { provider, model } : null;
    
    
    
    
    
    
    
    const selectionUp = selection
      ? carddata.routeUpstream(provider, model)
      : null;
    
    
    
    const selectedRoute = selectionUp
      ? quotas.routeOf(nameMap, selectionUp.provider, selectionUp.model, {
          mergeAccount: readConfig(store).dsAccountSeparate !== true,
        })
      : null;
    
    
    
    
    
    const cgSelection = selectionUp
      ? { provider: selectionUp.provider, model: selectionUp.model, route: selectedRoute }
      : null;
    const notifications = face.notifier.ingest({ events, selection: selectionUp, nameMap });
    const rows = selection ? allRows.filter((row) => row.route === selectedRoute) : allRows;
    const latest = quotas.latestReading(allRows);
    
    
    
    
    
    
    
    
    const selectedMapped = selection ? typeof selectedRoute === 'string' && selectedRoute.length > 0 : null;
    const staleReason = !read.readable
      ? 'no-snapshot' 
      : !selection
        ? null 
        : (rows.length === 0
          ? (selectedMapped ? 'no-reading' : 'unmapped')
          : null); 
    const stale = !read.readable || quotas.rowsStale(rows);
    
    
    
    
    const cg = quotas.selectedCg(cgSelection, rows, face.cg, nowMs, { snapshotOk: read.readable });
    face.cg = cg.next;

    return json(200, {
      ok: true,
      at: nowMs,
      observed_at: latest ? latest.observed_at : null,
      valid_until: latest ? latest.valid_until : null,
      stale,
      
      
      
      stale_reason: staleReason,
      rows,
      
      
      
      
      selected: selection
        ? {
            provider: provider,
            model: model,
            route: selectedRoute,
            upstream: selectionUp,
            mapped: selectedMapped,
          }
        : null,
      
      selected_cg: { slot: cg.slot, route: cg.route, level: cg.level, reason: cg.reason },
      notifications,
      diag: {
        
        
        
        
        identity: selectionUp
          ? {
              gateway: provider,
              group: carddata.magpieGroupOf(provider, model),
              upstream: selectionUp,
            }
          : null,
        rows: allRows.length,
        
        
        
        
        
        
        unknown_state_count: quotas.unknownStateCount(allRows),
        events: events.length,
        notifier: face.notifier.state(),
        
        
        
        
        
        
        
        
        
        quota: {
          source: quotas.SOURCE_RUNTIME,
          matched: selectedMapped,
          reason: !selection
            ? null
            : (!read.readable ? 'no-snapshot' : staleReason || 'ok'),
        },
        source: {
          kind: quotas.SOURCE_RUNTIME,
          file: read.file,
          readable: read.readable,
          error: read.error,
        },
      },
    });
  };
}

 

 
function sessionProjcacheDir() {
  return nodePath.join(runtimeHome(), 'storages', 'session_projcache', 'sessions');
}

 
const SESSION_SPEED_WINDOW_DAYS = 7;
const SESSION_SPEED_CACHE_MS = 10 * 60 * 1000;
 
const SESSION_SPEED_FIRST_SCAN_DELAY_MS = 30 * 1000;

 
let sessionSpeedScanner = null;

function sessionSpeedScan() {
  if (sessionSpeedScanner === null) {
    sessionSpeedScanner = sessionspeed.createScanner({
      fs: nodeFs.promises,
      path: nodePath,
      dir: sessionProjcacheDir(),
      windowMs: SESSION_SPEED_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      freshMs: SESSION_SPEED_CACHE_MS,
      yieldEvery: 20,
      
      fold: (rows, scanned) => {
        const table = measured.speedFromSessions(rows, { normOf: (m) => carddata.normModel(m) });
        table.scanned = scanned;
        table.window_days = SESSION_SPEED_WINDOW_DAYS;
        return table;
      },
    });
  }
  return sessionSpeedScanner;
}

 
function readSessionSpeed(nowMs) {
  const scan = sessionSpeedScan();
  scan.ensure(nowMs); 
  const snap = scan.peek();
  return snap.ready ? snap.table : null;
}

 
function scheduleSessionSpeedFirstScan() {
  const timer = setTimeout(() => {
    sessionSpeedScan().refresh(Date.now()).catch(() => {   });
  }, SESSION_SPEED_FIRST_SCAN_DELAY_MS);
  if (typeof timer.unref === 'function') timer.unref();
  return () => clearTimeout(timer);
}

 
let measuredFaceState = null;

function measuredState() {
  if (!measuredFaceState) {
    measuredFaceState = {
      meter: measured.createSpeedMeter({ now: () => Date.now() }),
      links: measured.createLinkMeter(),
    };
  }
  return measuredFaceState;
}

 
function linkTap(routePath, handler) {
  return async (request) => {
    const startedAt = Date.now();
    try {
      return await handler(request);
    } finally {
      
      
      measuredState().links.record(routePath, Date.now() - startedAt);
    }
  };
}

 
const LEDGER_FRESH_MS = 30 * 1000;

 
function ledgerFile() {
  return nodePath.join(runtimeHome(), 'storages', 'cost-meter', 'ledger.json');
}

 
let ledgerCacheInstance = null;
function ledgerCache() {
  if (ledgerCacheInstance === null) {
    ledgerCacheInstance = ledgercache.createLedgerCache({
      file: ledgerFile(),
      fsp: fs,
      readSync: () => nodeFs.readFileSync(ledgerFile(), 'utf8'),
      freshMs: LEDGER_FRESH_MS,
    });
  }
  return ledgerCacheInstance;
}

function readLedger() {
  try {
    return ledgerCache().get(Date.now()).doc;
  } catch {
    return null;
  }
}

 
function seenFile(store) {
  return nodePath.join(store.root, measured.SEEN_FILENAME);
}

 
let seenBridgeDoc = null;

function seenBridge() {
  if (!seenBridgeDoc) seenBridgeDoc = measured.emptySeen();
  return seenBridgeDoc;
}

 
function mountSeenBridge() {
  const getter = () => seenBridge();
  try {
    Object.defineProperty(globalThis, measured.SEEN_GLOBAL, {
      get: getter,
      configurable: true,
      enumerable: false,
    });
  } catch (err) {
    console.warn(`${TAG} seen bridge skipped: ${err && err.message ? err.message : err}`);
    return () => {};
  }
  return () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, measured.SEEN_GLOBAL);
    if (desc && desc.get === getter) {
      try { delete globalThis[measured.SEEN_GLOBAL]; } catch {   }
    }
  };
}

 
function readSeen(store) {
  let doc;
  try {
    doc = measured.loadSeenJson(nodeFs.readFileSync(seenFile(store), 'utf8'));
  } catch {
    doc = measured.emptySeen();
  }
  const holder = seenBridge();
  holder.version = doc.version;
  holder.seen = doc.seen;
  return doc;
}

 
async function writeSeen(store, doc) {
  const norm = measured.normalizeSeen(doc);
  await media.atomicWriteJson(nodeFs, nodePath, seenFile(store), norm);
  const holder = seenBridge();
  holder.version = norm.version;
  holder.seen = norm.seen;
  return norm;
}

 
function measuredHandler(store) {
  return async (request) => {
    const q = new URL(request.url).searchParams;
    const query = { provider: q.get('provider'), model: q.get('model') };
    let body = null;
    if (request.method === 'POST') {
      try {
        body = await request.json();
      } catch {
        return json(400, { ok: false, reason: 'bad-request', detail: 'json body expected' });
      }
    }
    const plan = measured.planMeasuredRequest(request.method, query, body);
    if (plan.error) return json(400, { ok: false, reason: 'bad-request', detail: plan.error });

    const state = measuredState();
    const nowMs = Date.now();

    if (plan.action === 'mark-seen') {
      const doc = readSeen(store);
      measured.markSeen(doc, plan.provider, plan.model, nowMs);
      const saved = await writeSeen(store, doc);
      const key = measured.seenKey(plan.provider, plan.model);
      
      
      const seenOut = {};
      if (saved.seen[key]) seenOut[key] = saved.seen[key];
      return json(200, {
        ok: true,
        at: nowMs,
        action: 'mark-seen',
        playMode: measured.resolvePlayMode(saved, plan.provider, plan.model),
        seen: seenOut,
        seen_key: key,
        storage: {
          file: seenFile(store),
          global: measured.SEEN_GLOBAL,
          version: measured.SEEN_VERSION,
          max: measured.SEEN_MAX,
          entries: Object.keys(saved.seen).length,
        },
      });
    }

    if (plan.action === 'record-speed') {
      const sample = state.meter.record(plan.provider, plan.model, {
        tokens: plan.tokens,
        durationMs: plan.durationMs,
        ttftMs: plan.ttftMs,
        atMs: nowMs,
      });
      const agg = state.meter.aggregate(plan.provider, plan.model);
      return json(200, {
        ok: true,
        at: nowMs,
        action: 'record-speed',
        recorded: sample,
        
        
        samples: state.meter.count(plan.provider, plan.model),
        min_samples: state.meter.minSamples,
        speed: agg || null,
      });
    }

    const rawMap = readNameMapRaw();
    const nameMap = rawMap ? measured.loadNameMap(rawMap) : null;
    const read = readRuntimeSnapshot();
    const routes =
      read.readable && read.snapshot && typeof read.snapshot.routes === 'object'
        ? read.snapshot.routes
        : {};
    const ledger = readLedger();
    
    
    
    
    const sessionSpeed = readSessionSpeed(nowMs);
    const face = measured.measuredCards({
      
      
      keys: carddata.KEYS,
      sourceOf: carddata.SRC,
      cards: cardCatalog.cards,
      
      provider: query.provider,
      model: query.model,
      nameMap,
      routes,
      ledger,
      
      speedOf: (p, m) => state.meter.aggregate(p, m),
      
      sessionSpeed,
      
      publicSpeedDoc,
      benchDoc,
      
      normOf: (m) => carddata.normModel(m),
      seen: readSeen(store),
      nowMs,
      seenFile: seenFile(store),
      linkMs: state.links.aggregate(),
    });

    return json(200, {
      ok: true,
      action: 'snapshot',
      ...face,
      diag: {
        
        
        cards: Object.keys(face.cards).length,
        mapped: Object.keys(face.cards).filter((k) => face.cards[k].mapped).length,
        name_map: nameMap
          ? {
              cards: nameMap.byCard.size,
              routes: nameMap.byRoute.size,
              dropped: nameMap.dropped.length,
            }
          : null,
        catalog: Array.isArray(cardCatalog.cards) ? cardCatalog.cards.length : 0,
        ledger_file: ledgerFile(),
        ledger_readable: ledger !== null,
        ledger_days: measured.LEDGER_WINDOW_DAYS,
        runtime: {
          kind: quotas.SOURCE_RUNTIME,
          file: read.file,
          readable: read.readable,
          error: read.error,
        },
        speed_min_samples: state.meter.minSamples,
      },
    });
  };
}
