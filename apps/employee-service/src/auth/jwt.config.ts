import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const secretPath =
  process.env.JWT_SECRET_FILE ??
  resolve(
    process.cwd(),
    '../../docker/secrets/jwt_access_secret',
  );

export const jwtSecret = readFileSync(secretPath, 'utf-8').trim();

if (jwtSecret.length < 32) {
  throw new Error('JWT secret must be at least 32 characters');
}

export const jwtIssuer = 'wfh-employee-service';
export const jwtAudience = 'wfh-attendance';