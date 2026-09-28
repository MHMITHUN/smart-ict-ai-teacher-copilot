import { beforeAll, afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * Review-state access rules (spec 20.1 + 20.10, decided in
 * src/lib/artifacts/review-access.ts):
 *
 *   VISIBILITY — every signed-in teacher sees every artifact, draft or
 *   approved (shared catalog; no per-teacher silo).
 *   APPROVAL  — only the teacher who CREATED the draft, or an ADMIN,
 *   may approve it. Enforced in the approve server actions (mocked auth
 *   here), mirrored in the editor UI (approve button hidden).
 */

// The signed-in user the mocked guard reports; tests switch identity.
const session: { user: { id: string; role: "TEACHER" | "ADMIN" } } = {
  user: { id: "usr-teacher-01", role: "TEACHER" },
};

vi.mock("@/lib/auth/guards", () => ({
  requireRole: vi.fn(async () => session.user),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { getStore, resetStoreForTests } from "@/lib/db";
import { MockProvider } from "@/lib/ai/mock";
import { LessonPlanSchema } from "@/lib/ai/schemas";
import { approveLessonPlanAction } from "@/app/actions/lessons";
import {
  canApproveArtifact,
  APPROVAL_DENIED_NOTE,
} from "@/lib/artifacts/review-access";
import { DraftEditorShell } from "@/components/artifacts/DraftEditorShell";
import type { LessonPlanDoc } from "@/lib/db/types";

const TEACHER_1 = "usr-teacher-01"; // Nusrat (creator in these tests)
const TEACHER_2 = "usr-teacher-02"; // Tanvir (a different teacher)
const ADMIN = "usr-admin-01";

const UNIQUE_TOPIC = "Review Access Probe Topic";

beforeAll(() => {
  delete process.env.MONGODB_URI;
  resetStoreForTests();
});

afterEach(() => {
  cleanup(); // no vitest globals: RTL does not auto-unmount between tests
});

async function createDraft(createdBy: string): Promise<LessonPlanDoc> {
  const store = await getStore();
  const provider = new MockProvider();
  const promptInput = {
    topic: UNIQUE_TOPIC,
    classLevel: "HSC",
    durationMin: 40,
    objectives: [],
    priorKnowledge: "",
    assessmentStyle: "Exit ticket",
  };
  const result = await provider.generate("lesson", promptInput, LessonPlanSchema);
  return store.createLessonPlan({
    title: result.data.title,
    topic: UNIQUE_TOPIC,
    classLevel: "HSC",
    durationMin: 40,
    objectives: result.data.learningObjectives,
    content: result.data,
    promptInput,
    provider: result.provider,
    model: result.model,
    createdBy,
  });
}

// ---------------------------------------------------------------------------
// The rule itself
// ---------------------------------------------------------------------------

describe("canApproveArtifact (the review-access rule)", () => {
  const artifact = { createdBy: TEACHER_1 };

  it("lets the creating teacher approve their own draft", () => {
    expect(
      canApproveArtifact({ id: TEACHER_1, role: "TEACHER" }, artifact),
    ).toBe(true);
  });

  it("denies a DIFFERENT teacher (drafts are shared, approval is not)", () => {
    expect(
      canApproveArtifact({ id: TEACHER_2, role: "TEACHER" }, artifact),
    ).toBe(false);
  });

  it("lets an admin approve any draft", () => {
    expect(canApproveArtifact({ id: ADMIN, role: "ADMIN" }, artifact)).toBe(
      true,
    );
  });

  it("is honest about ids that merely overlap (exact id match required)", () => {
    expect(
      canApproveArtifact({ id: `${TEACHER_1}-x`, role: "TEACHER" }, artifact),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Visibility: drafts are visible to ALL teachers (shared catalog)
// ---------------------------------------------------------------------------

describe("draft visibility (all teachers see every draft)", () => {
  it("lists another teacher's draft in the unfiltered catalog listing", async () => {
    const store = await getStore();
    const draft = await createDraft(TEACHER_1); // created by teacher 1...

    // ...and teacher 2 (or anyone querying the catalog) still sees it:
    const listing = await store.listLessonPlans({ topic: UNIQUE_TOPIC });
    expect(listing.some((doc) => doc.id === draft.id)).toBe(true);
    // The listing is not creator-scoped in any way — visibility is shared.
    expect(listing.every((doc) => typeof doc.createdBy === "string")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Server-side enforcement in the approve action
// ---------------------------------------------------------------------------

describe("approveLessonPlanAction (server-side enforcement)", () => {
  it("approves when the creator acts, stamping their account + time", async () => {
    const store = await getStore();
    const draft = await createDraft(TEACHER_1);
    session.user = { id: TEACHER_1, role: "TEACHER" };

    const formData = new FormData();
    formData.set("id", draft.id);
    await approveLessonPlanAction(formData);

    const approved = await store.getLessonPlan(draft.id);
    expect(approved?.status).toBe("approved");
    expect(approved?.approvedBy).toBe(TEACHER_1);
    expect(approved?.approvedAt).toBeDefined();
  });

  it("redirects a NON-creator teacher to /403 and leaves the draft untouched", async () => {
    const store = await getStore();
    const draft = await createDraft(TEACHER_1);
    session.user = { id: TEACHER_2, role: "TEACHER" };

    const formData = new FormData();
    formData.set("id", draft.id);
    const outcome = await approveLessonPlanAction(formData).then(
      () => null,
      (error) => error,
    );

    expect(outcome).toBeInstanceOf(Error);
    expect((outcome as Error).message).toBe("REDIRECT:/403");

    const stillDraft = await store.getLessonPlan(draft.id);
    expect(stillDraft?.status).toBe("draft");
    expect(stillDraft?.approvedBy).toBeUndefined();
  });

  it("lets an ADMIN approve a draft they did not create", async () => {
    const store = await getStore();
    const draft = await createDraft(TEACHER_1);
    session.user = { id: ADMIN, role: "ADMIN" };

    const formData = new FormData();
    formData.set("id", draft.id);
    await approveLessonPlanAction(formData);

    const approved = await store.getLessonPlan(draft.id);
    expect(approved?.status).toBe("approved");
    expect(approved?.approvedBy).toBe(ADMIN);
  });

  it("no-ops for an unknown id instead of throwing", async () => {
    session.user = { id: TEACHER_1, role: "TEACHER" };
    const formData = new FormData();
    formData.set("id", "lplan-does-not-exist");
    await expect(approveLessonPlanAction(formData)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// UI mirror: the approve button reflects the rule
// ---------------------------------------------------------------------------

describe("DraftEditorShell (approve button visibility)", () => {
  const noopAction = async () => {};

  it("shows the approve form to a teacher who may approve", () => {
    render(
      <DraftEditorShell
        title="Probe lesson"
        artifactId="lplan-x"
        provider="mock"
        model="mock-template-v1"
        status="draft"
        approveAction={noopAction}
        approveLabel="Approve lesson plan"
        canApprove
      >
        <p>editor</p>
      </DraftEditorShell>,
    );
    expect(
      screen.getByRole("button", { name: /approve lesson plan/i }),
    ).toBeVisible();
    expect(screen.queryByText(/Approval reserved/i)).toBeNull();
  });

  it("hides the approve form and explains the rule when canApprove is false", () => {
    render(
      <DraftEditorShell
        title="Probe lesson"
        artifactId="lplan-x"
        provider="mock"
        model="mock-template-v1"
        status="draft"
        approveAction={noopAction}
        approveLabel="Approve lesson plan"
        canApprove={false}
      >
        <p>editor</p>
      </DraftEditorShell>,
    );
    expect(
      screen.queryByRole("button", { name: /approve lesson plan/i }),
    ).toBeNull();
    const note = screen.getByText(new RegExp(APPROVAL_DENIED_NOTE.slice(0, 30), "i"));
    expect(note).toBeVisible();
  });

  it("shows no approve form at all once the artifact is approved", () => {
    render(
      <DraftEditorShell
        title="Probe lesson"
        artifactId="lplan-x"
        provider="mock"
        model="mock-template-v1"
        status="approved"
        approvedAt="2026-05-01T09:00:00.000Z"
        approveAction={noopAction}
        canApprove
      >
        <p>editor</p>
      </DraftEditorShell>,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
