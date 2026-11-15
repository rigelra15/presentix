import type { MigrationInterface, QueryRunner } from 'typeorm';

// Records how the check-in photo was taken:
// CAMERA = live camera, UPLOAD = file chosen because no camera was available.
// Nullable because older check-ins do not have this information.
export class AddAttendancePhotoSource1794900000000 implements MigrationInterface {
  name = 'AddAttendancePhotoSource1794900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`attendances\`
        ADD \`photo_source\` varchar(10) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`attendances\`
        DROP COLUMN \`photo_source\`
    `);
  }
}
