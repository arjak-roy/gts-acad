# Database Seeding

## Usage

```bash
# Seed essential system data only — safe for production
node prisma/seed.mjs --essential

# Seed essential + mock data — development / staging only
node prisma/seed.mjs

# Wipe all mock data then re-seed everything — development only, blocked in production
node prisma/seed.mjs --force
```

> `NODE_ENV=production` blocks both `--force` and the default (mock) mode. Only `--essential` is allowed in production.

---

## Module Structure

```
prisma/
  seed.mjs              CLI entry point — arg parsing + orchestration only (~57 lines)
  seeds/
    rbac-data.mjs       Static data: SYSTEM_ROLES, PERMISSION_DEFINITIONS, ROLE_PERMISSION_MAP
    mock-data.mjs       Static data: COURSES, PROGRAMS, CURRICULUM_SEEDS, TRAINERS, TRAINING_CENTRES, name lists
    utils.mjs           Pure helpers (makeUuid, hashPassword, formatEntityCode, …) + DB helpers (upsertUser, assignUserRole, resolveTrainerEmployeeCode)
    essential.mjs       seedEssentialData(prisma, settingsCatalog) — roles, permissions, settings catalog, admin user, geography
    mock.mjs            seedMockData(prisma, essentialData) — centres, courses, curricula, programs, trainers, batches, learners, all per-learner records
    clean.mjs           cleanMockData(prisma) — deletes all mock tables in reverse FK order
```

---

## Seeding Modes

| Mode | Command | What runs | Production-safe |
|---|---|---|---|
| Essential | `--essential` | `seedEssentialData` | Yes |
| Default | _(no flag)_ | `seedEssentialData` → `seedMockData` | No |
| Force | `--force` | `cleanMockData` → `seedEssentialData` → `seedMockData` | No |

---

## Essential Data (`seeds/essential.mjs`)

Idempotent — uses `upsert` throughout. Safe to run multiple times against production.

- **Roles** — all system roles defined in `rbac-data.mjs`
- **Permissions** — all permission keys defined in `rbac-data.mjs`
- **Role-Permission matrix** — assignments defined in `ROLE_PERMISSION_MAP`
- **Settings** — all categories and setting definitions from `lib/settings/settings-catalog.json`
- **Admin user** — `arjakroy2411@gmail.com` / `dev-password`, assigned `SUPER_ADMIN`
- **Reference geography** — currency `INR`, country `India`, state `Kerala`, city `Kochi`

Returns `{ roleRecords, permissionRecords, adminUser, kochi }` for use by `seedMockData`.

---

## Mock Data (`seeds/mock.mjs`)

Idempotent — uses `upsert` / `deleteMany`+`createMany` for relational resets. Safe to re-run without `--force` (adds/updates, does not delete).

| Entity | Count | Notes |
|---|---|---|
| Extra role users | 3 | `ACADEMY_ADMIN`, `CONTENT_MANAGER`, `SUPPORT_USER` |
| Training centres | 3 | Fixed UUIDs derived from seeds 9001–9003 |
| Courses | 5 | One per `ProgramType` |
| Curricula | 5 | One per course, each with 1 module + N stages |
| Programs | 8 | Linked to courses by type |
| Trainers | 8 | Each with 2 course assignments |
| Batches | 8 | Mix of `PLANNED` / `IN_SESSION`, `ONLINE` / `OFFLINE` |
| Learners | 50 | Codes `GTS-240901` … `GTS-240950` |
| Attendance sessions | 1 per batch | Manual, date 2026-03-28 |
| Attendance records | 1 per learner | `PRESENT` / `LATE` / `ABSENT` by modular pattern |
| Candidate details | 1 per learner | Passport, education, experience |
| Candidate documents | 1 per learner | Passport PDF path |
| Readiness snapshots | 1 per learner | |
| Recruiter sync logs | Ready learners only | |
| Certificates | Ready learners only | |
| Performance metrics | 1 per learner | |
| Roleplays | 1 per learner | |
| Interviews | 1 per learner | |
| Assessments | 1 per batch | Mix of `FINAL` / `MODULE`, `ONLINE` / `VIVA_VOCE` |
| Assessment scores | 1 per learner | |
| Trainer PMS logs | 1 per trainer | |

---

## Clean (`seeds/clean.mjs`)

Deletes all mock tables in reverse FK dependency order. Only called under `--force`.

```
trainerPmsLog → assessmentScore → assessment → interview → roleplay
→ performanceMetric → certificate → recruiterSyncLog → readinessSnapshot
→ candidateDocument → candidateBasicDetails → attendanceRecord
→ attendanceSession → batchEnrollment → learner → batch
→ trainerCourseAssignment → trainerProfile → program
→ curriculumStage → curriculumModule → curriculum → course
→ trainingCentre → readinessEngineRule
```

Essential data (roles, permissions, settings, users, geography) is **never** deleted.

---

## Utilities (`seeds/utils.mjs`)

### Pure helpers

| Helper | Description |
|---|---|
| `makeUuid(seed)` | Deterministic UUID from a numeric seed |
| `hashPassword(password)` | `scrypt`-based hash (format: `scrypt$salt$derivedKey`) |
| `deriveCodePrefix(value)` | First 3 alphanumeric chars of a name, uppercased |
| `formatEntityCode(kind, value, seq)` | E.g. `C-LAN-001` |
| `formatTrainerEmployeeCode(seq)` | E.g. `TRN-0001` |
| `placementForIndex(i)` | Deterministic placement/readiness/sync status for learner index |

### DB helpers (all take `prisma` as first argument)

| Helper | Description |
|---|---|
| `upsertUser(prisma, { email, name, phone, password })` | Find-or-create user, rehashes password only on create |
| `assignUserRole(prisma, userId, roleId)` | Idempotent role assignment |
| `resolveTrainerEmployeeCode(prisma, { userId, sequence })` | Returns existing code or allocates next available `TRN-XXXX` |

---

## Adding New Seed Data

1. **Static constants** → add to `seeds/mock-data.mjs`
2. **New entity seeding logic** → add to `seedMockData` in `seeds/mock.mjs`
3. **New essential/system data** → add to `seedEssentialData` in `seeds/essential.mjs`
4. **New tables to clean** → add the Prisma delegate name to the `tables` array in `seeds/clean.mjs` (maintain reverse FK order)
5. **New pure helpers** → add to `seeds/utils.mjs`

Do **not** modify `prisma/seed.mjs` for data changes — it contains only CLI orchestration.
