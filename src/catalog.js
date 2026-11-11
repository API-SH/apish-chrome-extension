// The endpoint catalog, read live from the API's public /catalog so new platforms, endpoints and prices show up
// without a new extension version. Only data (JSON) is fetched, never code. Cached in chrome.storage.local for an
// hour; when the API can't be reached the last cached copy is used, and with none the bundled src/endpoints.json.
// Shapes use the bundled list's short keys: platform {s, n, d, e}, endpoint {p, n, c, u}, parameter {k, r, d, e, o}.
export const API = 'https://api.api.sh';
const HOUR = 3600_000;

async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
const store = {
  get: async (k) => (await chrome.storage.local.get(k).catch(() => ({})))[k],
  set: (k, v) => chrome.storage.local.set({ [k]: v }).catch(() => {}),
};

let bundled = null;
export async function bundledList() {
  bundled ??= await (await fetch(chrome.runtime.getURL('src/endpoints.json'))).json();
  return bundled;
}

// Platforms and endpoints. Site domains (to recognise the page you're on) and the "takes a page URL" flag come from
// /catalog (domains, takes_url); for an older /catalog without them, from the bundled list for the platforms it knows; detect() in popup.js has a name-based
// fallback for platforms added later.
export async function loadPlatforms() {
  const local = await bundledList();
  let cat = await store.get('catalog');
  if (!cat || Date.now() - cat.at >= HOUR) {
    try {
      const j = await getJson(`${API}/catalog`);
      if (!Array.isArray(j.platforms) || !j.platforms.length) throw new Error('empty catalog');
      cat = { at: Date.now(), version: j.version, platforms: j.platforms };
      await store.set('catalog', cat);
    } catch { /* the stale copy, else the bundled list */ }
  }
  if (!cat) return { source: 'bundled', platforms: local };
  const bySlug = new Map(local.map((p) => [p.s, p]));
  const platforms = cat.platforms.filter((p) => p.endpoints?.length).map((p) => {
    const b = bySlug.get(p.slug);
    const takesUrl = new Map((b?.e || []).map((e) => [e.p, e.u]));
    return { s: p.slug, n: p.name, d: [...new Set([...(p.domains || []), ...(b?.d || [])])], e: p.endpoints.map((e) => ({ p: e.route, n: e.name, c: e.credits, u: typeof e.takes_url === 'boolean' ? e.takes_url : !!takesUrl.get(e.route) })) };
  });
  return { source: 'live', version: cat.version, platforms };
}

// One endpoint's parameters from /catalog?route= (cached an hour per endpoint); the bundled list as the fallback.
export async function loadParams(route) {
  const all = (await store.get('params')) || {};
  const hit = all[route];
  if (hit && Date.now() - hit.at < HOUR) return hit.q;
  try {
    const j = await getJson(`${API}/catalog?route=${encodeURIComponent(route)}`);
    const q = (j.endpoint?.params || []).map((x) => ({
      k: x.name, r: !!x.required, d: x.description || '', e: x.example == null ? '' : String(x.example),
      o: Array.isArray(x.enum) && x.enum.length ? x.enum.map(String) : null,
    }));
    const now = Date.now();
    for (const [k, v] of Object.entries(all)) if (now - v.at >= HOUR) delete all[k]; // keep the store small
    all[route] = { at: now, q };
    await store.set('params', all);
    return q;
  } catch {
    if (hit) return hit.q;
    for (const p of await bundledList()) for (const e of p.e || []) if (e.p === route) return e.q || [];
    return [];
  }
}
