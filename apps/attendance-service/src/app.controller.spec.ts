import type { DataSource } from 'typeorm';
import { AppController } from './app.controller.js';

describe('AppController.health', () => {
  it('returns ok when the database answers', async () => {
    const dataSource = { query: async () => [{ 1: 1 }] } as unknown as DataSource;
    const controller = new AppController(dataSource);

    expect(await controller.health()).toEqual({ status: 'ok', service: 'attendance-service' });
  });

  it('returns 503 when the database is down', async () => {
    const dataSource = {
      query: async () => {
        throw new Error('connection refused');
      },
    } as unknown as DataSource;
    const controller = new AppController(dataSource);

    await expect(controller.health()).rejects.toThrow('Database is not reachable');
  });
});
