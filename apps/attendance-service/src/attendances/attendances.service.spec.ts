import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Repository } from 'typeorm';

import { AttendancesService } from './attendances.service.js';
import type { Attendance } from './entities/attendance.entity.js';
import type { SessionUser } from '../auth/attendance-auth.guard.js';

const employee: SessionUser = { id: 10, email: 'a@test', role: 'EMPLOYEE', employeeId: 5 };
const hrd: SessionUser = { id: 1, email: 'h@test', role: 'HRD' };

// Smallest valid JPEG start (the service only checks the first bytes)
const jpegFile = jpeg('photo');

// JPEG start + some text, so each test image has different bytes
function jpeg(text: string) {
  return {
    buffer: Buffer.concat([Buffer.from('ffd8ffe000104a464946', 'hex'), Buffer.from(text)]),
    mimetype: 'image/jpeg',
  } as Express.Multer.File;
}

// A valid check-in form. Tests change one field at a time.
function validBody(): Record<string, string> {
  return {
    latitude: '-6.175392',
    longitude: '106.827153',
    accuracy: '18',
    note: 'Finish the monthly report',
    // Uploaded photo: no face check needed (see the liveness tests below)
    photoSource: 'UPLOAD',
  };
}

// Fake repository. "existing" is returned by findOneBy (e.g. today's check-in).
function createService(existing: Partial<Attendance> | null = null) {
  const saved: Partial<Attendance>[] = [];
  let lastFindOptions: unknown = null;

  const repository = {
    findOneBy: async () => existing,
    create: (data: Partial<Attendance>) => data,
    save: async (data: Partial<Attendance>) => {
      const row = { id: 1, createdAt: new Date(), ...data };
      saved.push(row);
      return row;
    },
    find: async (options: unknown) => {
      lastFindOptions = options;
      return [];
    },
  } as unknown as Repository<Attendance>;

  return {
    service: new AttendancesService(repository),
    saved,
    getLastFindOptions: () => lastFindOptions,
  };
}

