# Deployment

## Vercel (recommended)

1. Push the repository to GitHub/GitLab and **Import Project** in Vercel
   (framework preset: Next.js — zero config needed; `npm run build` is the
   default build, port handling is Vercel's).
2. Deploy **with no environment variables at all** for the zero-key demo:
   - generation runs on the **mock provider** (honest, clearly-labeled
     sample drafts — the demo banner says so),
   - storage runs on the **in-memory demo store** (seeded automatically,
     resets on redeploy).
   This mode is deliberately valid: the deployment is immediately usable
   and never claims a real model is involved.
3. For a production-grade deployment, add environment variables in
   **Project → Settings → Environment Variables**:

| Variable           | When               | Value |
| ------------------ | ------------------ | ----- |
| `GEMINI_API_KEY`   | real AI generation | Google AI Studio key (selects gemini) |
| `OPENAI_API_KEY`   | real AI generation (no Gemini key) | OpenAI key |
| `AI_PROVIDER`      | optional force     | `gemini` \| `openai` \| `mock` |
| `AI_MODEL`         | optional           | e.g. `gemini-2.5-flash` (default) |
| `MONGODB_URI`      | persistence        | e.g. MongoDB Atlas free tier (`mongodb+srv://…`) |
| `MONGODB_DB_NAME`  | with Mongo         | default `ai_teacher_copilot` |
| `SESSION_SECRET`   | **required in production** | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

   Notes:
   - `SESSION_SECRET` matters: with the demo fallback secret anyone could
     forge a session cookie. The code comments warn about it, but Vercel
     env vars are the right place to fix it.
   - All cookie/store-reading routes are `export const dynamic =
     "force-dynamic"`, so there are no static-caching surprises on Vercel.
   - Redeploys reset demo-mode data (in-memory store); with Mongo set, data
     persists across deploys.

## Seeding MongoDB (optional, after the first deploy)

`npm run seed` is idempotent (`$setOnInsert` everywhere — it never
overwrites teacher edits or real activity):

```bash
# locally, pointed at the production database
MONGODB_URI="mongodb+srv://…" MONGODB_DB_NAME="ai_teacher_copilot" npm run seed
```

It ensures the same indexes `MongoStore` creates on boot, then fills the
full demo dataset (users, 3 lessons, 3 quizzes, worksheet, rubric, 2
explanations, 40 questions, 3 class groups + quiz results) and prints
per-collection counts. Without `MONGODB_URI` it prints the demo-mode
message and exits 0 — safe in CI.

## Local production check

```bash
npm run build
npm start          # http://localhost:3005 (start script pins the port)
```

## Health checklist after deploying

- `/` redirects anonymous visitors to `/login`;
- sign in with a demo account (see README → Demo Accounts; only exists
  after seeding when Mongo mode is on — demo mode seeds automatically);
- the sidebar chip says which provider is live and the Settings page shows
  key presence (booleans only);
- generate a lesson-plan draft: in mock mode every draft carries the
  "sample AI draft" honesty labels; with a key set the badge shows the real
  provider + model;
- approve the draft and confirm the "Teacher approved" badge with your
  account recorded.
