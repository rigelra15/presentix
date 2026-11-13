#!/usr/bin/env bash
set -euo pipefail

ROOT_PASSWORD="$(cat /run/secrets/mysql_root_password)"
EMPLOYEE_PASSWORD="$(cat /run/secrets/employee_db_password)"
ATTENDANCE_PASSWORD="$(cat /run/secrets/attendance_db_password)"

mysql \
  --defaults-extra-file=<(printf '[client]\npassword="%s"\n' "$ROOT_PASSWORD") \
  --protocol=socket \
  -uroot <<SQL

CREATE DATABASE IF NOT EXISTS employee_db;
CREATE DATABASE IF NOT EXISTS attendance_db;

CREATE USER IF NOT EXISTS 'employee_app'@'%'
  IDENTIFIED BY '${EMPLOYEE_PASSWORD}';

CREATE USER IF NOT EXISTS 'attendance_app'@'%'
  IDENTIFIED BY '${ATTENDANCE_PASSWORD}';

GRANT ALL PRIVILEGES ON employee_db.*
  TO 'employee_app'@'%';

GRANT ALL PRIVILEGES ON attendance_db.*
  TO 'attendance_app'@'%';

SQL