describe('AttendancesService.create', () => {
  let photoDir: string;

  beforeEach(async () => {
    // Photos are written to a temporary folder, not the real storage
    photoDir = await mkdtemp(join(tmpdir(), 'attendance-test-'));
    process.env.ATTENDANCE_PHOTO_DIR = photoDir;
  });

  afterEach(async () => {
    delete process.env.ATTENDANCE_PHOTO_DIR;
    await rm(photoDir, { recursive: true, force: true });
  });

  it('saves a valid check-in with location, note and photo source', async () => {
    const { service, saved } = createService();

    const result = await service.create(employee, validBody(), { photo: [jpegFile] });

    expect(result.latitude).toBe(-6.175392);
    expect(result.note).toBe('Finish the monthly report');
    expect(result.photoSource).toBe('UPLOAD');
    expect(result.livenessChecked).toBe(false);
    expect(saved[0].employeeId).toBe(5);
    expect(await readdir(photoDir)).toHaveLength(1);
  });

  it('only allows employees to check in', async () => {
    const { service } = createService();

    await expect(service.create(hrd, validBody(), { photo: [jpegFile] })).rejects.toThrow('Only employees');
  });

  it('rejects a missing or invalid location', async () => {
    const { service } = createService();

    await expect(
      service.create(employee, { ...validBody(), latitude: '' }, { photo: [jpegFile] }),
    ).rejects.toThrow('Latitude');
    await expect(
      service.create(employee, { ...validBody(), longitude: '200' }, { photo: [jpegFile] }),
    ).rejects.toThrow('Longitude');
  });

  it('rejects a note that is too short', async () => {
    const { service } = createService();

    await expect(
      service.create(employee, { ...validBody(), note: ' a ' }, { photo: [jpegFile] }),
    ).rejects.toThrow('Note must be 3 to 500 characters');
  });

  it('rejects an unknown photo source', async () => {
    const { service } = createService();

    await expect(
      service.create(employee, { ...validBody(), photoSource: 'GALLERY' }, { photo: [jpegFile] }),
    ).rejects.toThrow('photoSource');
  });

  it('rejects a file that is not really an image', async () => {
    const { service } = createService();
    const fakeImage = {
      buffer: Buffer.from('not an image'),
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    await expect(service.create(employee, validBody(), { photo: [fakeImage] })).rejects.toThrow(
      'Photo must be a JPEG or PNG image',
    );
  });

  it('allows only one check-in per day', async () => {
    const { service } = createService({ id: 99 });

    await expect(service.create(employee, validBody(), { photo: [jpegFile] })).rejects.toThrow(
      'already checked in today',
    );
    expect(await readdir(photoDir)).toHaveLength(0);
  });
});

describe('AttendancesService.create with the face check', () => {
  let photoDir: string;

  beforeEach(async () => {
    photoDir = await mkdtemp(join(tmpdir(), 'attendance-test-'));
    process.env.ATTENDANCE_PHOTO_DIR = photoDir;
    // Only the clock is faked, so the challenge age can be controlled
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(async () => {
    vi.useRealTimers();
    delete process.env.ATTENDANCE_PHOTO_DIR;
    await rm(photoDir, { recursive: true, force: true });
  });

  const cameraBody = (challengeId: string) => ({ ...validBody(), photoSource: 'CAMERA', challengeId });
  const cameraFiles = () => ({
    photo: [jpeg('front')],
    livenessLeft: [jpeg('left')],
    livenessRight: [jpeg('right')],
  });
  const wait = (ms: number) => vi.setSystemTime(Date.now() + ms);

  it('gives the head turns in a random order', () => {
    const { service } = createService();
    const challenge = service.createLivenessChallenge(employee);

    expect([...challenge.steps].sort()).toEqual(['LEFT', 'RIGHT']);
    expect(() => service.createLivenessChallenge(hrd)).toThrow('Only employees');
  });

  it('saves a camera check-in with both face check frames', async () => {
    const { service, saved } = createService();
    const { challengeId } = service.createLivenessChallenge(employee);
    wait(5000);

    const result = await service.create(employee, cameraBody(challengeId), cameraFiles());

    expect(result.livenessChecked).toBe(true);
    expect(saved[0].livenessLeftPath).toMatch(/\.jpg$/);
    expect(await readdir(photoDir)).toHaveLength(3);
  });

  it('needs a challenge and the frames for a camera check-in', async () => {
    const { service } = createService();
    const { challengeId } = service.createLivenessChallenge(employee);
    wait(5000);

    await expect(
      service.create(employee, cameraBody('made-up'), cameraFiles()),
    ).rejects.toThrow('face check is missing');
    await expect(
      service.create(employee, cameraBody(challengeId), { photo: [jpeg('front')] }),
    ).rejects.toThrow('Face check photos are missing');
  });

  it('uses a challenge only once', async () => {
    const { service } = createService();
    const { challengeId } = service.createLivenessChallenge(employee);
    wait(5000);

    await service.create(employee, cameraBody(challengeId), cameraFiles());

    await expect(
      service.create(employee, cameraBody(challengeId), cameraFiles()),
    ).rejects.toThrow('already used');
  });

  it("rejects another employee's, an old or a too quick challenge", async () => {
    const { service } = createService();
    const other = service.createLivenessChallenge({ ...employee, employeeId: 6 });
    const quick = service.createLivenessChallenge(employee);

    await expect(
      service.create(employee, cameraBody(quick.challengeId), cameraFiles()),
    ).rejects.toThrow('too quickly');

    wait(11 * 60 * 1000);

    await expect(
      service.create(employee, cameraBody(other.challengeId), cameraFiles()),
    ).rejects.toThrow('already used');
    await expect(
      service.create(employee, cameraBody(quick.challengeId), cameraFiles()),
    ).rejects.toThrow('took too long');
  });

  it('rejects the same picture sent as every frame', async () => {
    const { service } = createService();
    const { challengeId } = service.createLivenessChallenge(employee);
    wait(5000);

    await expect(
      service.create(employee, cameraBody(challengeId), {
        photo: [jpeg('same')],
        livenessLeft: [jpeg('same')],
        livenessRight: [jpeg('same')],
      }),
    ).rejects.toThrow('must be different');
    expect(await readdir(photoDir)).toHaveLength(0);
  });
});

describe('AttendancesService.findAll', () => {
  it('is only for HRD', async () => {
    const { service } = createService();

    await expect(service.findAll(employee)).rejects.toThrow();
  });

  it('filters by employee when employeeId is given', async () => {
    const { service, getLastFindOptions } = createService();

    await service.findAll(hrd, '5');

    expect(getLastFindOptions()).toMatchObject({ where: { employeeId: 5 } });
  });

  it('rejects an invalid employeeId', async () => {
    const { service } = createService();

    await expect(service.findAll(hrd, 'abc')).rejects.toThrow('employeeId is invalid');
  });
});

describe('AttendancesService.findOne', () => {
  it("does not show another employee's check-in", async () => {
    const { service } = createService({ id: 1, employeeId: 6 });

    await expect(service.findOne(1, employee)).rejects.toThrow('Attendance not found');
  });

  it('shows the check-in to its owner and to HRD', async () => {
    const record = { id: 1, employeeId: 5, latitude: null, longitude: null };
    const { service } = createService(record);

    expect((await service.findOne(1, employee)).id).toBe(1);
    expect((await service.findOne(1, hrd)).id).toBe(1);
  });
});

describe('AttendancesService.checkOut', () => {
  it("checks out today's check-in", async () => {
    const { service, saved } = createService({ id: 1, employeeId: 5, checkedOutAt: null });

    const result = await service.checkOut(employee);

    expect(result.checkedOutAt).toBeInstanceOf(Date);
    expect(saved).toHaveLength(1);
  });

  it('needs a check-in today first', async () => {
    const { service } = createService(null);

    await expect(service.checkOut(employee)).rejects.toThrow('not checked in today');
  });

  it('allows only one check-out per day', async () => {
    const { service } = createService({ id: 1, employeeId: 5, checkedOutAt: new Date() });

    await expect(service.checkOut(employee)).rejects.toThrow('already checked out');
  });

  it('is only for employees', async () => {
    const { service } = createService({ id: 1, employeeId: 5, checkedOutAt: null });

    await expect(service.checkOut(hrd)).rejects.toThrow('Only employees');
  });
});
