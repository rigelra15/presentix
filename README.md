# WFH Attendance

A web app where employees log in and check in for WFH with a live camera photo,
their GPS location and a short note about today's agenda, and HRD manages employee data and monitors attendance
(view only).

## Tech stack

- **Frontend:** React + TypeScript + Vite, React Router, MapLibre GL JS (`apps/web`)
- **Backend:** 2 NestJS services (TypeScript)
  - `apps/employee-service` – login (JWT), employee master data
  - `apps/attendance-service` – check-in (photo + GPS), attendance history
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

The script asks for an email and a password (hidden while typing) and saves
the password as an Argon2id hash.

Password rule (same for HRD and employees): at least 8 characters, with an
uppercase letter, a lowercase letter and a number.

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
- WFH check-in in 3 steps:
  1. **GPS location** from the browser (required, the API rejects a check-in
     without valid coordinates)
  2. **Live photo** taken with the device camera. There is no file picker, so
     an old photo from the gallery cannot be uploaded
  3. **Today's agenda**: a short note (3–500 characters) about what the
     employee works on today. HRD can read it
- Date and time are taken from the server, not from the browser
- Only one check-in per day (Asia/Jakarta date). This is also enforced by a
  unique index in the database
- After check-in, the employee sees their own photo, agenda and location
- Attendance history, with a detail page for each check-in (photo, agenda, map)

**HRD**
- Overview: active employees, who checked in today (with their agenda), and who has not
- Add, view, and update employees. On "Add employee" the next free code
  (`EMP-0001`, `EMP-0002`, ...) is filled in automatically and can still be changed
- Deactivate / reactivate employees, and permanently delete an employee that
  has no attendance (see "Delete" below). Every one of these actions asks for
  confirmation in a modal first
- Monitor all attendance: search by name or code, filter by department and date
- Attendance detail: photo, check-in info, agenda and a map of the location
  (MapLibre GL JS with the free OpenFreeMap Positron style, no API key needed,
  plus a link to Google Maps)
- Every map also shows the street address of the coordinates (reverse
  geocoding, see below)

### Pages

| URL                       | Who      | Page                               |
| ------------------------- | -------- | ---------------------------------- |
| `/login`                  | everyone | Sign in                            |
| `/check-in`               | Employee | Today's check-in                   |
| `/history`                | Employee | My attendance history              |
| `/history/:id`            | Employee | My check-in detail (photo + map)   |
| `/hrd`                    | HRD      | Overview                           |
| `/hrd/employees`          | HRD      | Employee list                      |
| `/hrd/employees/new`      | HRD      | Add employee                       |
| `/hrd/employees/:id/edit` | HRD      | Edit employee                      |
| `/hrd/attendance`         | HRD      | Attendance list with filters       |
| `/hrd/attendance/:id`     | HRD      | Attendance detail (photo + map)    |

The login session is kept in `sessionStorage`, so it survives a page refresh
but is cleared when the tab is closed. When the token expires (30 min) the
user is sent back to the login page.

### Camera and GPS notes

- Browsers only allow camera and GPS on `https://` or `http://localhost`.
  To try it on a phone in the same network, the web app must be served over
  HTTPS (opening `http://<laptop-ip>:5173` will block the camera).
- Camera-only photos and GPS make cheating harder for normal users, but a
  determined user could still use a virtual camera or a fake GPS app. The
  server records its own time and stores the GPS accuracy so HRD can spot
  unusual check-ins. Stronger checks (e.g. office geofencing, face matching)
  are out of scope for this project.

### Address lookup (reverse geocoding)

