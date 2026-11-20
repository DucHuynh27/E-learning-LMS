import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Catalog1794100000000 implements MigrationInterface {
  name = 'Catalog1794100000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TYPE "courses_status_enum" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');
      CREATE TYPE "lessons_type_enum" AS ENUM('VIDEO', 'ARTICLE', 'QUIZ');
      CREATE TYPE "enrolments_status_enum" AS ENUM('ACTIVE', 'COMPLETED', 'EXPIRED');

      CREATE TABLE "courses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar(200) NOT NULL,
        "slug" varchar(255) NOT NULL,
        "description" text,
        "thumbnailKey" varchar(512),
        "priceCents" integer NOT NULL DEFAULT 0,
        "status" "courses_status_enum" NOT NULL DEFAULT 'DRAFT',
        "instructorId" uuid NOT NULL CONSTRAINT "FK_course_instructor" REFERENCES "users"("id") ON DELETE RESTRICT,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_course_slug" UNIQUE ("slug"),
        CONSTRAINT "CHK_course_price" CHECK ("priceCents" >= 0)
      );
      CREATE INDEX "IDX_courses_instructor" ON "courses" ("instructorId");
      CREATE INDEX "IDX_courses_status_created" ON "courses" ("status", "createdAt");

      CREATE TABLE "sections" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "courseId" uuid NOT NULL CONSTRAINT "FK_section_course" REFERENCES "courses"("id") ON DELETE CASCADE,
        "title" varchar(200) NOT NULL,
        "position" integer NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_section_course_position" UNIQUE ("courseId", "position"),
        CONSTRAINT "CHK_section_position" CHECK ("position" >= 0)
      );
      CREATE INDEX "IDX_sections_course" ON "sections" ("courseId");

      CREATE TABLE "lessons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sectionId" uuid NOT NULL CONSTRAINT "FK_lesson_section" REFERENCES "sections"("id") ON DELETE CASCADE,
        "title" varchar(200) NOT NULL,
        "type" "lessons_type_enum" NOT NULL DEFAULT 'ARTICLE',
        "position" integer NOT NULL,
        "durationSec" integer NOT NULL DEFAULT 0,
        "isPublished" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_lesson_section_position" UNIQUE ("sectionId", "position"),
        CONSTRAINT "CHK_lesson_position" CHECK ("position" >= 0),
        CONSTRAINT "CHK_lesson_duration" CHECK ("durationSec" >= 0)
      );
      CREATE INDEX "IDX_lessons_section" ON "lessons" ("sectionId");

      CREATE TABLE "enrolments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL CONSTRAINT "FK_enrolment_user" REFERENCES "users"("id") ON DELETE CASCADE,
        "courseId" uuid NOT NULL CONSTRAINT "FK_enrolment_course" REFERENCES "courses"("id") ON DELETE CASCADE,
        "status" "enrolments_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "progressPct" integer NOT NULL DEFAULT 0,
        "enrolledAt" timestamptz NOT NULL DEFAULT now(),
        "completedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_enrolment_user_course" UNIQUE ("userId", "courseId"),
        CONSTRAINT "CHK_enrolment_progress" CHECK ("progressPct" BETWEEN 0 AND 100)
      );
      CREATE INDEX "IDX_enrolments_course_status" ON "enrolments" ("courseId", "status");
      CREATE INDEX "IDX_enrolments_user" ON "enrolments" ("userId");
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      DROP TABLE "enrolments";
      DROP TABLE "lessons";
      DROP TABLE "sections";
      DROP TABLE "courses";
      DROP TYPE "enrolments_status_enum";
      DROP TYPE "lessons_type_enum";
      DROP TYPE "courses_status_enum";
    `);
  }
}
