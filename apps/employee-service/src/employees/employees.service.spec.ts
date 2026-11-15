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
