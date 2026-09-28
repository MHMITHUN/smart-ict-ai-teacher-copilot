import type { Role } from "@/lib/db/types";

/**
 * Review-state access rules (spec 20.1 + 20.10).
 *
 * DECISION (kept deliberately simple — spec 11 warns against unnecessary
 * roles/permissions for a teacher tool):
 *   - VISIBILITY: every artifact, draft or approved, is visible to every
 *     signed-in teacher. There is no per-teacher silo: departments share
 *     the catalog, and the review queue on the dashboard counts all drafts.
 *   - APPROVAL: only the teacher who CREATED the draft — or an ADMIN —
 *     may flip it to "approved". Reviewing someone else's draft means
 *     editing it first (edits are allowed for all teachers and recorded
 *     in updatedBy); the final approve click stays with the owner.
 *
 * This module is the single source of truth for the rule; the approve
 * server actions enforce it (never trust the UI alone) and the editor
 * pages use it to hide the approve button from teachers who cannot use it.
 */

/** The viewer fields the approval rule needs. */
export interface ApprovalViewer {
  id: string;
  role: Role;
}

/** Every AI artifact doc carries createdBy. */
export interface OwnedArtifact {
  createdBy: string;
}

/** True when `viewer` may approve `artifact` (creator or admin only). */
export function canApproveArtifact(
  viewer: ApprovalViewer,
  artifact: OwnedArtifact,
): boolean {
  return viewer.role === "ADMIN" || viewer.id === artifact.createdBy;
}

/** Human-readable explanation shown when the approve action is unavailable. */
export const APPROVAL_DENIED_NOTE =
  "Only the teacher who created this draft (or an administrator) can approve it. " +
  "You can still edit the draft — your changes are recorded.";
