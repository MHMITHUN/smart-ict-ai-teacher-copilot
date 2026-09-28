import type { ClassGroup } from "../types";

/**
 * Demo class groups (spec 20.9). Fictional rosters used ONLY for aggregated
 * class-level analytics — the app never tracks individual students. The
 * studentCount drives the completion-rate aggregate (results recorded vs
 * students expected per administered topic).
 *
 * DemoStore seeds these; MongoStore stays empty on purpose (real teachers
 * add real data), so analytics shows its honest empty state there.
 */

export const SEED_CLASS_GROUPS: ClassGroup[] = [
  {
    id: "cls-nine-ict",
    name: "Nine ICT",
    subject: "Information and Communication Technology",
    studentCount: 42,
  },
  {
    id: "cls-ten-ict",
    name: "Ten ICT",
    subject: "Information and Communication Technology",
    studentCount: 38,
  },
  {
    id: "cls-hsc1-cse",
    name: "HSC 1st Year CSE-intro",
    subject: "Introduction to Computer Science and Engineering",
    studentCount: 30,
  },
];
