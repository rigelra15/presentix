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
import type { SessionUser } from "../auth/attendance-auth.guard.js";

@Injectable()
export class AttendancesService {
  private readonly photoDir =
    process.env.ATTENDANCE_PHOTO_DIR ??
    resolve(process.cwd(), '../../storage/attendance-photos');

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
      createdAt: attendance.createdAt,
      latitude:
        attendance.latitude === null ? null : Number(attendance.latitude),
      longitude:
        attendance.longitude === null ? null : Number(attendance.longitude),
      locationAccuracy: attendance.locationAccuracy,
      note: attendance.note,
      photoSource: attendance.photoSource,
      photoUrl: `/attendances/${attendance.id}/photo`,
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
    file?: Express.Multer.File,
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

    if (!file?.buffer?.length) {
      throw new BadRequestException('Photo is required');
    }

    const pngSignature = Buffer.from(
      '89504e470d0a1a0a',
      'hex',
    );

    const isPng =
      file.buffer.subarray(0, 8).equals(pngSignature);

    const isJpeg =
      file.buffer.length >= 3 &&
      file.buffer[0] === 0xff &&
      file.buffer[1] === 0xd8 &&
      file.buffer[2] === 0xff;

    if (
      (!isPng && !isJpeg) ||
      (isPng && file.mimetype !== 'image/png') ||
      (isJpeg && file.mimetype !== 'image/jpeg')
    ) {
      throw new BadRequestException(
        'Photo must be a JPEG or PNG image',
      );
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

    const filename =
      `${randomUUID()}.${isPng ? 'png' : 'jpg'}`;

    await mkdir(this.photoDir, {
      recursive: true,
      mode: 0o700,
    });

    const filepath = join(this.photoDir, filename);

    try {
      await writeFile(filepath, file.buffer, {
        flag: 'wx',
        mode: 0o600,
      });

      const attendance = this.attendances.create({
        employeeId: user.employeeId,
        attendanceDate,
        checkedInAt: now,
        photoPath: filename,
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
        locationAccuracy: Math.round(accuracy),
        note,
        photoSource,
      });

      const saved = await this.attendances.save(attendance);

      return this.toResponse(saved);
    } catch (error) {
      await rm(filepath, { force: true }).catch(() => undefined);

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

  async getPhoto(id: number, user: SessionUser) {
    const attendance =
      await this.getAuthorizedAttendance(id, user);

    if (
      !/^[0-9a-f-]{36}\.(jpg|png)$/.test(
        attendance.photoPath,
      )
    ) {
      throw new NotFoundException('Photo not found');
    }

    const filepath = join(
      this.photoDir,
      attendance.photoPath,
    );

    let content: Buffer;

    try {
      content = await readFile(filepath);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        throw new NotFoundException('Photo not found');
      }

      throw error;
    }

    const mimeType = attendance.photoPath.endsWith('.png')
      ? 'image/png'
      : 'image/jpeg';

    return new StreamableFile(content, {
      type: mimeType,
      disposition: 'inline',
    });
  }
}
