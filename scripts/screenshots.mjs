// Documentation screenshots (spec 24): drives the real app on port 3005 with
// Playwright and saves five PNGs into docs/screenshots/.
//
//   01-dashboard.png       1280x800  teacher@demo.local signed in
//   02-lesson-planner.png  1280x800  a freshly generated (mock) draft visible
//   03-quiz-generator.png  1280x800  a freshly generated MCQ quiz draft
//   04-mobile.png           390x844  dashboard at phone width
//   05-analytics.png       1280x800  class analytics charts for class 10A
//
// Run while the dev server is up:  node scripts/screenshots.mjs
// (Demo mode is fine — drafts are honestly labeled mock samples.)

import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const BASE_URL = process.env.SCREENSHOTS_BASE_URL ?? "http://localhost:3005";
const OUT_DIR = path.resolve(import.meta.dirname, "../docs/screenshots");
const TEACHER_EMAIL = "teacher@demo.local";
const TEACHER_PASSWORD = "Demo@12345";

mkdirSync(OUT_DIR, { recursive: true });

/** Save a screenshot and refuse silently-tiny output files. */
async function snap(page, name) {
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file });
  const { size } = await import("node:fs").then((fs) => fs.statSync(file));
  const kb = Math.round(size / 1024);
  if (kb < 20) {
    throw new Error(`${name} is only ${kb}KB — likely a blank/route-failed shot`);
  }
  console.log(`saved ${name} (${kb}KB)`);
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Email").fill(TEACHER_EMAIL);
  await page.getByLabel("Password").fill(TEACHER_PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

const browser = await chromium.launch();

// --- Desktop pass (1280x800 @2x) -------------------------------------------
const desktop = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
});
const page = await desktop.newPage();

await login(page);
// Dashboard: greeting + stats settled before the shot.
await page.getByText(/welcome back/i).waitFor({ timeout: 30_000 });
await page.getByText(/your workspace at a glance/i).waitFor({ timeout: 30_000 });
await snap(page, "01-dashboard.png");

// Lesson planner: generate a real (mock-provider) draft through the UI so the
// editor with the "AI-generated draft" badge is visible in the shot.
await page.goto(`${BASE_URL}/lesson-planner`);
await page.getByLabel("Topic", { exact: true }).fill("Number Systems");
await page.click('form:has(input[name="topic"]) button[type="submit"]');
await page.waitForURL(/\/lesson-planner\?id=/, { timeout: 60_000 });
await page.getByText(/AI-generated draft/i).first().waitFor({ timeout: 30_000 });
await page.getByLabel("Lesson title").waitFor({ timeout: 30_000 });
await snap(page, "02-lesson-planner.png");

// Quiz generator: generate a 5-question MCQ draft through the UI.
await page.goto(`${BASE_URL}/quiz-generator`);
await page.getByLabel("Topic", { exact: true }).fill("Logic Gates");
await page.getByLabel("Number of questions").fill("5");
await page.getByLabel("Quiz type").selectOption("MCQ");
await page.click('form:has(input[name="topic"]) button[type="submit"]');
await page.waitForURL(/\/quiz-generator\?id=/, { timeout: 60_000 });
await page.getByText(/AI-generated draft/i).first().waitFor({ timeout: 30_000 });
await snap(page, "03-quiz-generator.png");

// Analytics: charts for the default class.
await page.goto(`${BASE_URL}/analytics`);
await page.getByRole("heading", { name: /class analytics/i }).waitFor({
  timeout: 30_000,
});
await page.locator(".recharts-wrapper").first().waitFor({
  timeout: 60_000,
});
await page.waitForTimeout(500); // let recharts finish their entrance animation
await snap(page, "05-analytics.png");

await desktop.close();

// --- Mobile pass (390x844 @3x) ----------------------------------------------
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const mpage = await mobile.newPage();
await login(mpage);
await mpage.getByText(/welcome back/i).waitFor({ timeout: 30_000 });
await snap(mpage, "04-mobile.png");
await mobile.close();

await browser.close();
console.log("all screenshots captured");
