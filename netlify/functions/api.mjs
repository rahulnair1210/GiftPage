// Netlify Function: serves every /api/* route with the same router Vercel and the dev server use.
import { handle } from '../../server/router.js';

export default async (request) => handle(request);

export const config = { path: '/api/*' };
