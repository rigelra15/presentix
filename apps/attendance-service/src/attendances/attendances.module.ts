import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Attendance } from './entities/attendance.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance])
  ]
})
export class AttendancesModule {}
