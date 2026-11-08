import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { User } from '../../user/user.entity.js';
import { Learning1794050000000 } from '../../database/migrations/1794050000000-Learning.js';
import { LEARNING_ENTITIES } from '../learning.entities.js';

export async function createHttpTestDatabase(): Promise<DataSource> {
  const schema = `learning_http_${randomUUID().replaceAll('-', '')}`;
  const source = new DataSource({
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
  try {
    await source.initialize();
    await source.query(`CREATE SCHEMA "${schema}"`);
    if (
      (await source.query('SELECT current_schema() AS name'))[0].name !== schema
    )
      throw new Error('Unexpected HTTP test schema');
    // Auth uses its real entity; Catalog tables below are fixtures of the agreed contract.
    await source.query(`
      CREATE TYPE "users_role_enum" AS ENUM ('STUDENT', 'INSTRUCTOR', 'ADMIN');
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "email" varchar(255) NOT NULL UNIQUE,
        "passwordHash" varchar(255) NOT NULL, "fullName" varchar(255) NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'STUDENT', "avatarUrl" varchar(512),
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now());
      CREATE TYPE "fixture_course_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
      CREATE TYPE "fixture_enrolment_status" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED');
      CREATE TABLE "courses" ("id" uuid PRIMARY KEY, "instructorId" uuid NOT NULL REFERENCES "users"("id"), "status" "fixture_course_status" NOT NULL);
      CREATE TABLE "sections" ("id" uuid PRIMARY KEY, "courseId" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE, "position" integer NOT NULL);
      CREATE TABLE "lessons" ("id" uuid PRIMARY KEY, "sectionId" uuid NOT NULL REFERENCES "sections"("id") ON DELETE CASCADE,
        "position" integer NOT NULL, "durationSec" integer NOT NULL, "isPublished" boolean NOT NULL);
      CREATE TABLE "enrolments" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "userId" uuid NOT NULL REFERENCES "users"("id"),
        "courseId" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE, "status" "fixture_enrolment_status" NOT NULL DEFAULT 'ACTIVE',
        "progressPct" integer NOT NULL DEFAULT 0, "completedAt" timestamptz, UNIQUE ("userId", "courseId"));
    `);
    await source.runMigrations({ transaction: 'all' });
    return source;
  } catch (error) {
    await destroyHttpTestDatabase(source);
    throw error;
  }
}

export async function destroyHttpTestDatabase(
  source: DataSource,
): Promise<void> {
  const schema = 'schema' in source.options ? source.options.schema : undefined;
  if (!schema || !/^learning_http_[a-f0-9]{32}$/.test(schema))
    throw new Error('Refusing to drop an unowned schema');
  if (source.isInitialized) {
    try {
      await source.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await source.destroy();
    }
  }
}
