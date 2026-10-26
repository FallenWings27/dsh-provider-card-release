'use strict';
 

const crypto = require('node:crypto');



const { DEFAULT_COOLDOWN_MS } = require('./watcher.cjs');

 
const COOLDOWN_MIN_MS = 1000;
const COOLDOWN_MAX_MS = 24 * 60 * 60 * 1000;

 
const HUD_LAYOUTS = ['mini', 'card'];
const DEFAULT_HUD_LAYOUT = 'mini';

 
const DEFAULT_HUD_DOCK_AUTO_EXPAND = true;

 
const ROUTES = [
  { path: '/api/dsh-provider-card/assets/upload', methods: ['POST'], requestBody: 'streaming' },
  { path: '/api/dsh-provider-card/assets/media', methods: ['GET', 'HEAD'], requestBody: 'buffered' },
  { path: '/api/dsh-provider-card/config', methods: ['GET', 'POST'], requestBody: 'buffered' },
  
  { path: '/api/dsh-provider-card/package', methods: ['GET', 'POST'], requestBody: 'buffered' },
  
  { path: '/api/dsh-provider-card/skin-adapter', methods: ['GET', 'POST', 'DELETE'], requestBody: 'buffered' },
  
  { path: '/api/dsh-provider-card/quotas', methods: ['GET'], requestBody: 'buffered' },
  
  
  
  
  { path: '/api/dsh-provider-card/measured', methods: ['GET', 'POST'], requestBody: 'buffered' },
  
  
  
  
  
  
  
  { path: '/api/dsh-provider-card/persona', methods: ['GET', 'POST', 'DELETE'], requestBody: 'buffered' },
];

 
const BINDING_ROUTES = [
  { path: '/api/dsh-provider-card/assets/bindings', methods: ['GET', 'POST', 'DELETE'], requestBody: 'buffered' },
];

 
const ALL_ROUTES = ROUTES.concat(BINDING_ROUTES);

 
function assertNoDuplicatePath(routes) {
  const seen = new Set();
  for (const r of routes) {
    if (seen.has(r.path)) throw new Error(`route-url: duplicate path ${r.path}`);
    seen.add(r.path);
  }
}
assertNoDuplicatePath(ALL_ROUTES);

 
const ROUTE_URLS = (() => {
  const find = (suffix) => {
    const hit = ALL_ROUTES.find((r) => r.path.endsWith(suffix));
    if (!hit) throw new Error(`route-url: missing ${suffix}`);
    return hit.path;
  };
  return {
    upload: find('/assets/upload'),
    media: find('/assets/media'),
    config: find('/config'),
    bindings: find('/assets/bindings'),
    package: find('/package'),
    skinAdapter: find('/skin-adapter'),
    quotas: find('/quotas'),
    measured: find('/measured'),
    
    
    
    persona: find('/persona'),
  };
})();

 
const LIMITS = {
  maxVideoBytes: 100 * 1024 * 1024,
  maxImageBytes: 20 * 1024 * 1024,
  
  
  totalBytes: 1073741824,
  firstChunkPeek: 44, 
};

 
const TYPES = {
  png: { mime: 'image/png', family: 'image' },
  gif: { mime: 'image/gif', family: 'image' },
  jpg: { mime: 'image/jpeg', family: 'image' },
  webp: { mime: 'image/webp', family: 'image' },
  mp4: { mime: 'video/mp4', family: 'video' },
  webm: { mime: 'video/webm', family: 'video' },
};

 



