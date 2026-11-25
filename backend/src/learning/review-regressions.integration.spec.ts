import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { Role } from '../user/user.entity.js';
import { ProgressService } from '../progress/progress.service.js';
import { CatalogAccess } from './catalog-access.service.js';
import { CertificatesService } from '../certificates/certificates.service.js';
import {
  createHttpTestDatabase,
  destroyHttpTestDatabase,
} from '../../test-support/http-test-database.js';

describe('Progress read semantics', () => {
  let source: DataSource;
  let progress: ProgressService;
  const user = {
    userId: randomUUID(),
    email: 'reader@example.test',
    role: Role.STUDENT,
  };
  const courseId = randomUUID();
  beforeAll(async () => {
    source = await createHttpTestDatabase();
    const certificates = new CertificatesService(source);
    progress = new ProgressService(
      source,
      new CatalogAccess(source),
      certificates,
    );
    await source.query(
      `INSERT INTO users (id, email, "passwordHash", "fullName") VALUES ($1, $2, 'unused', 'Reader')`,
      [user.userId, user.email],
    );
    await source.query(`INSERT INTO courses VALUES ($1, $2, 'PUBLISHED')`, [
      courseId,
      user.userId,
    ]);
    const sectionId = randomUUID();
    await source.query('INSERT INTO sections VALUES ($1, $2, 0)', [
      sectionId,
      courseId,
    ]);
    const lessonId = randomUUID();
    await source.query('INSERT INTO lessons VALUES ($1, $2, 0, 100, true)', [
      lessonId,
      sectionId,
    ]);
    await source.query(
      'INSERT INTO enrolments ("userId", "courseId") VALUES ($1, $2)',
      [user.userId, courseId],
    );
    await source.query(
      'INSERT INTO lesson_progress ("userId", "lessonId", "watchedSec", completed, "completedAt") VALUES ($1, $2, 90, true, now())',
      [user.userId, lessonId],
    );
  });
  afterAll(async () => {
    if (source?.isInitialized) await destroyHttpTestDatabase(source);
  });

  it('returns live progress without updating enrolment or issuing a certificate', async () => {
    expect((await progress.course(user, courseId)).progressPct).toBe(100);
    const [enrolment] = await source.query(
      'SELECT status, "progressPct", "completedAt" FROM enrolments',
    );
    expect(enrolment).toEqual({
      status: 'ACTIVE',
      progressPct: 0,
      completedAt: null,
    });
    expect(await source.query('SELECT * FROM certificates')).toEqual([]);
  });

  it('can read while an enrolment writer holds its row lock', async () => {
    const writer = source.createQueryRunner();
    await writer.connect();
    await writer.startTransaction();
    await writer.query('SELECT id FROM enrolments FOR UPDATE');
    const read = progress.course(user, courseId);
    let deadline: ReturnType<typeof setTimeout>;
    try {
      await Promise.race([
        read,
        new Promise((_, reject) => {
          deadline = setTimeout(
            () => reject(new Error('GET waited for a writer lock')),
            1000,
          );
        }),
      ]);
    } finally {
      clearTimeout(deadline!);
      await writer.rollbackTransaction();
      await writer.release();
      await read.catch(() => {});
    }
  });
});
