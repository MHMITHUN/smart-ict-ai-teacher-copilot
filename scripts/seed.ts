/**
 * Seed script (npm run seed).
 *
 * With MONGODB_URI set: connects to MongoDB, ensures the same indexes the
 * app creates (mirrors MongoStore.ensureIndexes in src/lib/db/mongo.ts)
 * and writes the FULL demo dataset idempotently via the shared builder
 * (src/lib/db/seeds/build.ts — the exact documents DemoStore seeds in
 * memory): users by email; lessons, quizzes, worksheets, rubrics,
 * explanations, questions and quiz results by id; class groups by name.
 * Everything uses $setOnInsert, so re-running never overwrites teacher
 * edits or real activity — it only fills what is missing.
 *
 * Without MONGODB_URI: the app runs on the in-memory DemoStore, which
 * seeds itself lazily on first access - nothing to persist here.
 * Exits 0 both ways.
 */

import type { Collection, Document } from "mongodb";

interface SeedReport {
  inserted: number;
  alreadyPresent: number;
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log(
      "Demo mode: no MONGODB_URI. The in-app demo store seeds itself automatically - nothing to do.",
    );
    console.log(
      "Demo accounts: admin@demo.local / teacher@demo.local (password Demo@12345).",
    );
    return;
  }

  const { MongoClient } = await import("mongodb");
  const { buildSeedData } = await import("../src/lib/db/seeds/build");
  const { DEMO_PASSWORD } = await import("../src/lib/db/seeds/users");

  const data = await buildSeedData();

  const dbName = process.env.MONGODB_DB_NAME || "ai_teacher_copilot";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    console.log(`Connected to MongoDB (database: ${dbName}).`);

    // ---- indexes (mirrors MongoStore.ensureIndexes in src/lib/db/mongo.ts;
    // MongoStore.create() creates the same ones when the app boots) --------
    const users = db.collection("users");
    await users.createIndex({ email: 1 }, { unique: true });
    await db.collection("lessonPlans").createIndex({ createdBy: 1, createdAt: -1 });
    await db.collection("lessonPlans").createIndex({ status: 1, createdAt: -1 });
    await db.collection("quizzes").createIndex({ createdBy: 1, createdAt: -1 });
    await db.collection("quizzes").createIndex({ status: 1, createdAt: -1 });
    await db.collection("worksheets").createIndex({ createdBy: 1, createdAt: -1 });
    await db.collection("rubrics").createIndex({ createdBy: 1, createdAt: -1 });
    await db.collection("explanations").createIndex({ createdBy: 1, createdAt: -1 });
    await db.collection("questions").createIndex({ topic: 1, status: 1 });
    await db.collection("questions").createIndex({ createdBy: 1, createdAt: -1 });
    await db.collection("classGroups").createIndex({ name: 1 }, { unique: true });
    await db.collection("quizResults").createIndex({ classId: 1, createdAt: -1 });
    console.log("Indexes ensured.");

    /** Insert-if-missing counter; never touches existing documents. */
    async function seedAll<T extends object>(
      collection: Collection<Document>,
      rows: T[],
      keyOf: (row: T) => Record<string, unknown>,
      label: string,
    ): Promise<SeedReport> {
      let inserted = 0;
      for (const row of rows) {
        const result = await collection.updateOne(
          keyOf(row) as Document,
          { $setOnInsert: row as Document },
          { upsert: true },
        );
        if (result.upsertedCount > 0) inserted += 1;
      }
      const report = { inserted, alreadyPresent: rows.length - inserted };
      console.log(
        `${label}: ${rows.length} seed rows -> ${report.inserted} inserted, ${report.alreadyPresent} already present (collection total: ${await collection.countDocuments()}).`,
      );
      return report;
    }

    // ---- users (password is scrypt-hashed inside buildSeedData) ----------
    await seedAll(users, data.users, (row) => ({ email: row.email }), "Users");

    // ---- AI artifact catalog (drafts + approved samples) ------------------
    await seedAll(
      db.collection("lessonPlans"),
      data.lessons,
      (row) => ({ id: row.id }),
      "Lesson plans",
    );
    await seedAll(
      db.collection("quizzes"),
      data.quizzes,
      (row) => ({ id: row.id }),
      "Quizzes",
    );
    await seedAll(
      db.collection("worksheets"),
      data.worksheets,
      (row) => ({ id: row.id }),
      "Worksheets",
    );
    await seedAll(
      db.collection("rubrics"),
      data.rubrics,
      (row) => ({ id: row.id }),
      "Rubrics",
    );
    await seedAll(
      db.collection("explanations"),
      data.explanations,
      (row) => ({ id: row.id }),
      "Explanations",
    );

    // ---- question bank + analytics demo data ------------------------------
    await seedAll(
      db.collection("questions"),
      data.questions,
      (row) => ({ id: row.id }),
      "Questions",
    );
    await seedAll(
      db.collection("classGroups"),
      data.classGroups,
      (row) => ({ name: row.name }),
      "Class groups",
    );
    await seedAll(
      db.collection("quizResults"),
      data.quizResults,
      (row) => ({ id: row.id }),
      "Quiz results",
    );

    console.log(
      `Seed complete. Demo password for every account: ${DEMO_PASSWORD} (teacher@demo.local / admin@demo.local).`,
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
