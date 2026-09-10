import { JobExecutionStackParamList } from "../../navigation/routeTypes";

/**
 * Maps a backend `next_required_action.key` to how the mobile app handles it.
 *
 * The backend's vocabulary is ROUTE-shaped and hyphenated -- `on-the-way`,
 * `reached-site`, `start-inspection`, `work-done` -- because each key names the
 * real endpoint that performs it (`_NEXT_ACTION_BY_STATUS` in
 * app/engines/home_service_assignment/service.py, whose values match
 * app/engines/execution/home_service_router.py's paths one for one).
 *
 * This module used to key its maps on underscored variants that the backend
 * never sends, so EVERY action past `accept` -- the one key that happens to be
 * spelled the same in both -- fell through to "unhandled" and the button
 * disabled itself. Normalising here, rather than renaming either side, keeps
 * the backend keys equal to the routes they name while still accepting the
 * underscored spellings that older fixtures and payloads use.
 *
 * Unknown keys still fall through to "unhandled" so the button safely disables
 * rather than routing somewhere wrong.
 */
export type ActionHandling =
  | { kind: "mutation"; mutation: "accept" | "on_the_way" | "reached_site" }
  /** Advance the workflow, THEN open the screen that hosts the new stage. */
  | { kind: "mutation_then_navigate"; mutation: "start_inspection"; screen: keyof JobExecutionStackParamList }
  /** The contact-first task: call the customer and confirm requirements. */
  | { kind: "contact_customer" }
  | { kind: "navigate"; screen: keyof JobExecutionStackParamList }
  | { kind: "blocked" }
  | { kind: "unhandled" };

/** Hyphen/underscore are the same key; the backend sends hyphens. */
function normalize(actionKey: string): string {
  return actionKey.trim().toLowerCase().replace(/-/g, "_");
}

const MUTATION_FOR_ACTION: Record<string, "accept" | "on_the_way" | "reached_site"> = {
  accept: "accept",
  on_the_way: "on_the_way",
  reached_site: "reached_site",
};

const SCREEN_FOR_ACTION: Record<string, keyof JobExecutionStackParamList> = {
  complete_inspection: "Inspection",
  create_estimate: "Estimate",
  // Same screen as create -- the Estimate Builder derives create/view/revise
  // mode from the backend-projected quote state, never a second screen.
  revise_estimate: "Estimate",
  // Work Execution owns both: opening it calls start_service itself when the
  // job is not yet `service_started`, and "Finish Work" is what performs
  // `work-done`. Neither is a Job Detail mutation.
  start_service: "Checklist",
  work_done: "Checklist",
  mark_work_done: "Checklist",
};

const BLOCKED_ACTIONS = new Set(["await_approval", "estimate_rejected", "blocked"]);

/**
 * `complete` is one backend key covering two remaining steps: capture and
 * submit the completion proof, then settle payment and close the job. The
 * payment endpoint refuses with COMPLETION_PROOF_NOT_SUBMITTED until the proof
 * exists, so the proof state -- read from the real proof row, not from job
 * status -- decides which screen the technician needs next.
 */
export function completionScreenFor(completionProofState: string | null | undefined): keyof JobExecutionStackParamList {
  return completionProofState === "submitted" ? "DirectPaymentConfirmation" : "CompletionProof";
}

export function resolveActionHandling(
  actionKey: string | null,
  completionProofState?: string | null,
): ActionHandling {
  if (!actionKey) return { kind: "unhandled" };
  const key = normalize(actionKey);
  if (BLOCKED_ACTIONS.has(key)) return { kind: "blocked" };
  if (key === "call_customer") return { kind: "contact_customer" };
  // Opening the inspection screen does not start the inspection: the checklist
  // endpoints and `complete-inspection` both require the job to be
  // `inspection_started` already, so the transition has to happen first.
  if (key === "start_inspection") {
    return { kind: "mutation_then_navigate", mutation: "start_inspection", screen: "Inspection" };
  }
  if (key === "complete" || key === "complete_job") {
    return { kind: "navigate", screen: completionScreenFor(completionProofState) };
  }
  if (MUTATION_FOR_ACTION[key]) return { kind: "mutation", mutation: MUTATION_FOR_ACTION[key] };
  if (SCREEN_FOR_ACTION[key]) return { kind: "navigate", screen: SCREEN_FOR_ACTION[key] };
  return { kind: "unhandled" };
}

/**
 * Where a list screen (Home, Jobs) should send a technician who taps a job's
 * next-action button. Actions performed ON Job Detail -- its mutations and the
 * contact-first task -- land on Job Detail; the rest open their own screen.
 *
 * Home and Jobs each carried their own two-entry copy of this map keyed on
 * spellings the backend never sends, so every next-action button silently fell
 * back to Job Detail.
 */
export function listScreenForAction(actionKey: string | null | undefined): keyof JobExecutionStackParamList {
  const handling = resolveActionHandling(actionKey ?? null);
  if (handling.kind === "navigate") return handling.screen;
  return "JobDetail";
}
