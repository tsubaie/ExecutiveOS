'use client';
import dynamic from 'next/dynamic';
export const ObjectivesAdmin = dynamic(() =>
  import('./ObjectivesAdmin').then((module) => module.ObjectivesAdmin),
);
