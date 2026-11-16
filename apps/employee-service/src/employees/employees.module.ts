import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Employee } from './entities/employee.entity.js';
import { EmployeesController } from './employees.controller.js';
import { MyProfileController } from './my-profile.controller.js';
import { EmployeesService } from './employees.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee]),
    AuthModule
  ],
  controllers: [EmployeesController, MyProfileController],
  providers: [EmployeesService],
  exports: [TypeOrmModule],
})
export class EmployeesModule {}
