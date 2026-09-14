'use client';
import dynamic from 'next/dynamic';
export const OwnerTasks = dynamic(() => import('./OwnerTasks').then((module) => module.OwnerTasks));
export const CommitteeTasks = dynamic(() => import('./CommitteeTasks').then((module) => module.CommitteeTasks));
export { useTaskMutations, useTasks } from './queries';
