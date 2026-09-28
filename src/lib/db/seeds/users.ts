import type { Role } from "../types";

/**
 * Demo user seed definitions. Passwords are scrypt-hashed at seed time
 * (see demo-store.ts ensureSeeded) — never store real hashes here.
 * Demo password for every account: Demo@12345
 *
 * Teacher tool (spec 11): only TEACHER and ADMIN roles exist.
 */

export interface SeedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string; // fixed ISO dates in January 2026
}

export const DEMO_PASSWORD = "Demo@12345";

export const seedUsers: SeedUser[] = [
  {
    id: "usr-admin-01",
    name: "MD Mahamudul Hasan",
    email: "admin@demo.local",
    role: "ADMIN",
    createdAt: "2026-01-02T09:00:00.000Z",
  },
  {
    id: "usr-teacher-01",
    name: "Nusrat Jahan",
    email: "teacher@demo.local",
    role: "TEACHER",
    createdAt: "2026-01-03T09:00:00.000Z",
  },
  {
    id: "usr-teacher-02",
    name: "Tanvir Ahmed",
    email: "tanvir.teacher@demo.local",
    role: "TEACHER",
    createdAt: "2026-01-03T10:00:00.000Z",
  },
  {
    id: "usr-teacher-03",
    name: "Shamima Akter",
    email: "shamima.teacher@demo.local",
    role: "TEACHER",
    createdAt: "2026-01-04T09:00:00.000Z",
  },
];
