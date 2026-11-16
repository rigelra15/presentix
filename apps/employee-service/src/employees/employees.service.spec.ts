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

describe('EmployeesService profile photo', () => {
  let photoDir: string;
  let saved: { photoPath: string | null };

  function photoFile(bytes: number[], mimetype: string) {
    return { buffer: Buffer.from(bytes), mimetype } as Express.Multer.File;
  }

  const jpeg = photoFile([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3], 'image/jpeg');

  function createPhotoService(employee: { photoPath: string | null } | null) {
    const repository = {
      findOne: async () => employee && { id: 1, isActive: true, user: { email: 'a@b.c' }, ...employee },
      update: async (_where: object, values: { photoPath: string }) => {
        saved = values;
      },
    } as unknown as Repository<Employee>;

    return new EmployeesService(repository, {} as DataSource);
  }

  beforeEach(async () => {
    const { mkdtemp } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    photoDir = await mkdtemp(`${tmpdir()}/employee-photos-`);
    process.env.EMPLOYEE_PHOTO_DIR = photoDir;
    saved = { photoPath: null };
  });

  afterEach(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(photoDir, { recursive: true, force: true });
    delete process.env.EMPLOYEE_PHOTO_DIR;
  });

  it('saves a JPEG with a random name and removes the old photo', async () => {
    const { readdir, writeFile } = await import('node:fs/promises');
    const oldName = '11111111-1111-1111-1111-111111111111.jpg';
    await writeFile(`${photoDir}/${oldName}`, 'old');

    const service = createPhotoService({ photoPath: oldName });
    const result = await service.setPhoto(1, jpeg);

    expect(result.hasPhoto).toBe(true);
    expect(saved.photoPath).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(await readdir(photoDir)).toEqual([saved.photoPath]);
  });

  it('refuses files that are not JPEG or PNG', async () => {
    const service = createPhotoService({ photoPath: null });
    const fakeJpeg = photoFile([0x3c, 0x73, 0x76, 0x67], 'image/jpeg');

    await expect(service.setPhoto(1, fakeJpeg)).rejects.toThrow('JPEG or PNG');
    await expect(service.setPhoto(1, undefined)).rejects.toThrow('JPEG or PNG');
  });

  it('returns 404 when the employee has no photo', async () => {
    const service = createPhotoService({ photoPath: null });

    await expect(service.getPhoto(1)).rejects.toThrow('Photo not found');
  });

  it('never reads a stored name outside the photo folder', async () => {
    const service = createPhotoService({ photoPath: '../../etc/passwd' });

    await expect(service.getPhoto(1)).rejects.toThrow('Photo not found');
  });
});
