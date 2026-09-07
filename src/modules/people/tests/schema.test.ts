import { it, expect } from 'vitest';
import { PersonCreate } from '../schema/validation';
import { initials } from '../ui/initials';
import { normalize } from '@/core/search/normalize';
import { seedPeople } from '../../../../tests/fixtures/people';
it('PEOPLE-I01 full name is required and tags are deduplicated', () => {
  const fixture = {
    ...seedPeople[0],
    displayName: null,
    honorific: null,
    email: null,
    phone: null,
    notes: null,
    tags: ['Board', 'board'],
    userId: null,
  };
  expect(PersonCreate.parse(fixture).tags).toEqual(['Board']);
  expect(PersonCreate.safeParse({ ...fixture, fullName: ' ' }).success).toBe(false);
});
it('PEOPLE-A06 Arabic initials use the first letters of two words', () => {
  expect(initials('  ريم الخطيب ')).toBe('را');
  expect(initials('Leila Haddad')).toBe('LH');
  expect(initials('سامر')).toBe('س');
});
it('PEOPLE-B02 Arabic search normalizes alef, ya, and tashkeel', () => {
  expect(normalize('إِلَى')).toBe('الي');
});
