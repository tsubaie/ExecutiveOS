import 'server-only';
import type { Context } from '@/core/auth/session';
import type { JobHandler } from '@/core/jobs/types';
// Server contribution of a module: home sections and job kinds, composed by core/modules/registry.
export type HomeSectionItem = { id: string; title: string; href: string };
export type HomeSection = {
  key: string;
  enabled: boolean;
  count: number;
  items: HomeSectionItem[];
  href: string | null;
};
export type ServerManifest = {
  id: string;
  homeSummary?: (ctx: Context) => Promise<HomeSection[]>;
  jobs?: Record<string, JobHandler>;
};
