import { AppDataSource } from '../dist/database/data-source.js';
import { ConflictException } from '@nestjs/common';
import { User, Role } from '../dist/user/user.entity.js';
import { UsersService } from '../dist/user/users.service.js';
import { CatalogAccess } from '../dist/learning/catalog-access.service.js';
import { QuizzesService } from '../dist/quizzes/quizzes.service.js';
import { Quiz } from '../dist/quizzes/quiz.entity.js';
import { Learning1794050000000 } from '../dist/database/migrations/1794050000000-Learning.js';
import { AddLessonTheory1795300000000 } from '../dist/database/migrations/1795300000000-AddLessonTheory.js';

const catalog = process.argv.includes('--catalog');
const schema = catalog ? 'public' : 'learning_demo';
if (
  catalog &&
  (process.env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '::1'].includes(AppDataSource.options.host))
) {
  throw new Error('Catalog demo data requires a local development database');
}
const source = new AppDataSource.constructor({
  ...AppDataSource.options,
  schema,
  extra: { options: `-c search_path=${catalog ? schema : `${schema},public`}` },
  ...(catalog
    ? {}
    : {
        migrations: [Learning1794050000000, AddLessonTheory1795300000000],
        migrationsTableName: 'learning_migrations',
      }),
  synchronize: false,
});
const courseId = '1eae57e4-2f94-48d4-a80d-1d9ecad0b001';
const sectionId = '1eae57e4-2f94-48d4-a80d-1d9ecad0b002';
const lessons = [
  {
    id: '1eae57e4-2f94-48d4-a80d-1d9ecad0b003',
    title: '01. Tiến độ học tập',
    type: 'VIDEO',
    durationSec: 100,
  },
  {
    id: '1eae57e4-2f94-48d4-a80d-1d9ecad0b004',
    title: '02. Quiz và chứng chỉ',
    type: 'QUIZ',
    durationSec: 100,
  },
];
const password = 'LmsDemo2026!';
try {
  await source.initialize();
  if (!catalog)
    await source.query('CREATE SCHEMA IF NOT EXISTS "learning_demo"');
  if (
    (await source.query('SELECT current_schema() AS name'))[0].name !== schema
  )
    throw new Error('Unexpected demo schema');
  if (!catalog)
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
  const teacher = await source.transaction(async (manager) => {
    await manager.query('SELECT pg_advisory_xact_lock(1794050000)');
    const repository = manager.getRepository(User);
    const users = new UsersService(repository);
    async function account(email, fullName, role) {
      const existing = await repository.findOneBy({ email });
      if (catalog && existing && existing.role !== role) {
        throw new Error(
          `Existing demo account has an unexpected role: ${email}`,
        );
      }
      const user =
        existing ?? (await users.create({ email, fullName, password }));
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
    await account('admin@lms.demo', 'Quản trị viên demo', Role.ADMIN);
    const course = [
      courseId,
      teacher.userId,
      catalog ? 'Khám phá Learning cùng NestJS' : 'NestJS Learning — Demo',
    ];
    await manager.query(
      catalog
        ? `INSERT INTO "courses" ("id", "instructorId", "title", "status", "slug", "description")
           VALUES ($1, $2, $3, 'PUBLISHED', $4, $5) ON CONFLICT ("id") DO NOTHING`
        : `INSERT INTO "courses" ("id", "instructorId", "title", "status")
           VALUES ($1, $2, $3, 'PUBLISHED') ON CONFLICT ("id") DO NOTHING`,
      catalog
        ? [
            ...course,
            'nestjs-learning-demo',
            'Khóa lập trình mẫu để thử tiến độ bài học, quiz và chứng chỉ.',
          ]
        : course,
    );
    await manager.query(
      `INSERT INTO "sections" ("id", "courseId", "title", "position") VALUES ($1, $2, $3, 0) ON CONFLICT ("id") DO NOTHING`,
      [sectionId, courseId, 'Trải nghiệm Learning'],
    );
    for (const [position, lesson] of lessons.entries()) {
      const values = [
        lesson.id,
        sectionId,
        lesson.title,
        position,
        lesson.durationSec,
      ];
      await manager.query(
        catalog
          ? `INSERT INTO "lessons" ("id", "sectionId", "title", "position", "durationSec", "isPublished", "type")
             VALUES ($1, $2, $3, $4, $5, true, $6) ON CONFLICT ("id") DO NOTHING`
          : `INSERT INTO "lessons" ("id", "sectionId", "title", "position", "durationSec", "isPublished")
             VALUES ($1, $2, $3, $4, $5, true) ON CONFLICT ("id") DO NOTHING`,
        catalog ? [...values, lesson.type] : values,
      );
    }
    await manager.query(
      `INSERT INTO "enrolments" ("userId", "courseId") VALUES ($1, $2) ON CONFLICT ("userId", "courseId") DO NOTHING`,
      [student.userId, courseId],
    );
    return teacher;
  });
  if (
    !(await source.getRepository(Quiz).findOneBy({ lessonId: lessons[1].id }))
  ) {
    await new QuizzesService(source, new CatalogAccess(source))
      .create(teacher, lessons[1].id, {
        passScore: 70,
        timeLimitSec: 180,
        questions: [
          {
            content:
              'Một bài học dài 10 phút chỉ được tính hoàn thành khi người học đã xem ít nhất 90% thời lượng. Hệ thống nên kiểm tra điều kiện nào trước khi cập nhật tiến độ?',
            options: [
              {
                content:
                  'watchedSec đạt ít nhất 540 giây so với durationSec là 600 giây',
                isCorrect: true,
              },
              {
                content:
                  'Người học đã mở trang bài học trong ít nhất 90 giây',
                isCorrect: false,
              },
              {
                content:
                  'Trình duyệt gửi giá trị completed là true trong request',
                isCorrect: false,
              },
            ],
          },
          {
            content:
              'Một học viên sửa request trên trình duyệt để gửi điểm quiz là 100%. Cách thiết kế nào bảo đảm kết quả không bị giả mạo?',
            options: [
              {
                content:
                  'Server đối chiếu các lựa chọn đã nộp với đáp án đúng và tự tính điểm',
                isCorrect: true,
              },
              {
                content:
                  'Giao diện ẩn điểm cho đến khi học viên tải lại trang',
                isCorrect: false,
              },
              {
                content:
                  'Server chấp nhận điểm do trình duyệt gửi nếu request dùng HTTPS',
                isCorrect: false,
              },
            ],
          },
          {
            content:
              'Một request cập nhật tiến độ gửi lessonId không thuộc khóa học học viên đã ghi danh. Backend nên xử lý thế nào để bảo vệ ranh giới truy cập?',
            options: [
              {
                content:
                  'Xác thực quyền truy cập của học viên với bài học trước khi ghi nhận tiến độ',
                isCorrect: true,
              },
              {
                content:
                  'Lưu tiến độ trước rồi để giao diện ẩn bài học khỏi danh sách',
                isCorrect: false,
              },
              {
                content:
                  'Chỉ kiểm tra lessonId có đúng định dạng UUID hay không',
                isCorrect: false,
              },
            ],
          },
          {
            content:
              'Khi người học tải lại trang trong lúc làm quiz có giới hạn thời gian, nguồn nào nên được dùng để khôi phục thời hạn chính xác?',
            options: [
              {
                content:
                  'Thời điểm expiresAt do server lưu và trả về cho lượt làm bài',
                isCorrect: true,
              },
              {
                content:
                  'Thời gian còn lại được đếm lại từ đầu trong trình duyệt',
                isCorrect: false,
              },
              {
                content:
                  'Giá trị đồng hồ máy tính của người học tại thời điểm tải lại',
                isCorrect: false,
              },
            ],
          },
          {
            content:
              'Một API đăng ký tài khoản nhận email sai định dạng. Tại lớp nào nên kiểm tra dữ liệu để trả lỗi nhất quán trước khi chạy nghiệp vụ?',
            options: [
              {
                content:
                  'DTO kết hợp ValidationPipe tại ranh giới HTTP của ứng dụng',
                isCorrect: true,
              },
              {
                content:
                  'Chỉ kiểm tra thuộc tính input required trong trình duyệt',
                isCorrect: false,
              },
              {
                content:
                  'Lưu tài khoản trước rồi xóa nếu người dùng báo có lỗi',
                isCorrect: false,
              },
            ],
          },
          {
            content:
              'Hai request ghi danh đồng thời được gửi cho cùng một học viên và khóa học. Cơ chế nào bảo vệ dữ liệu khỏi tạo hai bản ghi?',
            options: [
              {
                content:
                  'Ràng buộc duy nhất trên userId và courseId cùng xử lý xung đột ở server',
                isCorrect: true,
              },
              {
                content:
                  'Ẩn nút ghi danh sau lần nhấn đầu tiên trên giao diện',
                isCorrect: false,
              },
              {
                content:
                  'Thêm thời gian chờ ngẫu nhiên trước khi lưu cả hai request',
                isCorrect: false,
              },
            ],
          },
        ],
      })
      .catch((error) => {
        if (
          !(error instanceof ConflictException) ||
          error.message !== 'This lesson already has a quiz'
        ) {
          throw error;
        }
      });
  }
  console.log(`Demo data ready in ${schema}`);
  console.log('Student: student@lms.demo');
} finally {
  if (source.isInitialized) await source.destroy();
}
