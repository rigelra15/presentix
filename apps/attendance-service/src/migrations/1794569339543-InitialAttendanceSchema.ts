import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialAttendanceSchema1794569339543 implements MigrationInterface {
    name = 'InitialAttendanceSchema1794569339543'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`attendances\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`employee_id\` int NOT NULL,
                \`attendance_date\` date NOT NULL,
                \`checked_in_at\` datetime(3) NOT NULL,
                \`photo_path\` varchar(500) NOT NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                UNIQUE INDEX \`UQ_attendance_employee_date\` (\`employee_id\`, \`attendance_date\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX \`UQ_attendance_employee_date\` ON \`attendances\`
        `);
        await queryRunner.query(`
            DROP TABLE \`attendances\`
        `);
    }

}
