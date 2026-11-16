import type { MigrationInterface, QueryRunner } from "typeorm";

// Face check (liveness) frames. Nullable, so older check-ins stay valid.
export class AddAttendanceLiveness1795200000000 implements MigrationInterface {
    name = 'AddAttendanceLiveness1795200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`attendances\`
            ADD \`liveness_left_path\` varchar(100) NULL,
            ADD \`liveness_right_path\` varchar(100) NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`attendances\`
            DROP COLUMN \`liveness_right_path\`,
            DROP COLUMN \`liveness_left_path\`
        `);
    }
}
