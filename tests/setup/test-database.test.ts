import { it, expect } from 'vitest';
import { assertTestDatabase } from './test-database';
it('refuses a database name without the _test suffix', () => {
  expect(() => assertTestDatabase('postgresql://u:p@localhost:5432/executiveos')).toThrow(/_test/);
  expect(() => assertTestDatabase('postgresql://u:p@localhost:5432/production_test_')).toThrow();
  expect(assertTestDatabase('postgresql://u:p@localhost:5432/executiveos_test').name).toBe(
    'executiveos_test',
  );
});
