import { AppDataSource } from '../dist/database/data-source.js';
import { User, Role } from '../dist/user/user.entity.js';
import { UsersService } from '../dist/user/users.service.js';
import { CatalogAccess } from '../dist/learning/catalog-access.service.js';
import { QuizzesService } from '../dist/quizzes/quizzes.service.js';
import { Quiz } from '../dist/quizzes/quiz.entity.js';
import { Learning1794050000000 } from '../dist/database/migrations/1794050000000-Learning.js';

const schema = 'learning_demo';
const source = new AppDataSource.constructor({
  ...AppDataSource.options,
  schema,
  extra: { options: `-c search_path=${schema},public` },
  migrations: [Learning1794050000000],
  migrationsTableName: 'learning_migrations',
  synchronize: false,
});
const courseId = '1eae57e4-2f94-48d4-a80d-1d9ecad0b001';
const sectionId = '1eae57e4-2f94-48d4-a80d-1d9ecad0b002';
const lessons = [
  {
    id: '1eae57e4-2f94-48d4-a80d-1d9ecad0b003',
    title: '01. Tiến độ học tập',
    durationSec: 100,
  },
  {
    id: '1eae57e4-2f94-48d4-a80d-1d9ecad0b004',
    title: '02. Quiz và chứng chỉ',
    durationSec: 100,
  },
];
const password = 'LmsDemo2026!';
try {
  await source.initialize();
  await source.query('CREATE SCHEMA IF NOT EXISTS "learning_demo"');
  if (
    (await source.query('SELECT current_schema() AS name'))[0].name !== schema
  )
    throw new Error('Unexpected demo schema');
  await source.query(`
    CREATE TABLE IF NOT EXISTS "learning_demo"."users" (LIKE "public"."users" INCLUDING ALL);
    CREATE TABLE IF NOT EXISTS "learning_demo"."courses" (
      "id" uuid PRIMARY KEY, "instructorId" uuid NOT NULL REFERENCES "learning_demo"."users"("id"), "title" text NOT NULL, "status" text NOT NULL);
    CREATE TABLE IF NOT EXISTS "learning_demo"."sections" (
      "id" uuid PRIMARY KEY, "courseId" uuid NOT NULL REFERENCES "learning_demo"."courses"("id"), "title" text NOT NULL, "position" integer NOT NULL);
    CREATE TABLE IF NOT EXISTS "learning_demo"."lessons" (
      "id" uuid PRIMARY KEY, "sectionId" uuid NOT NULL REFERENCES "learning_demo"."sections"("id"), "title" text NOT NULL,
      "position" integer NOT NULL, "durationSec" integer NOT NULL, "isPublished" boolean NOT NULL);
    CREATE TABLE IF NOT EXISTS "learning_demo"."enrolments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "userId" uuid NOT NULL REFERENCES "learning_demo"."users"("id"),
      "courseId" uuid NOT NULL REFERENCES "learning_demo"."courses"("id"), "status" text NOT NULL DEFAULT 'ACTIVE',
      "progressPct" integer NOT NULL DEFAULT 0, "enrolledAt" timestamptz NOT NULL DEFAULT now(), "completedAt" timestamptz, UNIQUE ("userId", "courseId"));
  `);
  await source.runMigrations({ transaction: 'all' });
  const repository = source.getRepository(User);
  const users = new UsersService(repository);
  async function account(email, fullName, role) {
    let user = await repository.findOneBy({ email });
    if (!user) user = await users.create({ email, fullName, password });
    if (user.role !== role) await repository.update(user.id, { role });
    return { userId: user.id, email, role };
  }
  const teacher = await account(
    'teacher@lms.demo',
    'Giảng viên demo',
    Role.INSTRUCTOR,
  );
  const student = await account(
    'student@lms.demo',
    'Học viên demo',
    Role.STUDENT,
  );
  await source.query(
    `INSERT INTO "courses" ("id", "instructorId", "title", "status") VALUES ($1, $2, $3, 'PUBLISHED') ON CONFLICT ("id") DO NOTHING`,
    [courseId, teacher.userId, 'NestJS Learning — Demo'],
  );
  await source.query(
    `INSERT INTO "sections" ("id", "courseId", "title", "position") VALUES ($1, $2, $3, 0) ON CONFLICT ("id") DO NOTHING`,
    [sectionId, courseId, 'Trải nghiệm Learning'],
  );
  for (const [position, lesson] of lessons.entries()) {
    await source.query(
      `INSERT INTO "lessons" ("id", "sectionId", "title", "position", "durationSec", "isPublished") VALUES ($1, $2, $3, $4, $5, true) ON CONFLICT ("id") DO NOTHING`,
      [lesson.id, sectionId, lesson.title, position, lesson.durationSec],
    );
  }
  await source.query(
    `INSERT INTO "enrolments" ("userId", "courseId") VALUES ($1, $2) ON CONFLICT ("userId", "courseId") DO NOTHING`,
    [student.userId, courseId],
  );
  if (
    !(await source.getRepository(Quiz).findOneBy({ lessonId: lessons[1].id }))
  ) {
    await new QuizzesService(source, new CatalogAccess(source)).create(
      teacher,
      lessons[1].id,
      {
        passScore: 70,
        timeLimitSec: 180,
        questions: [
          {
            content:
              'Lesson hoàn thành khi watchedSec đạt bao nhiêu phần trăm duration?',
            options: [
              { content: '90%', isCorrect: true },
              { content: '50%', isCorrect: false },
            ],
          },
          {
            content: 'Điểm quiz được tính ở đâu?',
            options: [
              { content: 'Trên server', isCorrect: true },
              { content: 'Trong trình duyệt', isCorrect: false },
            ],
          },
        ],
      },
    );
  }
  console.log('Demo data ready in learning_demo; public user data unchanged');
  console.log('Student: student@lms.demo');
} finally {
  if (source.isInitialized) await source.destroy();
}
