import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

import { UserRole } from '../user-role.enum.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
  })
  email!: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash!: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.EMPLOYEE,
  })
  role!: UserRole;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt!: Date;
}