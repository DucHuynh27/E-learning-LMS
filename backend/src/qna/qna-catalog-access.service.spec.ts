import { DataSource } from 'typeorm';
import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { QnaCatalogAccess } from './qna-catalog-access.service.js';
import { Role } from '../user/user.entity.js';

describe('QnaCatalogAccess fail-close authorization', () => {
  const user = {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'student@lms.local',
    role: Role.STUDENT,
  };

  it('fails closed when the catalog schema is missing', async () => {
    const source = {
      manager: {
        query: async () => {
          throw { code: '42P01', message: 'relation courses does not exist' };
        },
      },
    } as unknown as DataSource;
    const access = new QnaCatalogAccess(source);

    await expect(
      access.checkAccess('22222222-2222-4222-8222-222222222222', user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it.each([
    { code: '08006', message: 'connection failure' },
    { code: '57P01', message: 'admin shutdown' },
    { code: 'ETIMEDOUT', message: 'database timeout' },
  ])('normalizes database catalog error $code to 503', async (error) => {
    const source = {
      manager: {
        query: async () => {
          throw error;
        },
      },
    } as unknown as DataSource;
    const access = new QnaCatalogAccess(source);

    await expect(
      access.checkAccess('22222222-2222-4222-8222-222222222222', user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('normalizes ordinary Error database failures to 503', async () => {
    const source = {
      manager: {
        query: async () => {
          throw new Error('unexpected database failure');
        },
      },
    } as unknown as DataSource;
    const access = new QnaCatalogAccess(source);

    await expect(
      access.checkAccess('22222222-2222-4222-8222-222222222222', user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns 404 for a course that is not found', async () => {
    const source = {
      manager: { query: async () => [] },
    } as unknown as DataSource;
    const access = new QnaCatalogAccess(source);

    await expect(
      access.checkAccess('22222222-2222-4222-8222-222222222222', user),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows an enrolled student', async () => {
    const source = {
      manager: {
        query: async (sql: string) => {
          if (sql.includes('FROM "courses"')) {
            return [
              {
                id: '22222222-2222-4222-8222-222222222222',
                instructorId: '33333333-3333-4333-8333-333333333333',
                status: 'PUBLISHED',
              },
            ];
          }
          if (sql.includes('FROM "enrolments"'))
            return [{ id: 'enrolment-id' }];
          return [];
        },
      },
    } as unknown as DataSource;
    const access = new QnaCatalogAccess(source);

    await expect(
      access.checkAccess('22222222-2222-4222-8222-222222222222', user),
    ).resolves.toEqual({ canAccess: true, isOwner: false });
  });

  it('denies a student who is not enrolled', async () => {
    const source = {
      manager: {
        query: async (sql: string) => {
          if (sql.includes('FROM "courses"')) {
            return [
              {
                id: '22222222-2222-4222-8222-222222222222',
                instructorId: '33333333-3333-4333-8333-333333333333',
                status: 'PUBLISHED',
              },
            ];
          }
          return [];
        },
      },
    } as unknown as DataSource;
    const access = new QnaCatalogAccess(source);

    await expect(
      access.checkAccess('22222222-2222-4222-8222-222222222222', user),
    ).resolves.toEqual({ canAccess: false, isOwner: false });
  });

  it('does not convert 403 enrollment denial into 503', async () => {
    const source = {
      manager: {
        query: async (sql: string) => {
          if (sql.includes('FROM "courses"')) {
            return [
              {
                id: '22222222-2222-4222-8222-222222222222',
                instructorId: '33333333-3333-4333-8333-333333333333',
                status: 'PUBLISHED',
              },
            ];
          }
          return [];
        },
      },
    } as unknown as DataSource;
    const access = new QnaCatalogAccess(source);

    await expect(
      access.assertCanAccess('22222222-2222-4222-8222-222222222222', user),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
