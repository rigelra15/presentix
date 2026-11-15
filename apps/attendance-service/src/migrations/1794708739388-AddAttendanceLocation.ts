import type { MigrationInterface, QueryRunner } from 'typeorm';

// Adds the GPS location of each check-in.
// Columns are nullable because check-ins made before this change have no location.
export class AddAttendanceLocation1794708739388 implements MigrationInterface {
  name = 'AddAttendanceLocation1794708739388';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`attendances\`
        ADD \`latitude\` decimal(9,6) NULL,
        ADD \`longitude\` decimal(9,6) NULL,
        ADD \`location_accuracy\` int NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`attendances\`
        DROP COLUMN \`location_accuracy\`,
        DROP COLUMN \`longitude\`,
        DROP COLUMN \`latitude\`
    `);
  }
}
