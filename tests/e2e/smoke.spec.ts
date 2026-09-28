import {
  test,
  expect,
  type BrowserContext,
  type Page,
} from "@playwright/test";

/**
 * Workspace smoke (spec 24, Testing): the whole app behind login, honest
 * mock-mode labeling, the full review workflow (generate -> draft badge ->
 * edit -> approve), quiz-to-bank flow, question bank filtering + JSON
 * export download, and analytics charts for the default class.
 *
 * NO console errors are tolerated anywhere in the flow.
 *
 * The tests run SERIALLY against one signed-in teacher because steps 3-5
 * build on each other (the bank count check needs the quiz that step 4
 * sent). Note the two Playwright gotchas learned on this app:
 *   - the first Turbopack compile of a route can take 30s+, so routes are
 *     warmed with plain requests before the browser drives them;
 *   - the sidebar Sign-out button is also type=submit, so form submit
 *     clicks are scoped to their form.
 */

const TEACHER_EMAIL = "teacher@demo.local";
const TEACHER_PASSWORD = "Demo@12345";

test.describe.configure({ mode: "serial" });

/** Collect console.error / uncaught page errors; asserted after every test. */
function watchForConsoleErrors(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(`console.error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    problems.push(`pageerror: ${error.message}`);
  });
  return problems;
}

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEACHER_EMAIL);
  await page.getByLabel("Password").fill(TEACHER_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Total question count from the Question Bank pagination copy ("… N questions"). */
async function bankTotal(page: Page): Promise<number> {
  const pager = page.getByText(/Page \d+ of \d+ · \d+ question/);
  await expect(pager).toBeVisible();
  const text = await pager.innerText();
  const match = text.match(/· (\d+) question/);
  expect(match, `bank total parsed from: ${text}`).not.toBeNull();
  return Number.parseInt(match![1], 10);
}

// ---------------------------------------------------------------------------
// 1. The app is fully login-gated (anonymous -> /login)
// ---------------------------------------------------------------------------

test("anonymous visitors are redirected from / to the login page", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const problems = watchForConsoleErrors(page);

  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  // The login card renders: app-name h1 + the sign-in form controls.
  await expect(
    page.getByRole("heading", {
      name: /smart ict learning & ai teacher copilot/i,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^sign in$/i }),
  ).toBeVisible();
  // The login form is the only thing rendered — no workspace chrome leaks.
  await expect(page.getByTitle(/AI provider:/i)).toHaveCount(0);

  expect(problems).toEqual([]);
  await context.close();
});

// ---------------------------------------------------------------------------
// Shared signed-in session for the serial flow below
// ---------------------------------------------------------------------------

let context: BrowserContext;
let page: Page;
let problems: string[];

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  problems = watchForConsoleErrors(page);

  // Warm the routes (first Turbopack compile per route can take 30s+).
  // 3xx/4xx responses are fine — the goal is compilation, not assertions.
  for (const route of ["/login", "/"]) {
    await context.request.get(route).catch(() => undefined);
  }
  await login(page); // lands on /dashboard and compiles it fully
  for (const route of [
    "/lesson-planner",
    "/quiz-generator",
    "/question-bank",
    "/analytics",
  ]) {
    await context.request.get(route).catch(() => undefined);
  }
});

test.afterEach(() => {
  expect(problems, "no console errors allowed anywhere in the flow").toEqual([]);
});

test.afterAll(async () => {
  await context.close();
});

// ---------------------------------------------------------------------------
// 2. Dashboard: honest provider status + workspace stats
// ---------------------------------------------------------------------------

test("the signed-in teacher sees the dashboard with Mock provider status and stats", async () => {
  await page.goto("/dashboard");

  // Greeting: "Welcome back" kicker above the teacher's name (h1).
  await expect(page.getByText(/welcome back/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /nusrat jahan/i }),
  ).toBeVisible();
  // Sidebar provider chip honestly says Mock (no API keys in dev/e2e env).
  // Rendered twice (sidebar + mobile header) — assert the first.
  const chip = page.getByTitle(/AI provider:/i).first();
  await expect(chip).toBeVisible();
  await expect(chip).toContainText(/mock/i);
  await expect(chip).toHaveAttribute("title", /no real model is called/i);

  // Review queue + quick stats sections render.
  await expect(page.getByText(/awaiting your review/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /your workspace at a glance/i }),
  ).toBeVisible();
  await expect(page.getByText("Bank questions")).toBeVisible();
});

// ---------------------------------------------------------------------------
// 3. Lesson Planner: generate -> draft badge -> edit -> approve
// ---------------------------------------------------------------------------

test("lesson planner drafts, badges, edits and approves a lesson plan", async () => {
  await page.goto("/lesson-planner");

  await page.getByLabel("Topic", { exact: true }).fill("Number Systems");
  // Scoped click: the sidebar Sign-out button is also type=submit.
  await page.click('form:has(input[name="topic"]) button[type="submit"]');

  // The action redirects to the new draft (?id=...).
  await expect(page).toHaveURL(/\/lesson-planner\?id=/, { timeout: 60_000 });

  // Draft state: honest badge + review-required alert.
  await expect(page.getByText(/AI-generated draft/i).first()).toBeVisible();

  // Teacher edits a field (every field is editable pre-approval)...
  await page.getByLabel("Lesson title").fill("Number Systems — edited for 10A");
  await page.getByRole("button", { name: /save edits/i }).click();
  await expect(page.getByText("Edits saved.")).toBeVisible({ timeout: 30_000 });

  // ...then approves: status flips to "Teacher approved".
  await page.getByRole("button", { name: /approve lesson plan/i }).click();
  await expect(page.getByText("Teacher approved").first()).toBeVisible({
    timeout: 30_000,
  });
  // The approve form is gone once approved.
  await expect(
    page.getByRole("button", { name: /approve lesson plan/i }),
  ).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// 4. Quiz Generator: 5-question MCQ -> approve -> send to Question Bank
// ---------------------------------------------------------------------------

test("quiz generator sends an approved 5-question MCQ quiz to the bank", async () => {
  // Baseline bank count BEFORE this test adds anything.
  await page.goto("/question-bank");
  const before = await bankTotal(page);

  await page.goto("/quiz-generator");
  await page.getByLabel("Topic", { exact: true }).fill("Logic Gates");
  await page.getByLabel("Number of questions").fill("5");
  await page.getByLabel("Quiz type").selectOption("MCQ");
  await page.click('form:has(input[name="topic"]) button[type="submit"]');

  await expect(page).toHaveURL(/\/quiz-generator\?id=/, { timeout: 60_000 });
  await expect(page.getByText(/AI-generated draft/i).first()).toBeVisible();

  // Send-to-bank is approved-only: approve the quiz first.
  await page.getByRole("button", { name: /^approve quiz$/i }).click();
  await expect(page.getByText("Teacher approved").first()).toBeVisible({
    timeout: 30_000,
  });

  await page
    .getByRole("button", { name: /send questions to question bank/i })
    .click();
  await expect(
    page.getByText(/questions sent to the bank/i),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/5 questions inserted/i)).toBeVisible();

  // The bank now includes the 5 inserted questions.
  await page.goto("/question-bank");
  const after = await bankTotal(page);
  expect(after).toBeGreaterThanOrEqual(before + 5);
});

// ---------------------------------------------------------------------------
// 5. Question Bank: filter by topic + JSON export download
// ---------------------------------------------------------------------------

test("question bank filters by topic and exports published questions as JSON", async () => {
  await page.goto("/question-bank");

  // Filter to a seeded topic via the GET form.
  await page.locator("#filter-topic").fill("Logic Gates");
  await page.getByRole("button", { name: /apply filters/i }).click();
  await expect(page).toHaveURL(/topic=Logic\+Gates/);

  // Every visible row is on-topic (topic is the 5th column).
  const topicCells = page.locator("tbody td:nth-child(5)");
  const rows = await topicCells.count();
  expect(rows).toBeGreaterThan(0);
  for (let i = 0; i < rows; i += 1) {
    expect(await topicCells.nth(i).innerText()).toContain("Logic Gates");
  }

  // JSON export triggers a real attachment download of published questions.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "JSON", exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^question-bank(-.*)?\.json$/);
});

// ---------------------------------------------------------------------------
// 6. Analytics: charts render for the default class
// ---------------------------------------------------------------------------

test("analytics renders the aggregate charts for the default class", async () => {
  await page.goto("/analytics");

  await expect(
    page.getByRole("heading", { name: /class analytics/i }),
  ).toBeVisible();

  // Quick stats (uppercase CSS transform — match case-insensitively).
  await expect(page.getByText(/class average/i).first()).toBeVisible();
  await expect(page.getByText(/quiz completion/i).first()).toBeVisible();

  // The three recharts surfaces (trend, topic performance, difficulty mix)
  // actually render for the default (first) class.
  await expect(page.locator(".recharts-wrapper").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator(".recharts-surface")).toHaveCount(3, {
    timeout: 30_000,
  });

  // Topic performance table has rows for the class's topics.
  const topicRows = page.locator("table tbody tr");
  expect(await topicRows.count()).toBeGreaterThan(0);
});
