import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVideos1795120000000 implements MigrationInterface {
  name = 'CreateVideos1795120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "videos_status_enum" AS ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "videos" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "lessonId" uuid NOT NULL, "originalKey" character varying(1024) NOT NULL, "thumbnailKey" character varying(1024), "durationSec" integer, "status" "videos_status_enum" NOT NULL, "error" character varying(1000), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_videos_id" PRIMARY KEY ("id"), CONSTRAINT "FK_videos_lesson" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_videos_lessonId" ON "videos" ("lessonId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_videos_status" ON "videos" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "FK_videos_lesson"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_videos_status"`);
    await queryRunner.query(`DROP INDEX "UQ_videos_lessonId"`);
    await queryRunner.query(`DROP TABLE "videos"`);
    await queryRunner.query(`DROP TYPE "videos_status_enum"`);
  }
}
