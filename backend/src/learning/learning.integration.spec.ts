import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Role, User } from '../user/user.entity.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { Learning1794050000000 } from '../database/migrations/1794050000000-Learning.js';
import { ProgressService } from '../progress/progress.service.js';
import { CertificatesService } from '../certificates/certificates.service.js';
import { QuizzesService } from '../quizzes/quizzes.service.js';
import { AttemptsService } from '../attempts/attempts.service.js';
import { QuizAnswer, QuizAttempt } from '../attempts/quiz-attempt.entity.js';
import { Option } from '../quizzes/quiz.entity.js';
import { LEARNING_ENTITIES } from './learning.entities.js';
import { CatalogAccess } from './catalog-access.service.js';
import { PublishedLessonCache } from './published-lesson-cache.service.js';

describe.runIf(process.env.LEARNING_DB_TESTS === '1')(
  'Learning services with PostgreSQL',
  () => {
    const schema = `learning_test_${randomUUID().replaceAll('-', '')}`;
    let source: DataSource;
    let progress: ProgressService;
    let certificates: CertificatesService;
    let quizzes: QuizzesService;
    let attempts: AttemptsService;
    let cache: PublishedLessonCache;
    let student: AuthenticatedUser;
    let otherStudent: AuthenticatedUser;
    let teacher: AuthenticatedUser;
    let otherTeacher: AuthenticatedUser;
    let courseId: string;
    let sectionId: string;
    let lessons: string[];

    beforeAll(async () => {
      source = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5433),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        schema,
        extra: { options: `-c search_path=${schema},public` },
        entities: [User, ...LEARNING_ENTITIES],
        migrations: [Learning1794050000000],
        synchronize: false,
      });
      await source.initialize();
      await source.query(`CREATE SCHEMA "${schema}"`);
      expect(
        (await source.query('SELECT current_schema() AS name'))[0].name,
      ).toBe(schema);
      // These tables model only the published Catalog contract; production Catalog is owned by @content.
      await source.query(`
      CREATE TABLE "users" ("id" uuid PRIMARY KEY);
      CREATE TABLE "courses" ("id" uuid PRIMARY KEY, "instructorId" uuid REFERENCES "users"("id") ON DELETE CASCADE, "status" text NOT NULL);
      CREATE TABLE "sections" ("id" uuid PRIMARY KEY, "courseId" uuid REFERENCES "courses"("id") ON DELETE CASCADE, "position" integer NOT NULL);
      CREATE TABLE "lessons" ("id" uuid PRIMARY KEY, "sectionId" uuid REFERENCES "sections"("id") ON DELETE CASCADE, "position" integer NOT NULL, "durationSec" integer NOT NULL, "isPublished" boolean NOT NULL);
      CREATE TABLE "enrolments" ("id" uuid PRIMARY KEY, "userId" uuid REFERENCES "users"("id") ON DELETE CASCADE, "courseId" uuid REFERENCES "courses"("id") ON DELETE CASCADE,
        "status" text NOT NULL DEFAULT 'ACTIVE', "progressPct" integer NOT NULL DEFAULT 0, "completedAt" timestamptz, UNIQUE ("userId", "courseId"));
    `);
      await source.runMigrations({ transaction: 'all' });
      const catalog = new CatalogAccess(source);
      cache = new PublishedLessonCache(
        new ConfigService({ REDIS_HOST: '127.0.0.1', REDIS_PORT: 1 }),
      );
      certificates = new CertificatesService(source);
      progress = new ProgressService(source, catalog, cache, certificates);
      quizzes = new QuizzesService(source, catalog);
      attempts = new AttemptsService(source, catalog, quizzes);
    }, 20000);

    beforeEach(async () => {
      expect(
        (await source.query('SELECT current_schema() AS name'))[0].name,
      ).toBe(schema);
      await source.query(
        `TRUNCATE TABLE "${schema}"."users", "${schema}"."quizzes" CASCADE`,
      );
      const actor = (role: Role): AuthenticatedUser => ({
        userId: randomUUID(),
        role,
        email: 'fixture@example.test',
      });
      student = actor(Role.STUDENT);
      otherStudent = actor(Role.STUDENT);
      teacher = actor(Role.INSTRUCTOR);
      otherTeacher = actor(Role.INSTRUCTOR);
      for (const user of [student, otherStudent, teacher, otherTeacher])
        await source.query('INSERT INTO "users" ("id") VALUES ($1)', [
          user.userId,
        ]);
      courseId = randomUUID();
      sectionId = randomUUID();
      lessons = [randomUUID(), randomUUID(), randomUUID()];
      await source.query('INSERT INTO "courses" VALUES ($1, $2, $3)', [
        courseId,
        teacher.userId,
        'PUBLISHED',
      ]);
      await source.query('INSERT INTO "sections" VALUES ($1, $2, 0)', [
        sectionId,
        courseId,
      ]);
      for (const [position, id] of lessons.entries())
        await source.query(
          'INSERT INTO "lessons" VALUES ($1, $2, $3, 100, $4)',
          [id, sectionId, position, position < 2],
        );
      await source.query(
        'INSERT INTO "enrolments" ("id", "userId", "courseId") VALUES ($1, $2, $3)',
        [randomUUID(), student.userId, courseId],
      );
    });

    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => {
      if (source?.isInitialized) {
        if (!/^learning_test_[a-f0-9]{32}$/.test(schema))
          throw new Error('Invalid test schema');
        await source.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await source.destroy();
      }
    });

    const quizInput = (timeLimitSec = 60) => ({
      passScore: 70,
      timeLimitSec,
      questions: [
        {
          content: 'First?',
          options: [
            { content: 'Right', isCorrect: true },
            { content: 'Wrong', isCorrect: false },
          ],
        },
        {
          content: 'Second?',
          options: [
            { content: 'Right', isCorrect: true },
            { content: 'Wrong', isCorrect: false },
          ],
        },
      ],
    });
    const newQuiz = () => quizzes.create(teacher, lessons[0], quizInput());
    const enrolment = async () =>
      (
        await source.query(
          'SELECT * FROM "enrolments" WHERE "userId" = $1 AND "courseId" = $2',
          [student.userId, courseId],
        )
      )[0];

    it('requires an active enrolment and published lesson', async () => {
      await expect(
        progress.update(otherStudent, lessons[0], { watchedSec: 100 }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        progress.update(student, lessons[2], { watchedSec: 100 }),
      ).rejects.toMatchObject({ status: 404 });
      await source.query('UPDATE "enrolments" SET "status" = $1', ['EXPIRED']);
      await expect(
        progress.update(student, lessons[0], { watchedSec: 100 }),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('completes at 90%, excludes drafts, and preserves monotonic progress', async () => {
      expect(
        await progress.update(student, lessons[0], { watchedSec: 89 }),
      ).toMatchObject({ completed: false });
      const completed = await progress.update(student, lessons[0], {
        watchedSec: 90,
      });
      expect(completed.completed).toBe(true);
      expect((await enrolment()).progressPct).toBe(50);
      expect(
        await progress.update(student, lessons[0], { watchedSec: 10 }),
      ).toMatchObject({ watchedSec: 90, completedAt: completed.completedAt });
      const summary = await progress.course(student, courseId);
      expect(summary.lessons).toHaveLength(2);
      expect(
        summary.lessons.find((lesson) => lesson.lessonId === lessons[1]),
      ).toMatchObject({ watchedSec: 0, completed: false, completedAt: null });
    });

    it('commits concurrent lesson completions and issues exactly one certificate', async () => {
      await Promise.all(
        lessons
          .slice(0, 2)
          .map((id) => progress.update(student, id, { watchedSec: 1000 })),
      );
      expect(await enrolment()).toMatchObject({
        progressPct: 100,
        status: 'COMPLETED',
      });
      const [certificate] = await certificates.mine(student.userId);
      expect(certificate.serialNo).toMatch(/^LMS-/);
      expect(await certificates.lookup(certificate.serialNo)).toEqual(
        certificate,
      );
      await progress.update(student, lessons[0], { watchedSec: 0 });
      expect(await certificates.mine(student.userId)).toEqual([certificate]);
      expect(await certificates.mine(otherStudent.userId)).toEqual([]);
      await expect(certificates.lookup('missing')).rejects.toMatchObject({
        status: 404,
      });
    });

    it('does not issue a certificate from a stale low cache count', async () => {
      vi.spyOn(cache, 'get').mockResolvedValue(1);
      await progress.update(student, lessons[0], { watchedSec: 90 });
      expect((await enrolment()).progressPct).toBe(50);
      expect(await certificates.mine(student.userId)).toHaveLength(0);
    });

    it('regression: a stale high cache count cannot undo a completed enrolment', async () => {
      for (const lessonId of lessons.slice(0, 2))
        await progress.update(student, lessonId, { watchedSec: 90 });
      const completed = await enrolment();
      const issued = await certificates.mine(student.userId);
      vi.spyOn(cache, 'get').mockResolvedValue(50);
      await progress.update(student, lessons[0], { watchedSec: 90 });
      expect(await enrolment()).toMatchObject({
        progressPct: 100,
        status: 'COMPLETED',
        completedAt: completed.completedAt,
      });
      expect(await certificates.mine(student.userId)).toEqual(issued);
    });

    it('recalculates a completed course after another lesson is published', async () => {
      for (const lessonId of lessons.slice(0, 2))
        await progress.update(student, lessonId, { watchedSec: 90 });
      const issued = await certificates.mine(student.userId);
      await source.query(
        'UPDATE "lessons" SET "isPublished" = true WHERE "id" = $1',
        [lessons[2]],
      );
      vi.spyOn(cache, 'get').mockResolvedValue(2);
      await progress.update(student, lessons[0], { watchedSec: 90 });
      expect(await enrolment()).toMatchObject({
        progressPct: 67,
        status: 'ACTIVE',
        completedAt: null,
      });
      expect(await certificates.mine(student.userId)).toEqual(issued);
    });

    it('does not certify a rounded 199/200 completion ratio', async () => {
      await source.query(
        'INSERT INTO "lessons" SELECT gen_random_uuid(), $1, n, 100, true FROM generate_series(3, 200) n',
        [sectionId],
      );
      await source.query(
        `INSERT INTO "lesson_progress" ("userId", "lessonId", "watchedSec", "completed", "completedAt")
      SELECT $1, "id", 100, true, CURRENT_TIMESTAMP FROM "lessons" WHERE "isPublished" = true ORDER BY "position" LIMIT 199`,
        [student.userId],
      );
      expect((await progress.course(student, courseId)).progressPct).toBe(100);
      expect((await enrolment()).status).toBe('ACTIVE');
      expect(await certificates.mine(student.userId)).toHaveLength(0);
    });

    it('handles courses with no published lessons', async () => {
      await source.query('UPDATE "lessons" SET "isPublished" = false');
      expect(await progress.course(student, courseId)).toEqual({
        progressPct: 0,
        lessons: [],
      });
      expect(await certificates.mine(student.userId)).toHaveLength(0);
    });

    it('rolls back progress and enrolment when certificate insertion fails', async () => {
      await progress.update(student, lessons[0], { watchedSec: 90 });
      vi.spyOn(certificates, 'issue').mockRejectedValue(
        new Error('insertion failed'),
      );
      await expect(
        progress.update(student, lessons[1], { watchedSec: 90 }),
      ).rejects.toThrow('insertion failed');
      expect((await enrolment()).progressPct).toBe(50);
      expect(
        await source.query(
          'SELECT * FROM "lesson_progress" WHERE "lessonId" = $1',
          [lessons[1]],
        ),
      ).toHaveLength(0);
    });

    it('checks quiz ownership, unique lesson and exactly one correct option', async () => {
      await expect(
        quizzes.create(otherTeacher, lessons[0], quizInput()),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        quizzes.create(student, lessons[0], quizInput()),
      ).rejects.toMatchObject({ status: 403 });
      const invalid = quizInput();
      invalid.questions[0].options[1].isCorrect = true;
      await expect(
        quizzes.create(teacher, lessons[0], invalid),
      ).rejects.toMatchObject({ status: 400 });
      await newQuiz();
      await expect(newQuiz()).rejects.toMatchObject({ status: 409 });
    });

    it('hides correct options in quiz and attempt responses and default ORM selects', async () => {
      await newQuiz();
      const quiz = await quizzes.get(student, lessons[0]);
      const attempt = await attempts.start(student, lessons[0]);
      expect(JSON.stringify({ quiz, attempt })).not.toContain('isCorrect');
      expect(
        (await source.getRepository(Option).find())[0].isCorrect,
      ).toBeUndefined();
    });

    it('allows replacement before attempts and freezes the quiz afterwards', async () => {
      await newQuiz();
      expect(
        (
          await quizzes.create(
            teacher,
            lessons[0],
            { ...quizInput(), passScore: 80 },
            true,
          )
        ).passScore,
      ).toBe(80);
      await attempts.start(student, lessons[0]);
      await expect(
        quizzes.create(teacher, lessons[0], quizInput(), true),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('regression: reads quiz metadata and questions from one consistent snapshot', async () => {
      await newQuiz();
      const forLesson = quizzes.forLesson.bind(quizzes);
      vi.spyOn(quizzes, 'forLesson').mockImplementationOnce(async (...args) => {
        const quiz = await forLesson(...args);
        await quizzes.create(
          teacher,
          lessons[0],
          {
            passScore: 95,
            questions: [
              {
                content: 'Replacement?',
                options: [
                  { content: 'Yes', isCorrect: true },
                  { content: 'No', isCorrect: false },
                ],
              },
            ],
          },
          true,
        );
        return quiz;
      });
      const snapshot = await quizzes.get(student, lessons[0]);
      expect(snapshot.passScore).toBe(70);
      expect(snapshot.questions.map((question) => question.content)).toEqual([
        'First?',
        'Second?',
      ]);
      expect(
        snapshot.questions.every((question) => question.options.length === 2),
      ).toBe(true);
      const latest = await quizzes.get(student, lessons[0]);
      expect(latest.passScore).toBe(95);
      expect(latest.questions.map((question) => question.content)).toEqual([
        'Replacement?',
      ]);
    });

    it('requires enrolled students to start an attempt', async () => {
      await newQuiz();
      await expect(
        attempts.start(otherStudent, lessons[0]),
      ).rejects.toMatchObject({ status: 403 });
      await expect(attempts.start(teacher, lessons[0])).rejects.toMatchObject({
        status: 403,
      });
    });

    it('serializes concurrent starts', async () => {
      await newQuiz();
      const results = await Promise.allSettled([
        attempts.start(student, lessons[0]),
        attempts.start(student, lessons[0]),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.find((result) => result.status === 'rejected'),
      ).toMatchObject({ reason: { status: 409 } });
      expect(await source.getRepository(QuizAttempt).count()).toBe(1);
    });

    it('grades on the server and rejects a second submission', async () => {
      const quiz = await newQuiz();
      const attempt = await attempts.start(student, lessons[0]);
      const answers = quiz.questions.map((question) => ({
        questionId: question.id,
        optionId: question.options[0].id,
      }));
      expect(
        await attempts.submit(student, attempt.attemptId, { answers }),
      ).toMatchObject({ score: 100, passed: true });
      expect(await source.getRepository(QuizAnswer).count()).toBe(2);
      await expect(
        attempts.submit(student, attempt.attemptId, { answers }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('does not allow other students or foreign options to submit', async () => {
      const quiz = await newQuiz();
      const attempt = await attempts.start(student, lessons[0]);
      await expect(
        attempts.submit(otherStudent, attempt.attemptId, { answers: [] }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        attempts.submit(student, attempt.attemptId, {
          answers: [
            {
              questionId: quiz.questions[0].id,
              optionId: quiz.questions[1].options[0].id,
            },
          ],
        }),
      ).rejects.toMatchObject({ status: 400 });
      expect(await source.getRepository(QuizAnswer).count()).toBe(0);
      expect(
        (
          await source
            .getRepository(QuizAttempt)
            .findOneByOrFail({ id: attempt.attemptId })
        ).submittedAt,
      ).toBeNull();
    });

    it('rejects late submissions and allows another attempt after expiry', async () => {
      await newQuiz();
      const attempt = await attempts.start(student, lessons[0]);
      await source
        .getRepository(QuizAttempt)
        .update(attempt.attemptId, { startedAt: new Date(Date.now() - 61000) });
      await expect(
        attempts.submit(student, attempt.attemptId, { answers: [] }),
      ).rejects.toMatchObject({ status: 400 });
      expect((await attempts.start(student, lessons[0])).attemptId).not.toBe(
        attempt.attemptId,
      );
    });

    it('treats timeLimitSec zero as unlimited and enforces three lifetime attempts', async () => {
      await quizzes.create(teacher, lessons[0], quizInput(0));
      for (let index = 0; index < 3; index++) {
        const attempt = await attempts.start(student, lessons[0]);
        await source.getRepository(QuizAttempt).update(attempt.attemptId, {
          startedAt: new Date(Date.now() - 86400000),
        });
        expect(
          await attempts.submit(student, attempt.attemptId, { answers: [] }),
        ).toMatchObject({ score: 0, passed: false });
      }
      await expect(attempts.start(student, lessons[0])).rejects.toMatchObject({
        status: 409,
      });
    });

    it('accepts only one concurrent submission and persists one set of answers', async () => {
      await newQuiz();
      const attempt = await attempts.start(student, lessons[0]);
      const results = await Promise.allSettled([
        attempts.submit(student, attempt.attemptId, { answers: [] }),
        attempts.submit(student, attempt.attemptId, { answers: [] }),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.find((result) => result.status === 'rejected'),
      ).toMatchObject({ reason: { status: 409 } });
      expect(await source.getRepository(QuizAnswer).count()).toBe(2);
    });

    it('enforces answer ownership and uniqueness in PostgreSQL even without the service', async () => {
      const quiz = await newQuiz();
      const attempt = await attempts.start(student, lessons[0]);
      const repository = source.getRepository(QuizAnswer);
      await expect(
        repository.insert({
          attemptId: attempt.attemptId,
          questionId: quiz.questions[0].id,
          optionId: quiz.questions[1].options[0].id,
        }),
      ).rejects.toMatchObject({ code: '23503' });
      const answer = {
        attemptId: attempt.attemptId,
        questionId: quiz.questions[0].id,
        optionId: quiz.questions[0].options[0].id,
      };
      await repository.insert(answer);
      await expect(repository.insert(answer)).rejects.toMatchObject({
        code: '23505',
      });
      await expect(
        source.getRepository(Option).insert({
          questionId: quiz.questions[0].id,
          content: 'Another correct option',
          position: 2,
          isCorrect: true,
        }),
      ).rejects.toMatchObject({ code: '23505' });
    });

    it('can revert and reapply the Learning migration', async () => {
      const runner = source.createQueryRunner();
      try {
        await new Learning1794050000000().down(runner);
        await new Learning1794050000000().up(runner);
      } finally {
        await runner.release();
      }
      expect(await certificates.mine(student.userId)).toEqual([]);
    });
  },
);
