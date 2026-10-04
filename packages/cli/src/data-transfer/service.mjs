import path from 'node:path';
import { promptsTransfer } from '../../../../features/notes/src/backend/transfer.mjs';
import { sitesTransfer } from '../../../../features/sites/src/backend/transfer.mjs';

import { favoritesTransfer } from '../../../../features/model-slider/src/backend/favorites.mjs';
import { FEATURE_IDS } from '../config.mjs';

export const MAX_TRANSFER_BYTES = 16 * 1024 * 1024;
export function createDataTransfer({ paths, version, adapters = [
  promptsTransfer(process.env.CODEX_NOTES_DATABASE || path.join(paths.notesDataDir, 'codex-notes.sqlite')),
  sitesTransfer(process.env.MINECODEX_SITES_DATA_DIR || path.join(paths.supportDir, 'sites')),
  favoritesTransfer(process.env.MINECODEX_MODEL_DATA_FILE || path.join(paths.supportDir, 'model-slider', 'favorites.sqlite')),
] }) {
  const registry = new Map(adapters.map(adapter => [adapter.id, adapter]));
  function validate(bundle) {
    if (!bundle || bundle.format !== 'minecodex-data' || bundle.version !== 1 || !bundle.features || typeof bundle.features !== 'object' || Array.isArray(bundle.features)) throw Object.assign(new Error('Unsupported MineCodex data file'), { statusCode: 400 });
    try {
      return Object.entries(bundle.features).map(([id, data]) => {
        if (!registry.has(id)) throw new Error(`Unsupported feature: ${id}`);
        return [id, registry.get(id).validate(data)];
      });
    } catch (error) { throw Object.assign(error, { statusCode: 400 }); }
  }
  return {
    async inventory() { return { features: await Promise.all(FEATURE_IDS.map(async id => { const adapter = registry.get(id); if (!adapter) return { id, portable: false }; const { data, ...counts } = await adapter.snapshot(); return { id, portable: true, ...counts }; })) }; },
    async export() {
      const bundle = { format: 'minecodex-data', version: 1, appVersion: version, exportedAt: new Date().toISOString(), features: Object.fromEntries(await Promise.all(adapters.map(async adapter => [adapter.id, (await adapter.snapshot()).data]))) };
      if (Buffer.byteLength(JSON.stringify(bundle, null, 2)) > MAX_TRANSFER_BYTES) throw Object.assign(new Error('Data file exceeds 16 MB'), { statusCode: 413 });
      return bundle;
    },
    async preview(bundle) { return { features: await Promise.all(validate(bundle).map(async ([id, data]) => ({ id, ...await registry.get(id).preview(data) }))) }; },
    async import(bundle) {
      const entries = validate(bundle), results = [];
      // 各领域独立提交；失败时保留已完成结果，重试依靠幂等合并。
      for (const [id, data] of entries) {
        try { results.push({ id, status: 'imported', ...await registry.get(id).apply(data) }); }
        catch { results.push({ id, status: 'failed' }); }
      }
      return { complete: results.every(result => result.status === 'imported'), features: results };
    },
  };
}
