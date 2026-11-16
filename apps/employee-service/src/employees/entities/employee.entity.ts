import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity.js';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'user_id',
  })
  user!: User;

  @Column({
    name: 'employee_code',
    type: 'varchar',
    length: 30,
    unique: true,
  })
  employeeCode!: string;

  @Column({
    name: 'full_name',
    type: 'varchar',
    length: 150,
  })
  fullName!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  department!: string;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive!: boolean;

  // File name of the profile photo, empty until HRD uploads one
  @Column({
    name: 'photo_path',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  photoPath!: string | null;

  // New photo sent by the employee, waiting for HRD
  @Column({
    name: 'pending_photo_path',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  pendingPhotoPath!: string | null;

  @Column({
    name: 'pending_photo_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  pendingPhotoAt!: Date | null;

  // Set when HRD rejected the last request, so the employee can see it
  @Column({
    name: 'photo_rejected_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  photoRejectedAt!: Date | null;
}