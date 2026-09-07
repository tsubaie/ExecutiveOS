import 'server-only';
// WI-0001 proposal only: no migration has been generated or applied; see HANDOFF.md.
import {
  pgTable,
  text,
  uuid,
  integer,
  boolean,
  timestamp,
  jsonb,
  bigint,
  uniqueIndex,
  index,
  primaryKey,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const time = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
export const workspace = pgTable('workspace', {
  id: integer().primaryKey().default(1),
  setupCompletedAt: time('setup_completed_at'),
  setupTokenHash: text('setup_token_hash'),
  schemaVersion: integer('schema_version').notNull().default(1),
  maintenanceMode: boolean('maintenance_mode').notNull().default(false),
});
export const users = pgTable('users', {
  id: uuid().primaryKey(),
  email: text().notNull().unique(),
  name: text().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  revision: integer().notNull().default(1),
  lastLoginAt: time('last_login_at'),
  passwordChangedAt: time('password_changed_at'),
  createdAt: time('created_at').notNull().defaultNow(),
  updatedAt: time('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  deletedAt: time('deleted_at'),
  deletedOpId: uuid('deleted_op_id'),
});
export const sessions = pgTable(
  'sessions',
  {
    id: uuid().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    issuedAt: time('issued_at').notNull(),
    lastSeenAt: time('last_seen_at').notNull(),
    expiresAt: time('expires_at').notNull(),
    absoluteExpiresAt: time('absolute_expires_at').notNull(),
    ip: text(),
    userAgent: text('user_agent'),
    revokedAt: time('revoked_at'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: uuid().primaryKey(),
    email: text().notNull(),
    ip: text().notNull(),
    succeeded: boolean().notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('login_email_time_idx').on(t.email, t.createdAt),
    index('login_ip_time_idx').on(t.ip, t.createdAt),
  ],
);
export const recoveryTokens = pgTable('recovery_token_uses', {
  tokenHash: text('token_hash').primaryKey(),
  usedAt: time('used_at').notNull().defaultNow(),
});
export const settings = pgTable(
  'settings',
  {
    key: text().notNull(),
    scope: text().notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    value: jsonb().notNull(),
    updatedBy: uuid('updated_by').references(() => users.id),
    updatedAt: time('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'settings_scope_owner_check',
      sql`(${t.scope} = 'workspace' and ${t.userId} is null) or (${t.scope} = 'user' and ${t.userId} is not null)`,
    ),
    uniqueIndex('settings_scope_key').on(
      t.key,
      t.scope,
      sql`coalesce(${t.userId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
    index('settings_user_idx').on(t.userId),
    index('settings_actor_idx').on(t.updatedBy),
  ],
);
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: text().notNull(),
    userId: uuid('user_id').notNull(),
    requestHash: text('request_hash').notNull(),
    status: integer().notNull(),
    body: jsonb().notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);
export const jobs = pgTable(
  'jobs',
  {
    id: uuid().primaryKey(),
    kind: text().notNull(),
    dedupKey: text('dedup_key'),
    payload: jsonb().notNull(),
    status: text().notNull().default('queued'),
    priority: integer().notNull().default(0),
    attempt: integer().notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    runAfter: time('run_after').notNull().defaultNow(),
    deadlineAt: time('deadline_at'),
    leaseOwner: text('lease_owner'),
    leaseExpiresAt: time('lease_expires_at'),
    cancelRequested: boolean('cancel_requested').notNull().default(false),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    result: jsonb(),
    lastError: text('last_error'),
    createdBy: uuid('created_by'),
    createdAt: time('created_at').notNull().defaultNow(),
    startedAt: time('started_at'),
    finishedAt: time('finished_at'),
  },
  (t) => [
    uniqueIndex('jobs_active_dedup')
      .on(t.dedupKey)
      .where(sql`${t.status} in ('queued','running')`),
    index('jobs_claim_idx').on(t.status, t.runAfter, t.priority),
    index('jobs_kind_idx').on(t.kind, t.status),
    index('jobs_entity_idx').on(t.entityType, t.entityId),
  ],
);
export const jobAttempts = pgTable(
  'job_attempts',
  {
    id: uuid().primaryKey(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    attempt: integer().notNull(),
    leaseOwner: text('lease_owner').notNull(),
    startedAt: time('started_at').notNull().defaultNow(),
    finishedAt: time('finished_at'),
    status: text().notNull(),
    error: text(),
  },
  (t) => [uniqueIndex('job_attempt_unique').on(t.jobId, t.attempt)],
);
export const schedules = pgTable('schedules', {
  id: uuid().primaryKey(),
  kind: text().notNull(),
  cron: text().notNull(),
  timezone: text().notNull(),
  payload: jsonb().notNull(),
  enabled: boolean().notNull().default(true),
  lastOccurrence: time('last_occurrence'),
  createdAt: time('created_at').notNull().defaultNow(),
  updatedAt: time('updated_at').notNull().defaultNow(),
});
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid().primaryKey(),
    actorId: uuid('actor_id'),
    action: text().notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    opId: uuid('op_id'),
    diff: jsonb().notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('audit_entity_idx').on(t.entityType, t.entityId),
    index('audit_actor_idx').on(t.actorId),
    index('audit_time_idx').on(t.createdAt),
  ],
);
export const files = pgTable('files', {
  id: uuid().primaryKey(),
  storageKey: text('storage_key').notNull().unique(),
  originalName: text('original_name').notNull(),
  mime: text().notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  sha256: text().notNull(),
  pageCount: integer('page_count'),
  availability: text().notNull().default('available'),
  purgedAt: time('purged_at'),
  uploadedBy: uuid('uploaded_by'),
  createdAt: time('created_at').notNull().defaultNow(),
});
export const aiInvocations = pgTable(
  'ai_invocations',
  {
    id: uuid().primaryKey(),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    capability: text().notNull(),
    capabilityVersion: integer('capability_version').notNull(),
    requestedModel: text('requested_model').notNull(),
    effectiveModel: text('effective_model'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
    cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
    latencyMs: integer('latency_ms'),
    status: text().notNull(),
    error: text(),
    estimatedCostMicros: bigint('estimated_cost_micros', { mode: 'number' }),
    pricingVersion: text('pricing_version'),
    createdBy: uuid('created_by'),
    createdAt: time('created_at').notNull().defaultNow(),
  },
  (t) => [index('ai_invocations_job_idx').on(t.jobId)],
);
