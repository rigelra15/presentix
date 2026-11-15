import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Attendance } from './entities/attendance.entity.js';
import { AttendancesController } from './attendances.controller.js';
import { AttendancesService } from './attendances.service.js';
import { AttendanceAuthGuard } from '../auth/attendance-auth.guard.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance])
  ],
  controllers: [AttendancesController],
  providers: [AttendancesService, AttendanceAuthGuard],
})
export class AttendancesModule {}
