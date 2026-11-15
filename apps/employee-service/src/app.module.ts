import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { databaseOptions } from './database.config.js';

import { UsersModule } from './users/users.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseOptions),
    UsersModule,
    EmployeesModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
