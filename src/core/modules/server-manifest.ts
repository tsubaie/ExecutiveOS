import 'server-only';
import type { Context } from '@/core/auth/session';
import type { JobHandler } from '@/core/jobs/types';
// Server contribution of a module: home sections and job kinds, composed by core/modules/registry.
// HOME-B01: a row carries the few facts the principal triages on. Every fact is optional because
// each section answers a different question; the page renders only what a section supplies.
export type HomeSectionItem = {
  id: string;
  title: string;
  href: string;
  date?: string | null;
  owner?: string | null;
  committee?: string | null;
  count?: number | null;
  // Present when the row can be acted on in place; the mutation needs the concurrency token.
  revision?: number | null;
  // How much of `count` is already overdue, where the row aggregates other work.
  overdue?: number | null;
};
export type HomeSection = {
  key: string;
  enabled: boolean;
  count: number;
  items: HomeSectionItem[];
  href: string | null;
  // HOME-B09: how many of `count` are past the stale threshold, for sections that age. It answers
  // whether a pile is a backlog or a crisis, which a bare total cannot.
  stale?: number | null;
};
export type ServerManifest = {
  id: string;
  homeSummary?: (ctx: Context) => Promise<HomeSection[]>;
  jobs?: Record<string, JobHandler>;
};
