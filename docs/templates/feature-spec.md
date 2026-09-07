# Feature: <Module name>

**Status:** draft | accepted | implemented
**Spec reviewed:** YYYY-MM-DD (last human or agent review of this text)
**Implementation verified:** YYYY-MM-DD or "not yet" (date the module audit last passed)
**Owner module:** `src/modules/<name>`

## Purpose

## Concepts and vocabulary

## Data model

Tables and columns (link to 03), invariants as numbered `<MOD>-I<nn>` rules with the constraint that enforces each (service, trigger, unique index).

## Behaviors

Numbered `<MOD>-B<nn>` rules. Each testable. Include transitions, computed fields, ordering rules, delete/restore/archive, concurrency, links.

## API

Endpoints, params, responses, module-specific error details, idempotency, invalidation map.

## UI

List, detail, create, mobile, shortcuts.

## AI (if any)

## i18n notes

## Acceptance criteria

Numbered `<MOD>-A<nn>`, observable from outside, each with locales required.

## Required scenarios

Per layer, named by ID. Mutation-test targets (three critical functions).

## Audit items

## Out of scope
