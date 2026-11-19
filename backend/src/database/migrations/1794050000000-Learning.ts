import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Learning1794050000000 implements MigrationInterface {
  name = 'Learning1794050000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE "lesson_progress" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "userId" uuid NOT NULL CONSTRAINT "FK_progress_user" REFERENCES "users"("id") ON DELETE CASCADE,
        "lessonId" uuid NOT NULL, "watchedSec" integer NOT NULL DEFAULT 0,
        "completed" boolean NOT NULL DEFAULT false, "completedAt" timestamptz,
        CONSTRAINT "UQ_progress_user_lesson" UNIQUE ("userId", "lessonId"),
        CONSTRAINT "CHK_progress_watched" CHECK ("watchedSec" >= 0),
        CONSTRAINT "CHK_progress_completion" CHECK ("completed" = ("completedAt" IS NOT NULL))
      );
      CREATE INDEX "IDX_progress_lesson_completed" ON "lesson_progress" ("lessonId", "completed");
      CREATE TABLE "quizzes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "lessonId" uuid NOT NULL,
        "passScore" integer NOT NULL, "timeLimitSec" integer,
        CONSTRAINT "UQ_quiz_lesson" UNIQUE ("lessonId"),
        CONSTRAINT "CHK_quiz_pass_score" CHECK ("passScore" BETWEEN 0 AND 100),
        CONSTRAINT "CHK_quiz_time_limit" CHECK ("timeLimitSec" IS NULL OR "timeLimitSec" >= 0)
      );
      CREATE TABLE "quiz_questions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "quizId" uuid NOT NULL CONSTRAINT "FK_question_quiz" REFERENCES "quizzes"("id") ON DELETE CASCADE,
        "content" text NOT NULL, "position" integer NOT NULL,
        CONSTRAINT "UQ_question_quiz_position" UNIQUE ("quizId", "position"),
        CONSTRAINT "CHK_question_position" CHECK ("position" >= 0),
        CONSTRAINT "CHK_question_content" CHECK (length(btrim("content")) > 0)
      );
      CREATE TABLE "quiz_options" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "questionId" uuid NOT NULL CONSTRAINT "FK_option_question" REFERENCES "quiz_questions"("id") ON DELETE CASCADE,
        "content" text NOT NULL, "position" integer NOT NULL, "isCorrect" boolean NOT NULL,
        CONSTRAINT "UQ_option_question_position" UNIQUE ("questionId", "position"),
        CONSTRAINT "UQ_option_question_id" UNIQUE ("questionId", "id"),
        CONSTRAINT "CHK_option_position" CHECK ("position" >= 0),
        CONSTRAINT "CHK_option_content" CHECK (length(btrim("content")) > 0)
      );
      CREATE UNIQUE INDEX "UQ_option_one_correct" ON "quiz_options" ("questionId") WHERE "isCorrect" = true;
      CREATE TABLE "quiz_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "quizId" uuid NOT NULL CONSTRAINT "FK_attempt_quiz" REFERENCES "quizzes"("id") ON DELETE CASCADE,
        "userId" uuid NOT NULL CONSTRAINT "FK_attempt_user" REFERENCES "users"("id") ON DELETE CASCADE,
        "score" integer, "passed" boolean, "startedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "submittedAt" timestamptz,
        CONSTRAINT "CHK_attempt_result" CHECK (
          ("submittedAt" IS NULL AND "score" IS NULL AND "passed" IS NULL) OR
          ("submittedAt" IS NOT NULL AND "score" IS NOT NULL AND "score" BETWEEN 0 AND 100 AND "passed" IS NOT NULL)
        )
      );
      CREATE INDEX "IDX_attempt_user_quiz" ON "quiz_attempts" ("userId", "quizId");
      CREATE TABLE "quiz_answers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "attemptId" uuid NOT NULL CONSTRAINT "FK_answer_attempt" REFERENCES "quiz_attempts"("id") ON DELETE CASCADE,
        "questionId" uuid NOT NULL CONSTRAINT "FK_answer_question" REFERENCES "quiz_questions"("id") ON DELETE CASCADE, "optionId" uuid,
        CONSTRAINT "UQ_answer_attempt_question" UNIQUE ("attemptId", "questionId"),
        CONSTRAINT "FK_answer_question_option" FOREIGN KEY ("questionId", "optionId") REFERENCES "quiz_options" ("questionId", "id")
      );
      CREATE TABLE "certificates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "userId" uuid NOT NULL CONSTRAINT "FK_certificate_user" REFERENCES "users"("id") ON DELETE CASCADE,
        "courseId" uuid NOT NULL, "serialNo" varchar(64) NOT NULL, "pdfKey" varchar(512), "issuedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UQ_certificate_user_course" UNIQUE ("userId", "courseId"),
        CONSTRAINT "UQ_certificate_serial" UNIQUE ("serialNo")
      );
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      'DROP TABLE "quiz_answers", "quiz_attempts", "quiz_options", "quiz_questions", "quizzes", "certificates", "lesson_progress"',
    );
  }
}
