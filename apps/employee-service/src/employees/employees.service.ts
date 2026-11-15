import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, QueryFailedError } from "typeorm";
import type { Repository } from "typeorm";
import * as argon2 from 'argon2';

import { Employee } from "./entities/employee.entity.js";
import { User } from "../users/entities/user.entity.js";
import { UserRole } from "../users/user-role.enum.js";
import type { CreateEmployeeDto } from "./dto/create-employee.dto.js";
import type { UpdateEmployeeDto } from "./dto/update-employee.dto.js";

@Injectable()
export class EmployeesService {
  private readonly attendanceServiceUrl =
    process.env.ATTENDANCE_SERVICE_URL ?? 'http://127.0.0.1:3001';

  constructor(
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
    private readonly dataSource: DataSource,
  ) { }

  private toResponse(employee: Employee) {
    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      department: employee.department,
      isActive: employee.isActive,
      email: employee.user.email,
    };
  }

  private handleDuplicate(error: unknown): void {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string })?.code === 'ER_DUP_ENTRY'
    ) {
      throw new ConflictException(
        'Email or employee code already exists',
      );
    }
  }

  async findAll() {
    const employees = await this.employees.find({
      relations: { user: true },
      order: { id: 'ASC' },
    });

    return employees.map((employee) =>
      this.toResponse(employee),
    );
  }

  // Suggests the next code in the "EMP-0001" format.
  // Takes the highest EMP-<number> code and adds 1.
  // Codes in other formats (e.g. "EMP-DEMO-001") are ignored.
  async getNextCode() {
    const employees = await this.employees.find({
      select: { employeeCode: true },
    });

    let highest = 0;
    let digits = 4;

    for (const employee of employees) {
      const match = /^EMP-(\d+)$/.exec(employee.employeeCode);

      if (match && Number(match[1]) > highest) {
        highest = Number(match[1]);
        // Keep the same number of digits, e.g. EMP-0002737 -> EMP-0002738
        digits = Math.max(4, match[1].length);
      }
    }

    const nextNumber = String(highest + 1).padStart(digits, '0');

    return { employeeCode: `EMP-${nextNumber}` };
  }

  async findOne(id: number) {
    const employee = await this.employees.findOne({
      where: { id },
      relations: { user: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.toResponse(employee);
  }

  async create(dto: CreateEmployeeDto) {
    let employeeId: number;

    try {
      employeeId = await this.dataSource.transaction(
        async (manager) => {
          const user = manager.create(User, {
            email: dto.email,
            passwordHash: await argon2.hash(
              dto.password,
              { type: argon2.argon2id },
            ),
            role: UserRole.EMPLOYEE,
          });

          await manager.save(User, user);

          const employee = manager.create(Employee, {
            user,
            employeeCode: dto.employeeCode,
            fullName: dto.fullName,
            department: dto.department,
            isActive: true,
          });

          const saved = await manager.save(
            Employee,
            employee,
          );

          return saved.id;
        },
      );
    } catch (error) {
      this.handleDuplicate(error);
      throw error;
    }

    return this.findOne(employeeId);
  }

  async update(id: number, dto: UpdateEmployeeDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'At least one field is required',
      );
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const employee = await manager
          .getRepository(Employee)
          .findOne({
            where: { id },
            relations: { user: true },
          });

        if (!employee) {
          throw new NotFoundException('Employee not found')
        }

        if (dto.email !== undefined) {
          employee.user.email = dto.email;
          await manager.save(User, employee.user);
        }

        if (dto.employeeCode !== undefined) {
          employee.employeeCode = dto.employeeCode;
        }

        if (dto.fullName !== undefined) {
          employee.fullName = dto.fullName;
        }

        if (dto.department !== undefined) {
          employee.department = dto.department;
        }

        if (dto.isActive !== undefined) {
          employee.isActive = dto.isActive;
        }

        await manager.save(Employee, employee);
      });
    } catch (error) {
      this.handleDuplicate(error);
      throw error;
    }

    return this.findOne(id);
  }

  // Asks attendance-service how many check-ins this employee has.
  // The HRD's own token is passed on, so attendance-service can check it.
  private async countAttendance(
    employeeId: number,
    authorization: string,
  ): Promise<number> {
    try {
      const response = await fetch(
        `${this.attendanceServiceUrl}/attendances?employeeId=${employeeId}`,
        {
          headers: { Authorization: authorization },
          signal: AbortSignal.timeout(3000),
        },
      );

      if (response.ok) {
        const records = (await response.json()) as unknown[];
        return records.length;
      }
    } catch {
      // handled below
    }

    // If we cannot be sure, do not delete anything
    throw new ServiceUnavailableException(
      'Cannot check attendance records right now. Please try again later.',
    );
  }

  async remove(id: number, authorization: string) {
    const employee = await this.employees.findOne({
      where: { id },
      relations: { user: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Deactivating first means the employee cannot log in
    // and check in while they are being deleted.
    if (employee.isActive) {
      throw new ConflictException(
        'Deactivate the employee before deleting them.',
      );
    }

    // Attendance lives in another database, so deleting an employee with
    // records would leave check-ins (and photos) without an owner.
    const attendanceCount = await this.countAttendance(id, authorization);

    if (attendanceCount > 0) {
      throw new ConflictException(
        `This employee has ${attendanceCount} attendance record(s), so they cannot be deleted. Keep them deactivated instead.`,
      );
    }

    // The employee row points to the user, so delete it first
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(Employee, { id: employee.id });
      await manager.delete(User, { id: employee.user.id });
    });

    return { id, deleted: true };
  }

  async deactivate(id: number) {
    const result = await this.employees.update(
      { id },
      { isActive: false },
    );

    if (!result.affected) {
      throw new NotFoundException('Employee not found');
    }

    return this.findOne(id);
  }
}