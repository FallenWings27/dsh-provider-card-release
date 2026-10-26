'use strict';
 






const { pairKey } = require('./measured.cjs');

 
const WINDOW_LABELS = { window5h: '5h', weekly: '周', quota: '额度' };

 
const TOAST_TEXT = {
  urgent: (display) => display + ' 能量告急，请考虑收尾换手',
  critical: (display) => display + ' 即将耗尽，不建议继续派发新任务',
  recover: (display) => display + ' 能量恢复，可以重新接单',
  digest: (count) => count + ' 条通道额度告急，建议检查任务并准备换手',
  digestRecover: (count) => count + ' 条通道额度恢复，可以重新接单',
};

 
const AUTO_CLOSE_MS = { alert: 12000, recover: 8000 };

 
const LEVEL_ORDER = { critical: 0, urgent: 1, recover: 2 };

function clamp01(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.min(1, Math.max(0, v));
}

 
function factLine(row) {
  const label = WINDOW_LABELS[row && row.window] || (row && row.window) || '额度';
  const rem = clamp01(row && row.remaining_fraction);
  const pct = rem === null ? '—' : Math.round(rem * 100);
  let resetText = '重置时间未知';
  const t = row && row.reset_at ? Date.parse(row.reset_at) : NaN;
  if (Number.isFinite(t)) {
    const d = new Date(t);
    resetText = '重置 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  return label + ' 剩余 ' + pct + '% · ' + resetText;
}

 
function routeRow(evItem, entry) {
  return {
    route: evItem.route,
    display: entry ? pairKey(entry.provider, entry.model) : evItem.route,
    level: evItem.type === 'recover' ? 'recover' : evItem.type,
    window: evItem.window,
    remaining_fraction: evItem.remaining_fraction == null ? null : evItem.remaining_fraction,
    reset_at: evItem.reset_at || null,
    facts: factLine(evItem),
  };
}

 
function createNotifier(opts) {
  const options = opts || {};
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const digestThreshold = Number.isInteger(options.digestThreshold) && options.digestThreshold > 0
    ? options.digestThreshold
    : 2;
  let seq = 0;
  let suppressedBySelection = 0;
  let suppressedMuted = 0;
  let produced = 0;
  let lastIngestAt = null;

   
  function mapRoute(nameMap, route) {
    if (!nameMap || !Array.isArray(nameMap.entries)) return null;
    return nameMap.entries.find((e) => e && e.route === route) || null;
  }

   
  function isSelected(entry, selection, route) {
    if (!entry || !selection) return false;
    const p = selection.provider == null ? '' : String(selection.provider);
    const m = selection.model == null ? '' : String(selection.model);
    if (!p || !m) return false;
    return entry.provider === p && entry.model === m;
  }

  function makeNotify(kind, display, rows, line) {
    seq += 1;
    return {
      id: 'q' + String(seq),
      kind,
      display: display || null,
      routes: rows,
      line: line || '',
      autoCloseMs: kind === 'recover' ? AUTO_CLOSE_MS.recover : AUTO_CLOSE_MS.alert,
      at: now(),
    };
  }

  return {
     
    ingest(input) {
      const data = input || {};
      const events = Array.isArray(data.events) ? data.events : [];
      const selection = data.selection || null;
      const nameMap = data.nameMap || null;
      lastIngestAt = now();
      const alerts = []; 
      const recovers = []; 

      for (const evItem of events) {
        if (!evItem || typeof evItem !== 'object') continue;
        if (evItem.speak !== true) {
          suppressedMuted += 1; 
          continue;
        }
        const entry = mapRoute(nameMap, evItem.route);
        if (isSelected(entry, selection, evItem.route)) {
          suppressedBySelection += 1; 
          continue;
        }
        const row = routeRow(evItem, entry);
        if (evItem.type === 'recover') {
          recovers.push(row);
        } else if (evItem.type === 'urgent' || evItem.type === 'critical') {
          alerts.push(row);
        }
        
      }

      
      
      const mergeGroups = (rows) => {
        const groups = new Map();
        for (const row of rows) {
          const entry = mapRoute(nameMap, row.route);
          const key = (entry ? 'acct:' + entry.provider : 'route:' + row.route) + '|' + row.window;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(row);
        }
        return Array.from(groups.values());
      };
      
      
      
      const groupNotify = (group, kindOf) => {
        const sorted = group.slice().sort((a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9));
        const entry = mapRoute(nameMap, sorted[0].route);
        const display = sorted.length > 1 && entry ? entry.provider : sorted[0].display;
        const kind = kindOf === 'recover' ? 'recover' : sorted[0].level;
        return makeNotify(kind, display, sorted, TOAST_TEXT[kind === 'recover' ? 'recover' : kind](display));
      };

      const alertNotifies = [];
      for (const group of mergeGroups(alerts)) alertNotifies.push(groupNotify(group, 'alert'));
      const recoverNotifies = [];
      for (const group of mergeGroups(recovers)) recoverNotifies.push(groupNotify(group, 'recover'));

      
      const notifications = [];
      const toDigest = (rows, severity) => {
        const sorted = rows.slice().sort((a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9));
        seq += 1;
        notifications.push({
          id: 'q' + String(seq),
          kind: 'digest',
          display: null,
          routes: sorted,
          line: severity === 'recover' ? TOAST_TEXT.digestRecover(sorted.length) : TOAST_TEXT.digest(sorted.length),
          autoCloseMs: severity === 'recover' ? AUTO_CLOSE_MS.recover : AUTO_CLOSE_MS.alert,
          at: now(),
        });
      };

      
      if (alertNotifies.length >= digestThreshold) {
        toDigest(alertNotifies.flatMap((n) => n.routes), 'alert');
      } else {
        notifications.push(...alertNotifies);
      }
      if (recoverNotifies.length >= digestThreshold) {
        toDigest(recoverNotifies.flatMap((n) => n.routes), 'recover');
      } else {
        notifications.push(...recoverNotifies);
      }
      produced += notifications.length;
      return notifications;
    },

     
    reset() {
      seq = 0;
      suppressedBySelection = 0;
      suppressedMuted = 0;
      produced = 0;
      lastIngestAt = null;
    },

     
    state() {
      return {
        digestThreshold,
        suppressedBySelection,
        suppressedMuted,
        produced,
        lastIngestAt,
      };
    },
  };
}

 
function liveOverlayFor(selection, evaluated, nameMap, nowMs) {
  if (!selection || !evaluated || !evaluated.routes || typeof evaluated.routes !== 'object') return null;
  const entries = nameMap && Array.isArray(nameMap.entries) ? nameMap.entries : [];
  const entry = entries.find((e) => {
    if (!e) return false;
    const p = selection.provider == null ? '' : String(selection.provider);
    const m = selection.model == null ? '' : String(selection.model);
    return e.provider === p && e.model === m && e.route;
  });
  const route = entry ? entry.route : null;
  const rs = route ? evaluated.routes[route] : null;
  if (!rs || !rs.windows) return { unknown: true };

  const windows = [];
  const pushWindow = (kind, label, w) => {
    if (!w || w.level === 'unknown' || w.level === 'na') return;
    const used = clamp01(w.used_fraction);
    if (used === null) return;
    let reset = null;
    const t = w.reset_at ? Date.parse(w.reset_at) : NaN;
    if (Number.isFinite(t) && Number.isFinite(nowMs)) reset = Math.round((t - nowMs) / 60000);
    windows.push({ k: label, used: Math.round(used * 100), reset });
  };
  for (const kind of ['window5h', 'weekly']) {
    pushWindow(kind, WINDOW_LABELS[kind], rs.windows[kind]);
  }
  if (windows.length === 0) {
    
    pushWindow('quota', WINDOW_LABELS.quota, rs.windows.quota);
  }
  if (windows.length === 0) return { unknown: true };
  return { windows };
}

const notifier = {
  WINDOW_LABELS,
  TOAST_TEXT,
  AUTO_CLOSE_MS,
  factLine,
  createNotifier,
  liveOverlayFor,
};

module.exports = notifier;
