import { assertPromptsRequest } from "../../../features/notes/src/adapters/codex/requests.mjs";
import { readConfig } from '../../cli/src/config.mjs';

export function createPromptsClient({ paths, port = 47832, fetchImpl = fetch }) {
  return { async request(route, method = 'GET', body) {
    assertPromptsRequest(route, method);
    if (!(await readConfig(paths.configPath)).features.notes) throw new Error('Enable Prompts in MineCodex first');
    const response = await fetchImpl(`http://127.0.0.1:${port}${route}`, {
      method, headers: {Origin:'app://-', 'Content-Type':'application/json'},
      ...(body !== undefined ? {body:JSON.stringify(body)} : {}), redirect:'error', signal:AbortSignal.timeout(8000),
    });
    const result = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new Error(result?.error?.message ?? 'Prompts service unavailable');
    return result;
  } };
}
