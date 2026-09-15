import type { ClientManifest } from '@/core/modules/manifest';
// ACCT-B08: the account is reachable from the avatar menu and nowhere else. It declares no nav
// entry on purpose — it is a destination a reader visits rarely, not a module beside Tasks.
export const manifest: ClientManifest = { id: 'account' };
