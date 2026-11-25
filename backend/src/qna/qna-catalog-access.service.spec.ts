import { DataSource } from 'typeorm';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
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

  it('fails closed on a database error outside missing-catalog codes', async () => {
    const source = {
      manager: {
        query: async () => {
          throw new Error('database connection lost');
        },
      },
    } as unknown as DataSource;
    const access = new QnaCatalogAccess(source);

    await expect(
      access.checkAccess('22222222-2222-4222-8222-222222222222', user),
    ).rejects.toThrow('database connection lost');
  });
});
