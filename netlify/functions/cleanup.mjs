// Netlify Scheduled Function: daily clean-up of old drafts and expired gifts (03:30 UTC = 09:00 IST).
import { runCleanup } from '../../server/router.js';

export default async () => {
  const deleted = await runCleanup();
  console.log(`clean-up: deleted ${deleted} gift(s)`);
};

export const config = { schedule: '30 3 * * *' };
