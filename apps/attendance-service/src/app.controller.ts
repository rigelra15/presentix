import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly dataSource: DataSource) {}

  // Health check: is the service running and can it reach its database?
  @Get('health')
  async health() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Database is not reachable');
    }

    return { status: 'ok', service: 'attendance-service' };
  }
}
