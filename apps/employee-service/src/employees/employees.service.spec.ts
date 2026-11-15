import type { DataSource, Repository } from 'typeorm';

import { EmployeesService } from './employees.service.js';
import type { Employee } from './entities/employee.entity.js';

// Creates the service with a fake repository that returns these codes
function createService(codes: string[]) {
  const repository = {
    find: async () => codes.map((employeeCode) => ({ employeeCode })),
  } as unknown as Repository<Employee>;

  return new EmployeesService(repository, {} as DataSource);
}

describe('EmployeesService.getNextCode', () => {
  it('starts at EMP-0001 when there are no employees', async () => {
    const service = createService([]);

    expect(await service.getNextCode()).toEqual({ employeeCode: 'EMP-0001' });
  });

  it('adds 1 to the highest EMP-<number> code', async () => {
    const service = createService(['EMP-0003', 'EMP-0010', 'EMP-0007']);

    expect(await service.getNextCode()).toEqual({ employeeCode: 'EMP-0011' });
  });

  it('ignores codes in other formats', async () => {
    const service = createService(['EMP-DEMO-001', 'QA-abc', 'EMP-0002']);

    expect(await service.getNextCode()).toEqual({ employeeCode: 'EMP-0003' });
  });

  it('keeps the number of digits of longer codes', async () => {
    const service = createService(['EMP-0002737']);

    expect(await service.getNextCode()).toEqual({ employeeCode: 'EMP-0002738' });
  });
});

describe('EmployeesService.remove', () => {
  const deleted: string[] = [];

  // Fake employee repository + transaction that records what gets deleted
  function createServiceWith(employee: object | null) {
    const repository = {
      findOne: async () => employee,
    } as unknown as Repository<Employee>;

    const dataSource = {
      transaction: async (work: (manager: object) => Promise<void>) =>
        work({
          delete: async (entity: { name: string }) => {
            deleted.push(entity.name);
          },
        }),
    } as unknown as DataSource;

    return new EmployeesService(repository, dataSource);
  }

  // Fake answer from attendance-service
  function mockAttendance(records: unknown[]) {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(records)));
  }

  beforeEach(() => {
    deleted.length = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses to delete an active employee', async () => {
    const service = createServiceWith({ id: 1, isActive: true, user: { id: 9 } });
    mockAttendance([]);

    await expect(service.remove(1, 'Bearer x')).rejects.toThrow('Deactivate');
    expect(deleted).toEqual([]);
  });

  it('refuses to delete an employee with attendance records', async () => {
    const service = createServiceWith({ id: 1, isActive: false, user: { id: 9 } });
    mockAttendance([{ id: 1 }, { id: 2 }]);

    await expect(service.remove(1, 'Bearer x')).rejects.toThrow('2 attendance record(s)');
    expect(deleted).toEqual([]);
  });

  it('refuses to delete when attendance-service cannot be reached', async () => {
    const service = createServiceWith({ id: 1, isActive: false, user: { id: 9 } });
    vi.stubGlobal('fetch', async () => {
      throw new Error('connection refused');
    });

    await expect(service.remove(1, 'Bearer x')).rejects.toThrow('Cannot check attendance');
    expect(deleted).toEqual([]);
  });

  it('deletes the employee and the login account', async () => {
    const service = createServiceWith({ id: 1, isActive: false, user: { id: 9 } });
    mockAttendance([]);

    expect(await service.remove(1, 'Bearer x')).toEqual({ id: 1, deleted: true });
    expect(deleted).toEqual(['Employee', 'User']);
  });
});
