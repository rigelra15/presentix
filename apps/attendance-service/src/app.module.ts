import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller.js';
import { databaseOptions } from './database.config.js';
import { AttendancesModule } from './attendances/attendances.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseOptions),
    AttendancesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
