import { router } from '../api.js';
const m = router.match('POST', '/api/demo/seed');
const out = await m.handler({ params: {}, query: {}, body: {} });
console.log(`Seeded demo portfolio #${out.portfolioId} with ${out.vendorIds.length} fictional vendors.`);
