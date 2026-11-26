import { describe, expect, it } from 'vitest';
import { assertSafeE2eDatabase } from './e2e-database.guard.js';

describe('assertSafeE2eDatabase', () => {
  it('accepts a database name ending in _e2e', () => {
    expect(() => assertSafeE2eDatabase('lms_e2e')).not.toThrow();
  });

  it.each(['elearning_lms', 'lms_test', '', undefined])(
    'rejects unsafe database name %s',
    (dbName) => {
      expect(() => assertSafeE2eDatabase(dbName)).toThrow(
        'DB_NAME must end with "_e2e"',
      );
    },
  );
});
