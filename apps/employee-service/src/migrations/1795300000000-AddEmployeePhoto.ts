import type { MigrationInterface, QueryRunner } from "typeorm";

// Profile photo uploaded by HRD. HRD compares it with the check-in
// photos to see that the right person checked in.
export class AddEmployeePhoto1795300000000 implements MigrationInterface {
    name = 'AddEmployeePhoto1795300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`employees\` ADD \`photo_path\` varchar(100) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`employees\` DROP COLUMN \`photo_path\``);
    }
}
