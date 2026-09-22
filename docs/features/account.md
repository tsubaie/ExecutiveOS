# Feature: Account

**Status:** accepted
**Spec reviewed:** 2026-09-15
**Implementation verified:** not yet
**Owner module:** `src/modules/account`

## Purpose

Everything that is the reader's own rather than the workspace's: who they are, how they sign in,
and how the product behaves for them. It is the counterpart of Administration, which owns what is
everyone's.

**The name.** Not "Profile". ADR 0011 makes a **Person** the single identity for task owners and
attendees, and every member has one. A reader with both a Person and a Profile would have two
things called their identity and would have to guess which to edit. "Account" is unambiguously the
login-and-preferences object, and **Account / Administration** reads as a pair — yours and
everyone's — without the word "settings" appearing twice in the navigation. In Arabic, الحساب and
الإدارة pair the same way.

## Concepts and vocabulary

- **Account** — the `users` row plus the user-scoped `settings` rows for that user.
- **Linked person** — the `people` row whose `user_id` is this user (ADR 0011). It carries the
  directory-facing facts: organisation, role title, phone. The account does not duplicate them.
- **Workspace setting** — a `settings` row with `scope = 'workspace'`. Administration owns these
  and the account page never writes one.

## Data model

No new tables. The account is a view over two that exist:

- `users` — `name`, `email`, `password_hash`, `role`, `is_active`, `last_login_at`,
  `password_changed_at`. Role and active state are **not** editable here; they are Administration's
  (`features/admin.md`).
- `settings` — rows with `scope = 'user'` and `user_id = me`. The table already carries the scope
  split and a check constraint pairing `scope` with `user_id`, so per-user preference storage
  exists and is used as-is.
- `sessions` — listed and revocable (ADR 0005).
- `people` — read to show the linked person and to deep-link to their directory record.

- ACCT-I01 Every write is scoped to `ctx.user.id`. No endpoint in this module takes a user id.
- ACCT-I02 The account cannot change `role` or `is_active`. An administrator demoting themselves is
  Administration's problem and its confirmation.
- ACCT-I03 Preference precedence is unchanged (`05`): `user.locale` → `workspace.default_locale`,
  `user.timezone` → `workspace.timezone`, `user.numerals` → `workspace.arabic_numerals`. The
  account page sets the user side; "Use the workspace default" clears the row rather than copying
  the current value, so a later workspace change still reaches the reader.

## Behaviors

- ACCT-B01 **Name and email.** Both editable. Email is lowercased (the `users_email_lower_check`
  constraint) and must stay unique; taking an address another account holds fails with a field
  error on `email`. Changing an email does not re-verify it: there is no mail transport (`01`).
- ACCT-B02 **Password.** Changing it requires the current password, and the new one is validated by
  the same `Password` schema registration uses. On success every **other** session is revoked and
  the current one is kept, and `password_changed_at` is set. A reader changing their password
  should not be signed out of the tab they changed it in, and should be signed out everywhere else.
- ACCT-B03 **Sessions.** The reader sees their active sessions with last-seen time, IP and user
  agent (the columns `sessions` already carries), the current one marked. Any other session can be
  revoked individually, and "Sign out everywhere else" revokes all of them.
- ACCT-B04 **Preferences.** Theme, locale, numerals and timezone, each as a user-scoped setting
  with an explicit "workspace default" option (ACCT-I03). These are the same values the header's
  theme and locale toggles write; both paths write the same rows.
- ACCT-B05 **The linked person** is shown, not edited: name, organisation, role title, with a link
  to the People record. A reader whose account has no linked person is told so, because it is why
  work cannot be assigned to them.
- ACCT-B06 **Saving** follows the framework: a field saves on blur through the auto-save queue for
  name and preferences; email and password are explicit forms with a submit, because both have
  consequences the reader should confirm by acting.
- ACCT-B07 **Deleting your own account is not possible here.** It is Administration's, and the last
  administrator cannot be removed (`features/admin.md`).
