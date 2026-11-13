import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

const passwordFile =
  process.env.DB_PASSWORD_FILE ??
  resolve(process.cwd(), '../../docker/secrets/employee_db_password');

export const databaseOptions = {
  type: 'mysql',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? '3307'),
  username: process.env.DB_USER ?? 'employee_app',
  password: readFileSync(passwordFile, 'utf8').trim(),
  database: process.env.DB_NAME ?? 'employee_db',
  timezone: 'Z',
  autoLoadEntities: true,
  synchronize: false,
  logging: false,
} satisfies TypeOrmModuleOptions;
