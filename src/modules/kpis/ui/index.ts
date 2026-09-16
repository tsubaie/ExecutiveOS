'use client';
import dynamic from 'next/dynamic';
export const ObjectivesAdmin = dynamic(() =>
  import('./ObjectivesAdmin').then((module) => module.ObjectivesAdmin),
);
// Home prints a KPI's state in the scorecard's own words and tone rather than keeping a second
// vocabulary for the same six states.
export { useKpiLabels } from './use-kpi-labels';
