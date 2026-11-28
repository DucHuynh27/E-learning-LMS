import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLessonTheory1795300000000 implements MigrationInterface {
  name = 'AddLessonTheory1795300000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      'ALTER TABLE "lessons" ADD COLUMN "content" text NULL',
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE "lessons" DROP COLUMN "content"');
  }
}
