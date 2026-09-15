// NOTIF-B10: how long a notification survives. These are constants rather than settings registry
// keys on purpose (ADR 0022): a feed nobody has asked to tune is not worth a key, and the audit
// log is the surface that answers questions about the past.
export const retention = { readDays: 30, unreadDays: 180 };
