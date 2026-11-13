
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { fileURLToPath } from 'node:url';

import { databaseOptions } from './database.config.js';
import { Attendance } from './attendances/entities/attendance.entity.js';

const migrationsPath = fileURLToPath(
  new URL('./migrations/*.js', import.meta.url),
);

export default new DataSource({
  ...databaseOptions,
  type: 'mysql',
  entities: [Attendance],
  migrations: [migrationsPath],
  synchronize: false,
  migrationsRun: false,
  migrationsTableName: 'migrations',
});
