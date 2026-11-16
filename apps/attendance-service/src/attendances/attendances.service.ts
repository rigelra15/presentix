import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from 'node:path';
import { QueryFailedError } from "typeorm";
import type { Repository } from "typeorm";

import { Attendance } from "./entities/attendance.entity.js";
import { getImageExtension } from "./image-type.js";
import { LivenessChallenges } from "./liveness-challenges.js";
import type { SessionUser } from "../auth/attendance-auth.guard.js";

// Files of one check-in (multipart form fields)
export interface CheckInFiles {
  photo?: Express.Multer.File[];
  // Face check frames: the employee turned their head left and right
  livenessLeft?: Express.Multer.File[];
  livenessRight?: Express.Multer.File[];
}

// Stored file names are random UUIDs, checked again before reading a file
const PHOTO_NAME = /^[0-9a-f-]{36}\.(jpg|png)$/;

@Injectable()
export class AttendancesService {
  private readonly photoDir =
    process.env.ATTENDANCE_PHOTO_DIR ??
    resolve(process.cwd(), '../../storage/attendance-photos');

  private readonly liveness = new LivenessChallenges();

  constructor(
    @InjectRepository(Attendance)
    private readonly attendances: Repository<Attendance>,
  ) { }

  private toResponse(attendance: Attendance) {
    return {
      id: attendance.id,
      employeeId: attendance.employeeId,
      attendanceDate: attendance.attendanceDate,
      checkedInAt: attendance.checkedInAt,
      checkedOutAt: attendance.checkedOutAt ?? null,
      createdAt: attendance.createdAt,
      latitude:
        attendance.latitude === null ? null : Number(attendance.latitude),
      longitude:
        attendance.longitude === null ? null : Number(attendance.longitude),
      locationAccuracy: attendance.locationAccuracy,
      note: attendance.note,
      photoSource: attendance.photoSource,
      photoUrl: `/attendances/${attendance.id}/photo`,
      // true = the employee passed the head-turn face check
      livenessChecked: attendance.livenessLeftPath !== null,
    };
  }

  // Read a number from a multipart form field and check its range.
  private parseNumber(
    value: string | undefined,
    name: string,
    min: number,
    max: number,
  ): number {
    const number = Number(value);

    if (!value || Number.isNaN(number) || number < min || number > max) {
      throw new BadRequestException(`${name} is missing or invalid`);
    }

    return number;
  }

  private getWibDate(date: Date): string {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const parts = Object.fromEntries(
      formatter
        .formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );

    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  private async getAuthorizedAttendance(
    id: number,
    user: SessionUser,
  ): Promise<Attendance> {
    const attendance = await this.attendances.findOneBy({ id });

    if (!attendance) {
      throw new NotFoundException('Attendance not found');
    }

    if (
      user.role !== 'HRD' &&
      (
        user.role !== 'EMPLOYEE' ||
        attendance.employeeId !== user.employeeId
      )
    ) {
      throw new NotFoundException('Attendance not found');
    }

    return attendance
  }

  async create(
    user: SessionUser,
    body: Record<string, string>,
    files: CheckInFiles,
  ) {
    if (user.role !== 'EMPLOYEE' || !user.employeeId) {
      throw new ForbiddenException(
        'Only employees can check in',
      );
    }

    // GPS location is required for every new check-in
    const latitude = this.parseNumber(body.latitude, 'Latitude', -90, 90);
    const longitude = this.parseNumber(body.longitude, 'Longitude', -180, 180);
    const accuracy = this.parseNumber(body.accuracy, 'Accuracy', 0, 100000);

    // Today's agenda is required too
    const note = (body.note ?? '').trim();

    if (note.length < 3 || note.length > 500) {
      throw new BadRequestException('Note must be 3 to 500 characters');
    }

    // How the photo was taken. This comes from the browser, so it is only
    // a label for HRD, not a proof.
    const photoSource = body.photoSource;

    if (photoSource !== 'CAMERA' && photoSource !== 'UPLOAD') {
      throw new BadRequestException('photoSource must be CAMERA or UPLOAD');
    }

    const photo = files.photo?.[0];

    if (!photo?.buffer?.length) {
      throw new BadRequestException('Photo is required');
    }

    const photoExtension = getImageExtension(photo);

    if (!photoExtension) {
      throw new BadRequestException(
        'Photo must be a JPEG or PNG image',
      );
    }

    // A camera check-in must include the face check. An uploaded photo
    // (only offered when the camera does not work) has none, and HRD
    // sees that it was uploaded.
    const frames: { file: Express.Multer.File; extension: 'jpg' | 'png' }[] = [];

    if (photoSource === 'CAMERA') {
      for (const frame of [files.livenessLeft?.[0], files.livenessRight?.[0]]) {
        const extension = frame?.buffer?.length ? getImageExtension(frame) : null;

        if (!frame || !extension) {
          throw new BadRequestException('Face check photos are missing or invalid');
        }

        frames.push({ file: frame, extension });
      }

      // The three pictures must be different (not one image sent 3 times)
      const [left, right] = frames.map(frame => frame.file.buffer);

      if (left.equals(right) || left.equals(photo.buffer) || right.equals(photo.buffer)) {
        throw new BadRequestException('Face check photos must be different pictures');
      }

      // Checked last, so a typo in another field does not use up the challenge
      const livenessError = this.liveness.use(body.challengeId, user.employeeId);

      if (livenessError) {
        throw new BadRequestException(livenessError);
      }
    }

    const now = new Date();
    const attendanceDate = this.getWibDate(now);

    const existing = await this.attendances.findOneBy({
      employeeId: user.employeeId,
      attendanceDate,
    });

    if (existing) {
      throw new ConflictException(
        'You have already checked in today',
      )
    }

    await mkdir(this.photoDir, {
      recursive: true,
      mode: 0o700,
    });

    // Photo first, then the face check frames (if any)
    const toSave = [
      { buffer: photo.buffer, name: `${randomUUID()}.${photoExtension}` },
      ...frames.map(frame => ({
        buffer: frame.file.buffer,
        name: `${randomUUID()}.${frame.extension}`,
      })),
    ];
    const written: string[] = [];

    try {
      for (const item of toSave) {
        const filepath = join(this.photoDir, item.name);
        await writeFile(filepath, item.buffer, { flag: 'wx', mode: 0o600 });
        written.push(filepath);
      }

      const attendance = this.attendances.create({
        employeeId: user.employeeId,
        attendanceDate,
        checkedInAt: now,
        photoPath: toSave[0].name,
        livenessLeftPath: toSave[1]?.name ?? null,
        livenessRightPath: toSave[2]?.name ?? null,
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
        locationAccuracy: Math.round(accuracy),
        note,
        photoSource,
      });

      const saved = await this.attendances.save(attendance);

      return this.toResponse(saved);
    } catch (error) {
      // Do not keep files of a check-in that was not saved
      for (const filepath of written) {
        await rm(filepath, { force: true }).catch(() => undefined);
      }

      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code ===
          'ER_DUP_ENTRY'
      ) {
        throw new ConflictException(
          'You have already checked in today',
        );
      }

      throw error;
    }
  }

