import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialEmployeeSchema1794569320854 implements MigrationInterface {
    name = 'InitialEmployeeSchema1794569320854'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`users\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`email\` varchar(255) NOT NULL,
                \`password_hash\` varchar(255) NOT NULL,
                \`role\` enum ('EMPLOYEE', 'HRD') NOT NULL DEFAULT 'EMPLOYEE',
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
        await queryRunner.query(`
            CREATE TABLE \`employees\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`employee_code\` varchar(30) NOT NULL,
                \`full_name\` varchar(150) NOT NULL,
                \`department\` varchar(100) NOT NULL,
                \`is_active\` tinyint NOT NULL DEFAULT 1,
                \`user_id\` int NOT NULL,
                UNIQUE INDEX \`IDX_56162b5f24af743a154680684f\` (\`employee_code\`),
                UNIQUE INDEX \`REL_2d83c53c3e553a48dadb9722e3\` (\`user_id\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
        await queryRunner.query(`
            ALTER TABLE \`employees\`
            ADD CONSTRAINT \`FK_2d83c53c3e553a48dadb9722e38\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`employees\` DROP FOREIGN KEY \`FK_2d83c53c3e553a48dadb9722e38\`
        `);
        await queryRunner.query(`
            DROP INDEX \`REL_2d83c53c3e553a48dadb9722e3\` ON \`employees\`
        `);
        await queryRunner.query(`
            DROP INDEX \`IDX_56162b5f24af743a154680684f\` ON \`employees\`
        `);
        await queryRunner.query(`
            DROP TABLE \`employees\`
        `);
        await queryRunner.query(`
            DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\` ON \`users\`
        `);
        await queryRunner.query(`
            DROP TABLE \`users\`
        `);
    }

}