const ASSET_FIELDS = [
  'id', 'ext', 'mime', 'bytes', 'sha256', 'name', 'createdAt', 'cutout', 'cutoutStill',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA_RE = /^[0-9a-f]{64}$/;

 
function newAssetId() {
  return crypto.randomUUID();
}

 
function isAssetId(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function isSha(value) {
  return typeof value === 'string' && SHA_RE.test(value);
}

 
function probeType(head) {
  if (!head || head.length < 4) return null;
  if (head.length >= 12
    && head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46
    && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) return 'webp';
  if (head.length >= 12
    && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) return 'mp4';
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'png';
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x38) return 'gif';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpg';
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'webm';
  return null;
}

 
function parseRange(header, size) {
  if (header === null || header === undefined || header === '') return { kind: 'full' };
  if (typeof header !== 'string') return { kind: 'invalid', reason: 'type' };
  const s = header.trim();
  if (!s.startsWith('bytes=') || s.includes(',')) return { kind: 'invalid', reason: 'syntax-or-multi' };
  const spec = s.slice(6);
  const dash = spec.indexOf('-');
  if (dash < 0) return { kind: 'invalid', reason: 'syntax-or-multi' };
  const a = spec.slice(0, dash).trim();
  const b = spec.slice(dash + 1).trim();
  let start;
  let end;
  if (a === '' && b === '') return { kind: 'invalid', reason: 'empty-both' };
  if (a === '') {
    const n = Number(b);
    if (!Number.isInteger(n) || n <= 0) return { kind: 'invalid', reason: 'suffix' };
    if (n > size) return { kind: 'invalid', reason: 'unsatisfiable' };
    start = size - n;
    end = size - 1;
  } else if (b === '') {
    start = Number(a);
    if (!Number.isInteger(start) || start < 0 || start >= size) return { kind: 'invalid', reason: 'unsatisfiable' };
    end = size - 1;
  } else {
    start = Number(a);
    end = Number(b);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
      return { kind: 'invalid', reason: 'unsatisfiable' };
    }
    if (end >= size) end = size - 1;
  }
  return { kind: 'partial', start, end };
}

 
function reasonOf(status) {
  return {
    400: 'bad-request',
    404: 'not-found',
    408: 'timeout',
    413: 'too-large',
    415: 'type-mismatch',
    416: 'range-unsatisfiable',
    429: 'quota-exceeded',
    500: 'internal',
  }[status] || 'error';
}

function jsonError(status, extra) {
  return { status, body: Object.assign({ ok: false, reason: reasonOf(status) }, extra || {}) };
}

