import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefreshTokens1795100000000 implements MigrationInterface {
    name = 'AddRefreshTokens1795100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`refresh_tokens\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`user_id\` int NOT NULL,
                \`token_hash\` char(64) NOT NULL,
                \`expires_at\` datetime NOT NULL,
                \`revoked_at\` datetime NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                UNIQUE INDEX \`IDX_refresh_tokens_token_hash\` (\`token_hash\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
        await queryRunner.query(`
            ALTER TABLE \`refresh_tokens\`
            ADD CONSTRAINT \`FK_refresh_tokens_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`refresh_tokens\` DROP FOREIGN KEY \`FK_refresh_tokens_user\`
        `);
        await queryRunner.query(`
            DROP TABLE \`refresh_tokens\`
        `);
    }
}
