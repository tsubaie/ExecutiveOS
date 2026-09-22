'use client';
import dynamic from 'next/dynamic';
export const PersonNotes = dynamic(() => import('./PersonNotes').then((module) => module.PersonNotes));
export const CommitteeNotes = dynamic(() => import('./CommitteeNotes').then((module) => module.CommitteeNotes));
export const NoteTypesAdmin = dynamic(() => import('./NoteTypesAdmin').then((module) => module.NoteTypesAdmin));
export const NoteTemplatesAdmin = dynamic(() => import('./NoteTemplatesAdmin').then((module) => module.NoteTemplatesAdmin));
export const TagsAdmin = dynamic(() => import('./TagsAdmin').then((module) => module.TagsAdmin));
