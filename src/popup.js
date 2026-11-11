import { API, loadPlatforms, loadParams } from './catalog.js';
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
// Platforms and endpoints with current credits, live from /catalog (cached an hour; bundled list as the fallback).
const CAT = await loadPlatforms();
const DATA = CAT.platforms;
// Free credits (and, only when on the bundled list, current prices) from the API's public /pricing, cached an hour.
const LIVE = await (async () => {
  const { live } = await chrome.storage.local.get('live').catch(() => ({}));
  if (live && Date.now() - live.at < 3600_000) return live;
  try {
    const j = await fetch(`${API}/pricing`, { signal: AbortSignal.timeout(3000) }).then((r) => r.json());
    const fresh = { at: Date.now(), prices: j.prices || {}, free: j.free_monthly_credits ?? null };
    await chrome.storage.local.set({ live: fresh }).catch(() => {});
    return fresh;
  } catch { return live || { prices: {}, free: null }; }
})();
if (CAT.source === 'bundled') for (const p of DATA) for (const e of p.e || []) if (typeof LIVE.prices[e.p] === 'number') e.c = LIVE.prices[e.p];
if (LIVE.free) { const f = document.getElementById('freecr'); if (f) f.textContent = `${LIVE.free.toLocaleString('en-US')} free credits every month`; }
const { apiKey = '', last = {} } = await chrome.storage.sync.get(['apiKey', 'last']);
let tabUrl = '';
try { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); tabUrl = tab?.url || ''; } catch {}

$('openOpts').onclick = () => chrome.runtime.openOptionsPage();
if (!apiKey) { $('nokey').classList.remove('hide'); } else { $('app').classList.remove('hide'); }

// Which platform is this page? Match the longest domain/path prefix.
function detect(url) {
  let u; try { u = new URL(url); } catch { return null; }
  const hp = (u.hostname.replace(/^www\./, '') + u.pathname).toLowerCase();
  let best = null, len = 0;
  for (const p of DATA) for (const d of p.d) {
    const dd = d.toLowerCase();
    if (!dd) continue;
    const host = dd.split('/')[0];
    const ok = (hp === dd || hp.startsWith(dd + '/') || hp.startsWith(dd)) || u.hostname.replace(/^www\./, '').endsWith('.' + host) && hp.includes(dd.slice(host.length));
    if (ok && dd.length > len) { best = p; len = dd.length; }
  }
  if (best) return best;
  // Platforms added after this version have no bundled domains: match the slug against the site's name
  // (home-depot -> homedepot.com, 1688 -> 1688.com).
  const labels = u.hostname.toLowerCase().split('.').slice(0, -1);
  return DATA.find((p) => !p.d.length && labels.includes(p.s.replace(/-/g, ''))) || null;
}
const detected = detect(tabUrl);
const plats = [...DATA].sort((a, b) => a.n.localeCompare(b.n));
$('plat').innerHTML = plats.map((p) => `<option value="${esc(p.s)}">${esc(p.n)}</option>`).join('');
$('plat').value = detected?.s || last.plat || 'tiktok';
if (!$('plat').value) $('plat').value = DATA.some((p) => p.s === 'tiktok') ? 'tiktok' : plats[0].s; // last pick was removed
const cur = () => DATA.find((p) => p.s === $('plat').value);