- ACCT-B08 The page is reachable at `/account` from the avatar menu and nowhere else in the nav; it
  is a destination a reader visits rarely and not a module.
- ACCT-B09 **The login cookie slides with the session.** Each API request that extends the session's database expiry (at most once a minute) re-issues the session cookie with exactly the remaining lifetime, never past the 90-day absolute expiry. The browser therefore keeps an active reader signed in instead of dropping the cookie 30 days after sign-in. Page renders read the session without extending it, because a server-rendered page cannot set cookies; the API requests every page makes do the extending.

## API

- `GET /api/v1/account` → `{ data: { user, person, preferences, sessions } }`
- `PATCH /api/v1/account` → name and preferences; `revision` for concurrency (`04`).
- `POST /api/v1/account/email` → `{ email }`, field errors on conflict.
- `POST /api/v1/account/password` → `{ current, next }`; revokes other sessions.
- `DELETE /api/v1/account/sessions/:id` and `POST /api/v1/account/sessions/revoke-others`.

All writes take an `Idempotency-Key`. Invalidation: `["account"]`, plus `["session"]` for the
password and session routes.

## UI

- **The avatar menu** in the shell header: the reader's initials or their person's avatar, opening
  a menu with their name and email as a non-interactive header, then Account, theme, locale, and
  Sign out. Administration stays in the sidebar where it is: it is a place, not a personal action.
- **`/account`** is a plain settings page, not an entity page — it has one record and no list. It
  uses `AdminLayout`'s section shape so that Account and Administration read the same way, with
  sections: Identity, Sign-in, Sessions, Preferences.
- Destructive-ish actions (revoke a session, sign out everywhere) confirm, naming what is affected.
- Mobile: the avatar menu is a sheet; `/account` is a full page reachable from it.

## i18n notes

- Strings under `account.*`; the module label is `account.title` and is the same word used in the
  avatar menu and the page heading.
- User agent strings are opaque identifiers and render with `translate="no"` and `dir="ltr"`.
- Session times are relative in the list and absolute on hover (`05`).

## Acceptance criteria

- ACCT-A01 Change the display name; it appears in the avatar menu and the sidebar identity without
  a reload. (en, ar)
- ACCT-A02 Change the password with the correct current password: the current session survives, a
  second browser's session is signed out. A wrong current password reports on that field. (en)
- ACCT-A03 Set locale to Arabic from `/account`; the app switches and the header toggle agrees.
  Then choose "workspace default" and the row is removed, not overwritten. (en, ar)
- ACCT-A04 A member cannot reach another account's data or change their own role through the API.
  (en)
- ACCT-A05 An account with no linked person says so and links to People. (en, ar)

## Required scenarios

- `src/modules/account/tests/service.test.ts`: B01 email uniqueness and lowercasing; B02 the
  current-password check, the other-sessions revocation and the current session surviving;
  ACCT-I02 role and active state rejected if supplied.
- `tests/preferences.test.ts`: B04 and ACCT-I03 — clearing a preference removes the row and
  precedence falls back to the workspace.
- `tests/sessions.test.ts`: B03 revoking one, revoking others, the current one marked.
- `tests/api.test.ts`: ACCT-I01 no endpoint takes a user id; A04 isolation.
- e2e `account.spec.ts`: A01, A02, A03 in both locales.
- Mutation targets: `changePassword`, `setPreference`, `updateAccount`.

## Audit items

- No endpoint in `src/modules/account` accepts a user id parameter.
- The module writes no `settings` row with `scope = 'workspace'`.
- `role` and `is_active` do not appear in any account validation schema.

## Out of scope

- Email verification and password reset by mail (no mail transport in v1; recovery is `features/admin.md`).
- Two-factor authentication, passkeys, OAuth.
- Avatar upload — the avatar is initials, or the linked person's, per `PersonAvatar`.
- Notification preferences (`features/notifications.md` ships no per-kind mute).
- Deleting or deactivating your own account (ACCT-B07).
