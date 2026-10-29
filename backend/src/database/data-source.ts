import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'node:path';
import { User } from '../user/user.entity.js'; // import tường minh, tránh glob-ESM

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User /*, Course, Lesson, Enrolment... */],
  migrations: [join(import.meta.dirname, 'migrations', '*.{ts,js}')],
  synchronize: false, // KHÔNG bao giờ true
});
