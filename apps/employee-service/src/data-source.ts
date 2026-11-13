import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { fileURLToPath } from 'node:url';

import { databaseOptions } from './database.config.js';
import { User } from './users/entities/user.entity.js';
import { Employee } from './employees/entities/employee.entity.js';

const migrationPath = fileURLToPath(
  new URL('./migrations/*.js', import.meta.url),
);

export default new DataSource({
  ...databaseOptions,
  type: 'mysql',
  entities: [User, Employee],
  migrations: [migrationPath],
  synchronize: false,
  migrationsRun: false,
  migrationsTableName: 'migrations',
})