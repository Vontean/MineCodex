export function assertPromptsRequest(route, method = 'GET') {
  const allowed = (route === '/api/state' && method === 'GET')
    || (['/api/prompts', '/api/categories', '/api/reorder'].includes(route) && method === 'POST')
    || (/^\/api\/(prompts|categories)\/[a-zA-Z0-9-]+$/.test(route) && ['PATCH','DELETE'].includes(method))
    || (/^\/api\/prompts\/[a-zA-Z0-9-]+\/use$/.test(route) && method === 'POST');
  if (!allowed) throw new Error('Unsupported Prompts operation');
}
