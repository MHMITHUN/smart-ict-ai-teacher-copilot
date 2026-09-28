# Safety & Responsible AI

This is a teacher tool built on a simple stance: **AI assists, the teacher
decides.** The mechanisms below are in the data model, the server actions
and the UI — not in a policy document.

## 1. Teacher-review-first philosophy (spec 20.1 / 20.10)

- Every AI-generated artifact is stored at `status: "draft"` and rendered
  inside the review shell with the badge **"AI-generated draft — teacher
  review required"**. There is no code path that stores generated content
  as approved.
- Approval is an explicit action: it flips the badge to **"Teacher
  approved"** and records `approvedBy` (teacher account id) and
  `approvedAt` (timestamp). Who approved what, and when, is answerable
  from the data.
- Every field stays editable before *and* after approval, and edits are
  recorded (`updatedBy`, `updatedAt`).
- Downstream surfaces trust approval, not existence: printing/copying a
  worksheet and sending quiz questions to the question bank are
  **approved-only** operations.
- Review access rule: all teachers see every artifact (a shared department
  catalog), but only the **creator or an admin** may approve — enforced in
  the server actions (`src/lib/artifacts/review-access.ts`), mirrored by
  hiding the approve button in the UI. Server-side tests pin it.

## 2. No fabricated references

- Prompts forbid fabricated citations, textbook page numbers, board
  declarations and URLs (`INTEGRITY_RULES`, and the explainer's dedicated
  `NO_REFERENCES_RULE`).
- The Explanation schema has **no references field at all** — structural
  enforcement, not just instructions.
- A teacher verifies the material before it reaches a classroom; the
  system never presents AI text as sourced.

## 3. Uncertainty is surfaced, never hidden

- Models are instructed to use the optional `uncertaintyNote` when they are
  not fully certain, instead of inventing details.
- The note is stored with the explanation and rendered prominently on the
  draft as a teacher-facing warning; keeping or dropping it through edit +
  approve is covered by tests.
- Validation failures surface honestly as errors ("Nothing was saved —
  please try again or adjust the inputs"). Nothing partially trusted is
  ever stored or shown.

## 4. Mock honesty (spec 36)

- Without API keys the app runs on the deterministic mock provider and
  says so everywhere it matters: a top banner ("Mock mode: sample
  AI-generated drafts. Set GEMINI_API_KEY or OPENAI_API_KEY … for real
  generation."), the sidebar provider chip (with an explicit "no real
  model is called" tooltip), a per-artifact `AIBadge` (`mock` provider +
  `mock-template-v1` model), and the Settings page.
- Mock content is genuinely useful — deterministic templates parameterized
  by the teacher's topic/level/duration inputs from a curated SSC/HSC ICT
  content library — never lorem ipsum, and never presented as model output.
- The app **never** claims a real model was called when it was not;
  provenance (`provider` + `model`) is stamped on every artifact at
  generation time and rendered on every artifact page.

## 5. Data minimization

- **Aggregate-only analytics (spec 20.9):** class analytics show averages,
  topic performance, completion and most-missed *concepts*. There is
  deliberately no individual-student page, profile or leaderboard — the
  product insight is "reteach topic X", not "rank student Y". The page
  states this limit explicitly as a design decision.
- **Demo analytics data is fictional:** seeded quiz results use invented
  student names with fixed Jan–Sep 2026 dates; no real student data exists
  in the repo or seeds.
- **No student accounts at all** (spec 11): students receive printed or
  teacher-approved artifacts; they never log in, so no student PII is ever
  collected.
- **Secrets are minimized:** API keys are read only server-side and never
  serialized to the client; the Settings page reports only boolean
  presence/absence of each key (`src/lib/settings/env-status.ts`, tested to
  prove values never leak into the report).

## 6. Authentication and session safety

- Passwords: scrypt with a unique salt per hash (`node:crypto`), verified
  with timing-safe comparison.
- Sessions: stateless HMAC-SHA256-signed cookies — `httpOnly`, `sameSite:
  lax`, `secure` in production, 7-day expiry. Tampered, malformed, expired
  or role-mismatched tokens are rejected; the stored user is re-checked on
  every request (a token can outlive a role change; the store wins).
- The entire workspace sits behind `requireRole(["TEACHER", "ADMIN"])` at
  every page, action and route handler — no middleware to forget, no public
  surface except `/login`.
