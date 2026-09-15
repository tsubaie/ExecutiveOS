import 'server-only';
import type { Database } from '@/core/db/client';
import { deleteExpired } from '@/core/db/notifications-repo';
import { retention } from '@/core/config/notifications';
// NOTIF-B10: the two windows, from config rather than the settings registry — a feed nobody has
// asked to tune is not worth a key, and the audit log is what answers questions about the past.
export async function purgeExpired(database: Database, now = new Date()) {
  const day = 86_400_000;
  return deleteExpired(
    database,
    new Date(now.getTime() - retention.readDays * day),
    new Date(now.getTime() - retention.unreadDays * day),
  );
}
