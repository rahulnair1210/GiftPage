// Vercel Function. vercel.json rewrites every /api/* request here with ?path=<rest of the path>.
import { handle } from '../server/router.js';

export default { fetch: handle };
