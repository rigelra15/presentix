# WFH Attendance

A web app where employees log in and submit a WFH check-in with a photo, and HRD
manages employee data and monitors attendance (view only).

## Tech stack

- **Frontend:** React + TypeScript + Vite (`apps/web`)
- **Backend:** 2 NestJS services (TypeScript)
  - `apps/employee-service` – login (JWT), employee master data
  - `apps/attendance-service` – check-in, photo upload, attendance history
- **Database:** MySQL 8.4 (Docker), TypeORM migrations
- **Password hashing:** Argon2id

## Architecture

```
            ┌──────────────┐
 Browser ──>│  web (Vite)  │  :5173
            └──────┬───────┘
     /api/employee │   /api/attendance
         ┌─────────┴──────────┐
         v                    v
 ┌──────────────────┐   ┌────────────────────┐
 │ employee-service │<──│ attendance-service │
 │      :3000       │   │       :3001        │
 └────────┬─────────┘   └─────────┬──────────┘
          v                       v
     employee_db             attendance_db      (MySQL :3307)
```

- Each service has its **own database and DB user**. A service cannot read the
  other service's tables.
- `employee-service` issues the JWT. `attendance-service` checks the token by
  calling `GET /auth/me` on `employee-service`, so a deactivated employee is
  blocked immediately in both services.
- The Vite dev server proxies `/api/employee/*` and `/api/attendance/*` to the
  services, so the browser only talks to one origin (no CORS setup needed).

## Requirements

- Node.js 24 LTS (or 22.22.3+) and npm
- Docker Desktop (with Docker Compose v2)

## Setup

```bash
npm install
npm run setup
```

`npm run setup` does these steps in order:

1. `setup:secrets` – creates random passwords and the JWT secret in
   `docker/secrets/` (this folder is git-ignored; existing files are kept)
2. `db:up` – starts MySQL with Docker and waits until it is healthy.
   On first start, `docker/mysql/init.sh` creates both databases and DB users
3. `build` – builds all apps
4. `migrate` – runs the TypeORM migrations for both services

After this the database is empty. Create accounts with **one** of these options.

### Option A – demo accounts (quick try)

```bash
npm run seed
```

Creates one HRD and one employee account. The emails and passwords are
generated randomly and saved in `docker/secrets/demo-accounts.json`. Open that
file to see them.

### Option B – real accounts (empty database)

There is no public sign-up page, so the first HRD account is created from the
terminal:

```bash
npm run create-hrd
```

The script asks for an email and a password (min 12 characters, hidden while
typing) and saves the password as an Argon2id hash.

Then log in as that HRD and add employees from the **Employee Management**
page. Each employee gets their own login account (email + password set by HRD).

## Running the app

Open 3 terminals in the project root:

```bash
npm run dev:employee     # http://localhost:3000
npm run dev:attendance   # http://localhost:3001
npm run dev:web          # http://localhost:5173
```

Then open http://localhost:5173 and log in with a demo account or the HRD account you created.

Optional check that login works with the demo accounts (employee service must be running):

```bash
npm run check:login
```

## Features

**Employee**
- Login
- WFH check-in with a photo (JPEG/PNG, max 5 MB). Date and time are taken from
  the server, not from the browser
- Only one check-in per day (Asia/Jakarta date). This is also enforced by a
  unique index in the database
- See own attendance history

**HRD**
- Login
- Add, view, and update employees
- Deactivate / reactivate employees (see "Delete" below)
- Monitor all attendance: search by employee name, code or department, filter
  by date, and preview the check-in photo

### Why "delete" is a deactivate

`DELETE /employees/:id` sets `is_active = false` instead of removing the row.
Attendance records point to the employee, so hard-deleting an employee would
leave attendance history without an owner. A deactivated employee cannot log
in, and HRD can reactivate them later.

## API

All endpoints except login need `Authorization: Bearer <token>`.

### employee-service (:3000)

| Method | Path             | Role | Description                    |
| ------ | ---------------- | ---- | ------------------------------ |
| POST   | `/auth/login`    | –    | Login, returns JWT (30 min)    |
| GET    | `/auth/me`       | any  | Current user                   |
| GET    | `/employees`     | HRD  | List employees                 |
| GET    | `/employees/:id` | HRD  | Employee detail                |
| POST   | `/employees`     | HRD  | Create employee + login account |
| PATCH  | `/employees/:id` | HRD  | Update / reactivate employee   |
| DELETE | `/employees/:id` | HRD  | Deactivate employee            |

### attendance-service (:3001)

| Method | Path                     | Role            | Description                         |
| ------ | ------------------------ | --------------- | ----------------------------------- |
| POST   | `/attendances`           | EMPLOYEE        | Check in (multipart field `photo`)  |
| GET    | `/attendances/me`        | EMPLOYEE        | Own attendance history              |
| GET    | `/attendances`           | HRD             | All attendance                      |
| GET    | `/attendances/:id`       | HRD / owner     | Attendance detail                   |
| GET    | `/attendances/:id/photo` | HRD / owner     | Check-in photo                      |

## Database

**employee_db**
- `users` – id, email (unique), password_hash, role (`EMPLOYEE` / `HRD`), created_at
- `employees` – id, user_id (unique, FK → users), employee_code (unique),
  full_name, department, is_active

**attendance_db**
- `attendances` – id, employee_id, attendance_date, checked_in_at, photo_path,
  created_at. Unique index on (employee_id, attendance_date)

`employee_id` has no foreign key because it lives in another service's
database. Photos are saved on disk in `storage/attendance-photos/` (git-ignored),
and only the file name is stored in the database.

## Useful commands

```bash
npm run build      # build all apps
npm run lint       # lint all apps
npm test           # unit tests (backend)
npm run db:down    # stop MySQL (data is kept in the Docker volume)
```

Check migration status for one service:

```bash
npm run migration:show -w employee-service
```

## Configuration

Defaults work for local development. These environment variables can override them:

| Variable                | Used by            | Default                                    |
| ----------------------- | ------------------ | ------------------------------------------ |
| `MYSQL_PORT`            | docker compose     | `3307`                                     |
| `PORT`                  | both services      | `3000` (employee), `3001` (attendance)     |
| `DB_HOST` / `DB_PORT`   | both services      | `127.0.0.1` / `3307`                       |
| `DB_PASSWORD_FILE`      | both services      | `docker/secrets/<service>_db_password`     |
| `JWT_SECRET_FILE`       | employee-service   | `docker/secrets/jwt_access_secret`         |
| `EMPLOYEE_SERVICE_URL`  | attendance-service | `http://127.0.0.1:3000`                    |
| `ATTENDANCE_PHOTO_DIR`  | attendance-service | `storage/attendance-photos`                |

## Security notes

- Passwords are hashed with Argon2id. The hash column is never returned by the API.
- Secrets are read from files in `docker/secrets/`, not hard-coded or committed.
- MySQL is only exposed on `127.0.0.1`.
- Each service uses its own DB user that only has access to its own database.
- Uploaded photos are checked by their file signature (not only the extension),
  saved with a random file name, and can only be viewed with a valid token.
