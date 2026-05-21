import { handlers } from '@/lib/auth';

// Auth.js v5 catch-all route handler.
// Handles all /api/auth/* endpoints: signin, signout, callback, session, csrf.
export const { GET, POST } = handlers;
