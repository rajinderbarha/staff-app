/** DTOs matching app/engines/execution/mobile_work_execution_service.py verbatim. */

export interface WorkExecutionJobDTO {
  job_id: string;
  job_reference: string;
  workflow_status: string;
  is_terminal: boolean;
}

export interface ApprovedScopeDTO {
  quote_id: string;
  version_number: number;
  approved_total: string;
  currency: string;
  approved_at: string | null;
  scope_locked: true;
}

export type WorkSessionState = "active" | "paused" | "finished";

export interface WorkSessionDTO {
  session_id: string;
  job_id: string;
  state: WorkSessionState;
  started_at: string | null;
  paused_at: string | null;
  pause_reason: string | null;
  accumulated_seconds: number;
  finished_at: string | null;
}

import { ChecklistItemDTO } from "../inspection/types";

/** Same wire shape as Phase K's inspection checklist items -- both come
 * from the identical ChecklistItem.to_dict() (checklist_catalog engine). */
export interface WorkChecklistDTO {
  items: ChecklistItemDTO[];
  required_total: number;
  required_completed: number;
  instance_id?: string;
}

export type PartsRequestStatus =
  | "requested" | "business_approved" | "customer_approval_pending"
  | "customer_approved" | "business_rejected" | "customer_rejected" | "installed" | "cancelled";

export interface PartsRequestDTO {
  parts_request_id: string;
  job_id: string;
  part_name: string;
  quantity: number;
  /** Per-unit customer price; for inventory parts, the catalogue price. */
  estimated_cost: number;
  reason: string;
  technician_note: string | null;
  customer_approval_required: boolean;
  status: PartsRequestStatus;
  rejection_reason: string | null;
  created_at: string | null;
  procurement_source?: "inventory" | "external";
  inventory_item_id?: string | null;
}

/** One provider inventory item, as GET .../parts-catalog returns it. The
 * provider's own cost and margin are never sent to the technician. */
export interface PartsCatalogItemDTO {
  item_id: string;
  name: string;
  sku: string;
  category: string | null;
  unit: string;
  /** What the customer pays per unit. */
  unit_price: number;
  warranty: string | null;
  available_qty: number;
  /** The most one request can take: a reservation draws on one stock location. */
  max_request_qty: number;
}

/** A technician picks the part; its name and price come from the inventory. */
export interface CreatePartsRequestBody {
  inventory_item_id: string;
  quantity: number;
  reason: string;
  technician_note?: string;
}

export interface WorkReadinessDTO {
  can_finish_work: boolean;
  missing_checklist_item_ids: string[];
  pending_part_request_ids: string[];
  missing_evidence_categories: string[];
  blockers: string[];
}

export interface WorkExecutionDetailDTO {
  job: WorkExecutionJobDTO;
  approved_scope: ApprovedScopeDTO | null;
  /** Whether this job's blueprint gates work on an approved estimate at all.
   * `null` means the workflow could not be resolved -- treated as "requires
   * one" so an unresolved blueprint never silently drops the money gate. */
  estimate_approval_required: boolean | null;
  work_session: WorkSessionDTO | null;
  checklist: WorkChecklistDTO;
  parts: PartsRequestDTO[];
  readiness: WorkReadinessDTO;
  allowed_actions: string[];
}
