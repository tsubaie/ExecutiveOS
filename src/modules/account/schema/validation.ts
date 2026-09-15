import { z } from 'zod';
import { Password } from '@/core/http/user-schema';
import { Locale } from '@/core/config/defaults';
import { Theme, Timezone } from '@/core/config/settings';
// ACCT-I02: role and active state are Administration's. They are absent from every schema here,
// which is what the module audit checks — a field that cannot be named cannot be smuggled through
// a patch.
export const Numerals = z.enum(['western', 'arabic']);
// "" means "use the workspace default" and clears the row rather than copying today's value
// (ACCT-I03).
const inherited = <S extends z.ZodType>(schema: S) => z.union([schema, z.literal('')]);
export const AccountPatch = z.strictObject({
  revision: z.number().int().positive(),
  name: z.string().trim().min(1).max(200).optional(),
  locale: inherited(Locale).optional(),
  timezone: inherited(Timezone).optional(),
  theme: inherited(Theme).optional(),
  numerals: inherited(Numerals).optional(),
});
export const EmailChange = z.strictObject({
  revision: z.number().int().positive(),
  email: z.email().max(320).transform((value) => value.toLowerCase()),
});
export const PasswordChange = z.strictObject({
  current: z.string().min(1).max(256),
  next: Password,
});
export const AccountSession = z.object({
  id: z.uuid(),
  current: z.boolean(),
  issuedAt: z.string(),
  lastSeenAt: z.string(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
});
// The real unions rather than `string`: the response then carries the same types the patch accepts,
// so a control can be checked against its own key without a cast standing in for the check.
export const AccountPreferences = z.object({
  locale: Locale,
  timezone: Timezone,
  theme: Theme,
  numerals: Numerals,
  // Which of them the reader has actually set; the rest are inherited (ACCT-I03).
  explicit: z.array(z.enum(['locale', 'timezone', 'theme', 'numerals'])),
});
export const AccountPerson = z.object({
  id: z.uuid(),
  fullName: z.string(),
  organization: z.string().nullable(),
  roleTitle: z.string().nullable(),
});
export const Account = z.object({
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    revision: z.number(),
    passwordChangedAt: z.string().nullable(),
  }),
  person: AccountPerson.nullable(),
  preferences: AccountPreferences,
  sessions: z.array(AccountSession),
});
export type Account = z.infer<typeof Account>;
export type AccountSession = z.infer<typeof AccountSession>;
export type AccountPatch = z.infer<typeof AccountPatch>;