function jsonOk(body) {
  return { status: 200, body: Object.assign({ ok: true }, body || {}) };
}

 
function safeName(raw) {
  if (typeof raw !== 'string') return null;
  const base = raw.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/^\.+/, '').trim().slice(0, 120);
  return base === '' ? null : base;
}

 
function readJson(fs, file, fallback) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed;
  } catch (e) {
    return typeof fallback === 'function' ? fallback(e) : fallback;
  }
}

 
function atomicWriteJson(fs, path, file, obj) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.tmp-${crypto.randomBytes(6).toString('hex')}`);
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

function emptyManifest() {
  return { version: 1, assets: {} };
}

 
function normalizeAsset(a) {
  const out = {};
  for (const k of ASSET_FIELDS) {
    if (a[k] !== undefined && a[k] !== null) out[k] = a[k];
  }
  return out;
}

 
function manifestBytes(manifest) {
  let n = 0;
  for (const id of Object.keys((manifest && manifest.assets) || {})) {
    const b = Number(manifest.assets[id] && manifest.assets[id].bytes);
    if (Number.isFinite(b) && b > 0) n += b;
  }
  return n;
}

 
function findAssetBySha(manifest, sha) {
  const assets = (manifest && manifest.assets) || {};
  for (const id of Object.keys(assets)) {
    if (assets[id] && assets[id].sha256 === sha) return assets[id];
  }
  return null;
}

 
function seedStore(fs, path, opts) {
  const o = opts || {};
  const out = { seeded: false, skipped: false, reason: '', assets: 0, bindings: 0, warnings: [], error: null };
  const seedDir = o.seedDir;
  const assetsDir = o.assetsDir;
  const manifestFile = o.manifestFile;
  const bindingsFile = o.bindingsFile;
  if (!seedDir || !assetsDir || !manifestFile || !bindingsFile) {
    out.reason = 'bad-options';
    out.error = 'seed 播种参数不全（seedDir/assetsDir/manifestFile/bindingsFile）';
    return out;
  }
  
  if (fs.existsSync(manifestFile)) {
    out.skipped = true;
    out.reason = 'store-not-empty';
    return out;
  }
  
  if (fs.existsSync(assetsDir) && fs.readdirSync(assetsDir).length > 0) {
    out.skipped = true;
    out.reason = 'store-not-empty';
    return out;
  }
  const seedManifestFile = path.join(seedDir, 'manifest.json');
  if (!fs.existsSync(seedDir) || !fs.existsSync(seedManifestFile)) {
    out.reason = 'seed-missing';
    out.error = `seed 目录缺失或不可读：${seedDir}（未播种；插件继续加载，素材可稍后手动导入）`;
    return out;
  }
  const seedManifest = readJson(fs, seedManifestFile, null);
  const seedAssets = (seedManifest && seedManifest.assets) || null;
  if (!seedAssets || typeof seedAssets !== 'object') {
    out.reason = 'seed-unreadable';
    out.error = `seed/manifest.json 不可读或格式不对：${seedManifestFile}（未播种；插件继续加载）`;
    return out;
  }
  fs.mkdirSync(assetsDir, { recursive: true });
  const ids = Object.keys(seedAssets);
  const copied = [];
  const rollback = () => {
    for (const file of copied) {
      try {
        fs.unlinkSync(file);
      } catch (e) {
        out.warnings.push(`回滚失败（文件已不在或不可删）：${file}`);
      }
    }
  };
  for (const id of ids) {
    const row = seedAssets[id];
    if (!row || typeof row !== 'object' || typeof row.ext !== 'string' || row.ext === '') {
      out.reason = 'seed-invalid-entry';
      out.error = `seed 名册条目不合法（缺 ext）：${id}（未播种；插件继续加载）`;
      rollback();
      return out;
    }
    const src = path.join(seedDir, 'assets', `${id}.${row.ext}`);
    const dest = path.join(assetsDir, `${id}.${row.ext}`);
    if (!fs.existsSync(src)) {
      out.reason = 'seed-asset-missing';
      out.error = `seed 素材缺失：${src}（未播种；插件继续加载）`;
      rollback();
      return out;
    }
    try {
      fs.copyFileSync(src, dest);
      copied.push(dest);
    } catch (e) {
      out.reason = 'seed-copy-failed';
      out.error = `seed 素材复制失败：${src}（${e && e.message}）；未播种，插件继续加载`;
      rollback();
      return out;
    }
  }
  const assets = {};
  for (const id of ids) {
    assets[id] = normalizeAsset(Object.assign({}, seedAssets[id], { id: seedAssets[id].id || id }));
  }
  atomicWriteJson(fs, path, manifestFile, {
    version: Number.isFinite(seedManifest.version) ? seedManifest.version : 1,
    assets,
  });
  const seedBindingsFile = path.join(seedDir, 'bindings.json');
  const seedBindings = readJson(fs, seedBindingsFile, null);
  if (!seedBindings || typeof seedBindings !== 'object') {
    out.warnings.push('seed/bindings.json 缺失或不可读：按空绑定写入');
    atomicWriteJson(fs, path, bindingsFile, { version: 1, bindings: {} });
    out.bindings = 0;
  } else {
    const bindings = (seedBindings.bindings && typeof seedBindings.bindings === 'object') ? seedBindings.bindings : {};
    atomicWriteJson(fs, path, bindingsFile, {
      version: Number.isFinite(seedBindings.version) ? seedBindings.version : 1,
      bindings,
    });
    out.bindings = Object.keys(bindings).length;
  }
  out.seeded = true;
  out.reason = 'seeded';
  out.assets = ids.length;
  return out;
}

 
function defaultConfig() {
  return {
    maxVideoBytes: LIMITS.maxVideoBytes,
    maxImageBytes: LIMITS.maxImageBytes,
    totalBytes: LIMITS.totalBytes,
    cooldownMs: DEFAULT_COOLDOWN_MS,
    hudLayout: DEFAULT_HUD_LAYOUT,
    hudDockAutoExpand: DEFAULT_HUD_DOCK_AUTO_EXPAND,
    dsAccountSeparate: false,
  };
}

 
function familyOf(asset) {
  const mime = String((asset && asset.mime) || '');
  if (mime.indexOf('video/') === 0) return 'video';
  if (mime.indexOf('image/') === 0) return 'image';
  return null;
}

 
function assetRows(manifest) {
  const assets = (manifest && manifest.assets) || {};
  const rows = [];
  for (const id of Object.keys(assets)) {
    const a = assets[id] || {};
    const fam = familyOf(a);
    const row = {
      id,
      kind: fam === 'video' ? 'video' : fam === 'image' ? 'image' : 'unknown',
      mime: typeof a.mime === 'string' ? a.mime : '',
      bytes: Number.isFinite(Number(a.bytes)) && Number(a.bytes) > 0 ? Number(a.bytes) : 0,
      createdAt: typeof a.createdAt === 'string' ? a.createdAt : '',
    };
    if (typeof a.name === 'string' && a.name !== '') row.name = a.name;
    
    if (typeof a.cutout === 'string' && a.cutout !== '') row.cutout = a.cutout;
    
    if (typeof a.cutoutStill === 'string' && a.cutoutStill !== '') row.cutoutStill = a.cutoutStill;
    rows.push(row);
  }
  rows.sort((x, y) => {
    if (x.createdAt !== y.createdAt) return x.createdAt < y.createdAt ? 1 : -1;
    return x.id < y.id ? 1 : -1;
  });
  return rows;
}

 
const BOOLEAN_CONFIG_KEYS = ['dsAccountSeparate', 'hudDockAutoExpand'];

const CONFIG_KEYS = ['maxVideoBytes', 'maxImageBytes', 'totalBytes', 'cooldownMs', 'hudLayout', 'dsAccountSeparate', 'hudDockAutoExpand'];

 
function mergeConfig(cur, incoming) {
  const next = Object.assign({}, cur);
  if (incoming === null || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return { error: 'body-not-object' };
  }
  for (const k of CONFIG_KEYS) {
    if (incoming[k] === undefined) continue;
    if (k === 'hudLayout') {
      if (HUD_LAYOUTS.indexOf(incoming[k]) < 0) return { error: `bad-value:${k}` };
      next[k] = incoming[k];
      continue;
    }
    if (BOOLEAN_CONFIG_KEYS.indexOf(k) !== -1) {
      if (typeof incoming[k] !== 'boolean') return { error: `bad-value:${k}` };
      next[k] = incoming[k];
      continue;
    }
    const v = Number(incoming[k]);
    if (!Number.isInteger(v) || v <= 0) return { error: `bad-value:${k}` };
    if (k === 'cooldownMs' && (v < COOLDOWN_MIN_MS || v > COOLDOWN_MAX_MS)) {
      return { error: 'bad-value:cooldownMs' };
    }
    next[k] = v;
  }
  return { config: next };
}

 
function migrateHudDockAutoExpand(cfg) {
  const cur = cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? cfg : {};
  const next = Object.assign({}, cur);
  if (typeof next.hudDockAutoExpand === 'boolean') {
    return { config: next, changed: false };
  }
  const old = cur.hudLayout;
  next.hudDockAutoExpand = old === 'mini' ? false : DEFAULT_HUD_DOCK_AUTO_EXPAND;
  return { config: next, changed: true, from: old === undefined ? '(absent)' : String(old) };
}

 
function migrateHudDockAutoExpandFile(fs, path, file, backupFile) {
  const cur = readJson(fs, file, null);
  if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) {
    return { changed: false, reason: 'config-missing-or-invalid' };
  }
  const res = migrateHudDockAutoExpand(cur);
  if (!res.changed) return { changed: false, reason: 'already-migrated' };
  if (backupFile) {
    fs.copyFileSync(file, backupFile);
  }
  atomicWriteJson(fs, path, file, res.config);
  return { changed: true, from: res.from, to: res.config.hudDockAutoExpand, backup: backupFile || null };
}

module.exports = {
  ROUTES,
  BINDING_ROUTES,
  ALL_ROUTES,
  assertNoDuplicatePath,
  ROUTE_URLS,
  LIMITS,
  TYPES,
  ASSET_FIELDS,
  BOOLEAN_CONFIG_KEYS,
  CONFIG_KEYS,
  HUD_LAYOUTS,
  DEFAULT_HUD_LAYOUT,
  DEFAULT_HUD_DOCK_AUTO_EXPAND,
  migrateHudDockAutoExpand,
  migrateHudDockAutoExpandFile,
  COOLDOWN_MIN_MS,
  COOLDOWN_MAX_MS,
  UUID_RE,
  SHA_RE,
  newAssetId,
  isAssetId,
  isSha,
  probeType,
  parseRange,
  reasonOf,
  jsonError,
  jsonOk,
  safeName,
  familyOf,
  assetRows,
  readJson,
  atomicWriteJson,
  emptyManifest,
  normalizeAsset,
  manifestBytes,
  findAssetBySha,
  defaultConfig,
  mergeConfig,
  seedStore,
};
