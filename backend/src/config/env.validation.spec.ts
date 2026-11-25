import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { validateEnv } from './env.validation.js';

const example = Object.fromEntries(
  readFileSync(new URL('../../.env.example', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

describe('Explicit infrastructure environment', () => {
  it('accepts local and container hostnames from declared variables', () => {
    expect(validateEnv(example)).toMatchObject({
      REDIS_HOST: 'localhost',
      MINIO_HOST: 'localhost',
      REDIS_TLS: false,
    });
    expect(
      validateEnv({
        ...example,
        REDIS_HOST: 'redis',
        MINIO_HOST: 'minio',
        REDIS_TLS: 'true',
      }),
    ).toMatchObject({
      REDIS_HOST: 'redis',
      MINIO_HOST: 'minio',
      REDIS_TLS: true,
    });
  });
  it.each(['REDIS_HOST', 'MINIO_HOST'])(
    'rejects missing or empty %s at boot',
    (key) => {
      const missing = { ...example };
      delete missing[key];
      expect(() => validateEnv(missing)).toThrow('Invalid environment');
      expect(() => validateEnv({ ...example, [key]: '' })).toThrow(
        'Invalid environment',
      );
    },
  );
  it('rejects an invalid TLS flag', () => {
    expect(() => validateEnv({ ...example, REDIS_TLS: 'maybe' })).toThrow(
      'Invalid environment',
    );
  });
});
