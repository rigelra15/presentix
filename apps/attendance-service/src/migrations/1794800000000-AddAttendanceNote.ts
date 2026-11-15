import type { MigrationInterface, QueryRunner } from 'typeorm';

// Adds the employee's note (today's agenda) to each check-in.
// Nullable because check-ins made before this change have no note.
export class AddAttendanceNote1794800000000 implements MigrationInterface {
  name = 'AddAttendanceNote1794800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`attendances\`
        ADD \`note\` varchar(500) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`attendances\`
        DROP COLUMN \`note\`
    `);
  }
}