The address under each map comes from the free OpenStreetMap
[Nominatim](https://nominatim.org/) API, called from the browser
(`apps/web/src/lib/geocode.ts`). No API key is needed. Its usage policy
allows about 1 request per second, so:

- the address is only looked up where a map is shown (not in tables)
- results are cached in memory, so the same coordinates are asked only once

The address is not stored in the database. If the lookup fails, only the
coordinates are shown. Note that this sends the check-in coordinates to
OpenStreetMap's server.

### Deactivate vs. permanent delete

`DELETE /employees/:id` sets `is_active = false` instead of removing the row.
Attendance records point to the employee, so hard-deleting an employee would
leave attendance history without an owner. A deactivated employee cannot log
in, and HRD can reactivate them later. This is the normal way to "remove" an
employee.

`DELETE /employees/:id/permanent` really removes the employee and their login
account. It is meant for accounts created by mistake, so it is only allowed when:

1. the employee is already deactivated (so they cannot check in while being
   deleted), and
2. they have **no** attendance records. employee-service asks
   attendance-service (`GET /attendances?employeeId=<id>`, with the HRD's
   token). If attendance-service cannot be reached, nothing is deleted.

## API

All endpoints except login need `Authorization: Bearer <token>`.

### employee-service (:3000)

| Method | Path             | Role | Description                    |
| ------ | ---------------- | ---- | ------------------------------ |
| POST   | `/auth/login`    | –    | Login, returns JWT (30 min)    |
| GET    | `/auth/me`       | any  | Current user                   |
| GET    | `/employees`     | HRD  | List employees                 |
| GET    | `/employees/next-code` | HRD | Next free code, e.g. `EMP-0002` |
| GET    | `/employees/:id` | HRD  | Employee detail                |
| POST   | `/employees`     | HRD  | Create employee + login account |
| PATCH  | `/employees/:id` | HRD  | Update / reactivate employee   |
| DELETE | `/employees/:id` | HRD  | Deactivate employee            |
| DELETE | `/employees/:id/permanent` | HRD | Delete employee for good (see above) |

### attendance-service (:3001)

| Method | Path                     | Role            | Description                         |
| ------ | ------------------------ | --------------- | ----------------------------------- |
| POST   | `/attendances`           | EMPLOYEE        | Check in (multipart, see below)     |
| GET    | `/attendances/me`        | EMPLOYEE        | Own attendance history              |
| GET    | `/attendances`           | HRD             | All attendance (`?employeeId=` filter) |
| GET    | `/attendances/:id`       | HRD / owner     | Attendance detail                   |
| GET    | `/attendances/:id/photo` | HRD / owner     | Check-in photo                      |

`POST /attendances` is `multipart/form-data` with these fields:

| Field       | Rules                              |
| ----------- | ---------------------------------- |
| `latitude`  | number, -90 to 90                  |
| `longitude` | number, -180 to 180                |
| `accuracy`  | number in meters, from the browser |
| `note`      | text, 3 to 500 characters          |
| `photo`     | JPEG or PNG, max 5 MB              |

## Database

**employee_db**
- `users` – id, email (unique), password_hash, role (`EMPLOYEE` / `HRD`), created_at
- `employees` – id, user_id (unique, FK → users), employee_code (unique),
  full_name, department, is_active

**attendance_db**
- `attendances` – id, employee_id, attendance_date, checked_in_at, photo_path,
  latitude, longitude, location_accuracy, note, created_at.
  Unique index on (employee_id, attendance_date).
  The location and note columns were added by later migrations and are empty
  for check-ins made before them.

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
| `ATTENDANCE_SERVICE_URL` | employee-service  | `http://127.0.0.1:3001`                    |
| `ATTENDANCE_PHOTO_DIR`  | attendance-service | `storage/attendance-photos`                |
| `EMPLOYEE_API_URL`      | web (Vite proxy)   | `http://127.0.0.1:3000`                    |
| `ATTENDANCE_API_URL`    | web (Vite proxy)   | `http://127.0.0.1:3001`                    |

## Security notes

- Passwords are hashed with Argon2id. The hash column is never returned by the API.
- Secrets are read from files in `docker/secrets/`, not hard-coded or committed.
- MySQL is only exposed on `127.0.0.1`.
- Each service uses its own DB user that only has access to its own database.
- Uploaded photos are checked by their file signature (not only the extension),
  saved with a random file name, and can only be viewed with a valid token.
