import { SitesService } from './sites-service.mjs';
import { normalizeSite, isLocalAddress } from '../domain/site.mjs';

function portable(row) {
  if (!row.url) return null;
  const site = normalizeSite({ title: row.title, url: row.url, origin: { kind: 'external' } });
  if (isLocalAddress(new URL(site.url).hostname) || new URL(site.url).hostname === '0.0.0.0' || new URL(site.url).hostname === '[::]') return null;
  return { id: row.id, title: site.title, url: site.url };
}
export function validateSites(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.sites) || data.sites.length > 50000) throw new Error('Unsupported Sites data');
  const ids = new Set();
  return { version: 1, sites: data.sites.map(row => {
    if (!row || typeof row.id !== 'string' || !row.id || row.id.length > 256 || ids.has(row.id) || typeof row.title !== 'string' || row.title.length > 160 || typeof row.url !== 'string' || row.url.length > 8192) throw new Error('Invalid Site record');
    const clean = portable(row);
    if (!clean) throw new Error('Local URLs cannot be transferred');
    ids.add(row.id); return clean;
  }) };
}
function merge(sites, incoming) {
  const result = { added: 0, duplicate: 0, conflict: 0 };
  const ids = new Map(sites.map(row => [row.id,row])), urls = new Set(sites.map(row => row.url));
  for (const row of incoming.sites) {
    const match = ids.get(row.id);
    if (match) result[match.url === row.url && match.title === row.title ? 'duplicate' : 'conflict']++;
    else if (urls.has(row.url)) result.duplicate++;
    else {
      result.added++;
      ids.set(row.id,row); urls.add(row.url);
      sites.push({ ...row, origin: { kind: 'external' }, hosting: 'self-hosted', createdAt: Date.now(), updatedAt: Date.now() });
    }
  }
  return result;
}
export function sitesTransfer(dataDir) {
  const service = new SitesService({ dataDir });
  return {
    id: 'sites', validate: validateSites,
    async snapshot() { const all = await service.read(), sites = all.map(portable).filter(Boolean); return { data: { version: 1, sites }, count: sites.length, excluded: all.length - sites.length }; },
    async preview(data) { return merge(await service.read(), data); },
    async apply(data) { return service.mutate(sites => merge(sites, data)); },
  };
}