  // Step 1 of a camera check-in: which way to turn the head, in which order
  createLivenessChallenge(user: SessionUser) {
    if (user.role !== 'EMPLOYEE' || !user.employeeId) {
      throw new ForbiddenException('Only employees can check in');
    }

    return this.liveness.create(user.employeeId);
  }

  // Check out = the employee finished work today.
  // Only today's check-in (Asia/Jakarta date) can be checked out, once.
  async checkOut(user: SessionUser) {
    if (user.role !== 'EMPLOYEE' || !user.employeeId) {
      throw new ForbiddenException('Only employees can check out');
    }

    const now = new Date();

    const attendance = await this.attendances.findOneBy({
      employeeId: user.employeeId,
      attendanceDate: this.getWibDate(now),
    });

    if (!attendance) {
      throw new BadRequestException('You have not checked in today');
    }

    if (attendance.checkedOutAt) {
      throw new ConflictException('You have already checked out today');
    }

    attendance.checkedOutAt = now;
    const saved = await this.attendances.save(attendance);

    return this.toResponse(saved);
  }

  async findMine(user: SessionUser) {
    if (user.role !== 'EMPLOYEE' || !user.employeeId) {
      throw new ForbiddenException();
    }

    const rows = await this.attendances.find({
      where: { employeeId: user.employeeId },
      order: { checkedInAt: 'DESC' },
    });

    return rows.map((row) => this.toResponse(row));
  }

  async findAll(user: SessionUser, employeeId?: string) {
    if (user.role !== 'HRD') {
      throw new ForbiddenException();
    }

    // Without the filter, all attendance is returned
    let where = {};

    if (employeeId !== undefined) {
      const id = Number(employeeId);

      if (!Number.isInteger(id) || id < 1) {
        throw new BadRequestException('employeeId is invalid');
      }

      where = { employeeId: id };
    }

    const rows = await this.attendances.find({
      where,
      order: { checkedInAt: 'DESC' },
    });

    return rows.map((row) => this.toResponse(row));
  }

  async findOne(id: number, user: SessionUser) {
    const attendance =
      await this.getAuthorizedAttendance(id, user);

    return this.toResponse(attendance);
  }

  // which: the check-in photo, or one of the face check frames
  async getPhoto(
    id: number,
    user: SessionUser,
    which: 'photo' | 'left' | 'right' = 'photo',
  ) {
    const attendance =
      await this.getAuthorizedAttendance(id, user);

    const filename =
      which === 'left'
        ? attendance.livenessLeftPath
        : which === 'right'
          ? attendance.livenessRightPath
          : attendance.photoPath;

    if (!filename || !PHOTO_NAME.test(filename)) {
      throw new NotFoundException('Photo not found');
    }

    let content: Buffer;

    try {
      content = await readFile(join(this.photoDir, filename));
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        throw new NotFoundException('Photo not found');
      }

      throw error;
    }

    return new StreamableFile(content, {
      type: filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
      disposition: 'inline',
    });
  }
}
