import type { MigrationInterface, QueryRunner } from "typeorm";

// An employee can send a new profile photo. It waits in pending_photo_path
// until HRD approves it (then it becomes photo_path) or rejects it.
export class AddEmployeePhotoRequests1795400000000 implements MigrationInterface {
    name = 'AddEmployeePhotoRequests1795400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`employees\`
                ADD \`pending_photo_path\` varchar(100) NULL,
                ADD \`pending_photo_at\` datetime(3) NULL,
                ADD \`photo_rejected_at\` datetime(3) NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`employees\`
                DROP COLUMN \`photo_rejected_at\`,
                DROP COLUMN \`pending_photo_at\`,
                DROP COLUMN \`pending_photo_path\`
        `);
    }
}