function fillEndpoints() {
  const p = cur();
  // URL-taking endpoints first when we are on that platform's page.
  const eps = [...p.e].sort((a, b) => (detected?.s === p.s ? (b.u - a.u) : 0));
  $('ep').innerHTML = eps.map((e) => `<option value="${esc(e.p)}">${esc(e.n)} · ${e.c ?? '?'} credit${e.c === 1 ? '' : 's'}${e.u && detected?.s === p.s ? ' · this page' : ''}</option>`).join('');
  if (last.plat === p.s && last.ep && p.e.some((e) => e.p === last.ep)) $('ep').value = last.ep;
  $('plogo').src = `https://api.sh/marketplace/${p.s}.png`;
  $('ptitle').textContent = p.n;
  $('pchip').textContent = detected?.s === p.s ? 'on this page' : `${p.e.length} endpoints`;
  fillParams();
}
let paramsSeq = 0;
async function fillParams() {
  const plat = cur(), e = plat.e.find((x) => x.p === $('ep').value);
  if (!e) { $('params').innerHTML = ''; return; }
  const seq = ++paramsSeq;
  $('run').disabled = true;
  const qs = await loadParams(e.p); // live from /catalog?route= (cached an hour), bundled list as the fallback
  if (seq !== paramsSeq) return; // another endpoint was picked meanwhile
  $('run').disabled = false;
  const saved = (last.ep === e.p && last.params) || {};
  $('params').innerHTML = qs.filter((q) => q.r || ['url', 'cursor', 'limit', 'country', 'sort'].includes(q.k)).map((q) => {
    let v = saved[q.k] ?? '';
    if (q.k === 'url' && detected?.s === plat.s) v = tabUrl;
    const ph = q.e || q.d || q.k;
    const input = q.o ? `<select data-k="${esc(q.k)}"><option value=""></option>${q.o.map((o) => `<option ${String(o) === String(v) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : `<input data-k="${esc(q.k)}" value="${esc(v)}" placeholder="${esc(String(ph).slice(0, 80))}">`;
    return `<label>${esc(q.k)}${q.r ? ' *' : ''}</label>${input}`;
  }).join('');
}
$('plat').onchange = fillEndpoints; $('ep').onchange = fillParams;
fillEndpoints();

let lastJson = null;
function params() { const o = {}; for (const el of $('params').querySelectorAll('[data-k]')) if (el.value.trim()) o[el.dataset.k] = el.value.trim(); return o; }
async function call(extra = {}) {
  const ep = $('ep').value; const p = { ...params(), ...extra };
  const u = new URL(API + ep); for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
  return fetch(u, { headers: { 'x-api-key': apiKey } });
}
$('run').onclick = async () => {
  const t0 = performance.now();
  $('run').disabled = true; $('status').className = 'small muted'; $('status').textContent = 'Fetching…';
  await chrome.storage.sync.set({ last: { plat: $('plat').value, ep: $('ep').value, params: params() } });
  try {
    const r = await call(); const j = await r.json().catch(() => ({ error: { message: 'The response was not JSON.' } }));
    lastJson = j; $('out').classList.remove('hide'); $('out').textContent = JSON.stringify(j, null, 2).slice(0, 200000);
    const ms = Math.round(performance.now() - t0);
    if (r.ok) { $('status').className = 'small ok'; $('status').textContent = (() => { const c = r.headers.get('x-credits-used') ?? j.credits_used ?? '?'; return `200 · ${ms < 1000 ? ms + ' ms' : (ms / 1000).toFixed(1) + ' s'} · ${c} credit${String(c) === '1' ? '' : 's'} used`; })(); }
    else { $('status').className = 'small err'; $('status').textContent = `${r.status} · ${j?.error?.message || j?.error || 'request failed'}`; }
    for (const b of ['copy', 'json', 'csv']) $(b).disabled = !r.ok;
  } catch (e) { $('status').className = 'small err'; $('status').textContent = 'Could not reach api.api.sh.'; }
  $('run').disabled = false;
};
function save(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
const fname = (ext) => `${$('plat').value}-${$('ep').value.split('/').pop()}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
$('copy').onclick = async () => { await navigator.clipboard.writeText(JSON.stringify(lastJson, null, 2)); $('status').textContent = 'Copied.'; };
$('json').onclick = () => save(fname('json'), new Blob([JSON.stringify(lastJson, null, 2)], { type: 'application/json' }));
$('csv').onclick = async () => {
  $('status').className = 'small muted'; $('status').textContent = 'Building CSV…';
  const r = await call({ output: 'csv' }); // the API turns the main list into CSV (served from cache when fresh)
  if (!r.ok) { $('status').className = 'small err'; $('status').textContent = `CSV failed (${r.status}).`; return; }
  save(fname('csv'), new Blob([await r.text()], { type: 'text/csv' })); $('status').className = 'small ok'; $('status').textContent = 'CSV saved.';
};
