import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateQnaAndNotifications1795083911581 implements MigrationInterface {
    name = 'CreateQnaAndNotifications1795083911581'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "qna_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "threadId" uuid NOT NULL, "authorId" uuid NOT NULL, "content" character varying(5000) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_359d03cedc6240d972ab488e108" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7393bf4e560626d2a7d80ff1e4" ON "qna_posts" ("threadId")`);
        await queryRunner.query(`CREATE INDEX "IDX_11227b28e437ab64a45bbfb4d6" ON "qna_posts" ("authorId")`);
        await queryRunner.query(`CREATE INDEX "IDX_b417f9d9d2bac9517eb7f61767" ON "qna_posts" ("threadId", "createdAt")`);
        await queryRunner.query(`CREATE TABLE "qna_threads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "courseId" uuid NOT NULL, "lessonId" uuid, "authorId" uuid NOT NULL, "title" character varying(200) NOT NULL, "resolved" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e13c242054ad8bf7a8f8a5503bf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0d0bf80f6e77b0f4eb06c465d3" ON "qna_threads" ("courseId")`);
        await queryRunner.query(`CREATE INDEX "IDX_c1b6af287d236b3b42215dc275" ON "qna_threads" ("authorId")`);
        await queryRunner.query(`CREATE INDEX "IDX_af0263eeb424e31aeea980fb28" ON "qna_threads" ("courseId", "createdAt")`);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "type" character varying(100) NOT NULL, "payload" jsonb NOT NULL, "read" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_692a909ee0fa9383e7859f9b40" ON "notifications" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_b055cfdba5009facbb972837dd" ON "notifications" ("userId", "read", "createdAt")`);
        await queryRunner.query(`ALTER TABLE "qna_posts" ADD CONSTRAINT "FK_7393bf4e560626d2a7d80ff1e4e" FOREIGN KEY ("threadId") REFERENCES "qna_threads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "qna_posts" DROP CONSTRAINT "FK_7393bf4e560626d2a7d80ff1e4e"`);
        await queryRunner.query(`DROP INDEX "IDX_b055cfdba5009facbb972837dd"`);
        await queryRunner.query(`DROP INDEX "IDX_692a909ee0fa9383e7859f9b40"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP INDEX "IDX_af0263eeb424e31aeea980fb28"`);
        await queryRunner.query(`DROP INDEX "IDX_c1b6af287d236b3b42215dc275"`);
        await queryRunner.query(`DROP INDEX "IDX_0d0bf80f6e77b0f4eb06c465d3"`);
        await queryRunner.query(`DROP TABLE "qna_threads"`);
        await queryRunner.query(`DROP INDEX "IDX_b417f9d9d2bac9517eb7f61767"`);
        await queryRunner.query(`DROP INDEX "IDX_11227b28e437ab64a45bbfb4d6"`);
        await queryRunner.query(`DROP INDEX "IDX_7393bf4e560626d2a7d80ff1e4"`);
        await queryRunner.query(`DROP TABLE "qna_posts"`);
    }
}
