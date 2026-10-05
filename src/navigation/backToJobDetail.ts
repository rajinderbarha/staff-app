/**
 * "Back" from a job workflow screen (work, estimate, inspection, proof,
 * payment, parts) to that job's Job Detail.
 *
 * These screens used to call `navigate("JobDetail")`. Since React Navigation 7
 * that PUSHES a new Job Detail instead of returning to the existing one, so one
 * job built a stack like Detail → Work → Detail → Proof → Detail → Payment →
 * Detail, and the hardware back button walked the technician through every
 * finished step again. `popTo` returns to the Job Detail already in the stack
 * (or replaces the current screen with one when the workflow screen was opened
 * straight from a list).
 */
export interface JobDetailBackNavigation {
  navigate: (name: "JobDetail", params: { jobId: string }) => void;
  popTo?: (name: "JobDetail", params: { jobId: string }) => void;
}

export function backToJobDetail(navigation: JobDetailBackNavigation, jobId: string): void {
  if (typeof navigation.popTo === "function") {
    navigation.popTo("JobDetail", { jobId });
    return;
  }
  navigation.navigate("JobDetail", { jobId });
}
