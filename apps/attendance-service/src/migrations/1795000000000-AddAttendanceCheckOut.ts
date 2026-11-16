import type { MigrationInterface, QueryRunner } from 'typeorm';

// Time the employee checked out (finished work) on that day.
// NULL means the employee has not checked out (yet).
export class AddAttendanceCheckOut1795000000000 implements MigrationInterface {
  name = 'AddAttendanceCheckOut1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`attendances\`
        ADD \`checked_out_at\` datetime(3) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`attendances\`
        DROP COLUMN \`checked_out_at\`
    `);
  }
}
