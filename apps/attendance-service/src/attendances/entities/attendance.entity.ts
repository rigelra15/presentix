import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('attendances')
@Index(
  'UQ_attendance_employee_date',
  ['employeeId', 'attendanceDate'],
  { unique: true },
)
export class Attendance {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    name: 'employee_id',
    type: 'int',
  })
  employeeId!: number;

  @Column({
    name: 'attendance_date',
    type: 'date',
  })
  attendanceDate!: string;

  @Column({
    name: 'checked_in_at',
    type: 'datetime',
    precision: 3,
  })
  checkedInAt!: Date;

  @Column({
    name: 'photo_path',
    type: 'varchar',
    length: 500,
  })
  photoPath!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
  })
  createdAt!: Date;
}
