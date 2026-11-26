import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkLearningToCatalog1795200000000 implements MigrationInterface {
  name = 'LinkLearningToCatalog1795200000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE "lesson_progress" ADD CONSTRAINT "FK_progress_lesson"
        FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE;
      ALTER TABLE "quizzes" ADD CONSTRAINT "FK_quiz_lesson"
        FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE;
      CREATE INDEX "IDX_certificate_course" ON "certificates" ("courseId");
      ALTER TABLE "certificates" ADD CONSTRAINT "FK_certificate_course"
        FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT;
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE "certificates" DROP CONSTRAINT "FK_certificate_course";
      DROP INDEX "IDX_certificate_course";
      ALTER TABLE "quizzes" DROP CONSTRAINT "FK_quiz_lesson";
      ALTER TABLE "lesson_progress" DROP CONSTRAINT "FK_progress_lesson";
    `);
  }
}
