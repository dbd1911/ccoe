import * as store from './store.js';

export function audit(action, detail) {
  const id = store.nextId('audit');
  store.put('audit', id, { id, ts: new Date().toISOString().slice(0, 19).replace('T', ' '), action, detail: typeof detail === 'string' ? detail : JSON.stringify(detail ?? null) });
  // Keep the log bounded in the browser.
  if (id > 2000) for (const a of store.all('audit')) if (a.id <= id - 2000) store.del('audit', a.id);
}
