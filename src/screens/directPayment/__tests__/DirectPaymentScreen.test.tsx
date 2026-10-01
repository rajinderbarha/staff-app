import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ThemeProvider } from "../../../design-system/themes";
import { DirectPaymentScreen } from "../DirectPaymentScreen";
import { DirectPaymentDetailDTO, DirectPaymentMethod } from "../../../services/directPayment/types";

jest.mock("../useDirectPayment");
jest.mock("../../../hooks/useNetworkStatus", () => ({ useNetworkStatus: jest.fn(() => ({ meta: { readiness: "production_ready" }, networkState: "online", cacheState: "fresh", pendingDrafts: 0, syncState: "idle" })) }));

import { useDirectPayment } from "../useDirectPayment";
import { useNetworkStatus } from "../../../hooks/useNetworkStatus";

const mockNavigate = jest.fn();
const navigation = { navigate: mockNavigate } as any;
const route = { params: { jobId: "j1" } } as any;

const BASE_DETAIL: DirectPaymentDetailDTO = {
  job: { job_id: "j1", job_reference: "HS-1044", workflow_status: "work_done", is_terminal: false },
  amount: {
    expected_amount: "1701.00", expected_amount_source: "approved_estimate", unresolved_reason: null, currency: "INR",
    approved_estimate: { quote_id: "q1", version_number: 1, total_amount: "1701.00", is_approved: true },
    visit_fee: "299", visit_fee_adjustment: "-299", requires_direct_payment_record: true,
  },
  prerequisites: { completion_proof_submitted: true, customer_handover_status: "requested" },
  provider_record: null,
  closure_readiness: { can_submit_provider_record: true, can_finalize: false, blockers: ["CUSTOMER_HANDOVER_NOT_ACKNOWLEDGED", "PAYMENT_NOT_DECLARED"] },
  // The backend default for a provider with no finance-readiness row.
  allowed_methods: ["onsite_cash", "onsite_upi"],
  allowed_actions: ["declare_payment", "report_payment_not_received"],
};

function baseHookReturn(overrides: Partial<ReturnType<typeof useDirectPayment>> = {}) {
  return {
    data: BASE_DETAIL, isLoading: false, isError: false, error: null, isRefetching: false, refetch: jest.fn(),
    mutating: false, mutationError: null,
    declarePayment: jest.fn(async () => ({ ok: true as const })),
    reportPaymentNotReceived: jest.fn(async () => ({ ok: true as const })),
    remindCustomer: jest.fn(async () => ({ ok: true as const })),
    finalizeJob: jest.fn(async () => ({ ok: true as const })),
    ...overrides,
  };
}

function renderScreen() {
  return render(<ThemeProvider><DirectPaymentScreen route={route} navigation={navigation} /></ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  (useNetworkStatus as jest.Mock).mockReturnValue({ meta: { readiness: "production_ready" }, networkState: "online", cacheState: "fresh", pendingDrafts: 0, syncState: "idle" });
});

describe("DirectPaymentScreen — declaration state (spec sections 1, 3, 6, 8)", () => {
  it("renders the backend-calculated amount, read-only, and the direct-payment disclaimer", () => {
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn());
    renderScreen();
    expect(screen.getAllByText("₹1,701").length).toBeGreaterThan(0);
    expect(screen.getByText("Customer pays the provider directly. Fuvay does not collect this payment.")).toBeTruthy();
    expect(screen.getByText("Backend calculated")).toBeTruthy();
  });

  it("requires the provider-assertion checkbox before submission is enabled", () => {
    const declarePayment = jest.fn(async () => ({ ok: true as const }));
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ declarePayment }));
    renderScreen();
    fireEvent.press(screen.getByText("Submit payment record"));
    expect(declarePayment).not.toHaveBeenCalled();
  });

  it("submits the declared payment through the real mutation once confirmed", () => {
    const declarePayment = jest.fn(async () => ({ ok: true as const }));
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ declarePayment }));
    renderScreen();
    // "Yes, received" is the explicit confirmation the old checkbox gave.
    fireEvent.press(screen.getByText("Yes, received"));
    fireEvent.press(screen.getByText("Submit payment record"));
    expect(declarePayment).toHaveBeenCalledWith({ amount: "1701.00", method: "onsite_cash", reference_id: undefined });
  });

  it("never renders a card/gateway/PAN field", () => {
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn());
    renderScreen();
    expect(screen.queryByLabelText("Card number")).toBeNull();
    expect(screen.queryByText("Pay now")).toBeNull();
  });
});

describe("DirectPaymentScreen — awaiting customer / closure readiness", () => {
  it("shows customer-confirmation status and a reminder action once declared", () => {
    const detail = {
      ...BASE_DETAIL,
      provider_record: { id: "p1", declared_amount: "1701.00", expected_amount: "1701.00", currency: "INR", method: "onsite_cash", method_label: "Cash", provider_confirmation: { state: "confirmed", at: null }, customer_confirmation: { state: "pending", at: null, action: null }, status: "awaiting_customer" as const, status_label: "Awaiting customer", dispute_complaint_id: null, reminder_count: 0, last_reminder_at: null },
      allowed_actions: ["remind_customer"],
    };
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ data: detail }));
    renderScreen();
    expect(screen.getByText("Awaiting customer confirmation")).toBeTruthy();
    expect(screen.getByText("Send reminder")).toBeTruthy();
  });

  it("shows the final closure readiness checklist", () => {
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn());
    renderScreen();
    expect(screen.getByText("Completion proof")).toBeTruthy();
    expect(screen.getByText("Customer handover")).toBeTruthy();
    expect(screen.getByText("Provider payment record")).toBeTruthy();
    expect(screen.getByText("Customer payment confirmation")).toBeTruthy();
  });

  it("offers a way back while the backend has not allowed finalization", () => {
    const finalizeJob = jest.fn(async () => ({ ok: true as const }));
    const detail = { ...BASE_DETAIL, provider_record: { id: "p1", declared_amount: "1701.00", expected_amount: "1701.00", currency: "INR", method: "onsite_cash", method_label: "Cash", provider_confirmation: { state: "confirmed", at: null }, customer_confirmation: { state: "pending", at: null, action: null }, status: "awaiting_customer" as const, status_label: "Awaiting customer", dispute_complaint_id: null, reminder_count: 0, last_reminder_at: null }, allowed_actions: ["remind_customer"] };
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ data: detail, finalizeJob }));
    renderScreen();
    expect(screen.queryByText("Complete job")).toBeNull();
    fireEvent.press(screen.getByText("Back to job"));
    expect(finalizeJob).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("JobDetail", { jobId: "j1" });
  });

  it("calls finalize once the backend allows it, and returns to Job Detail", () => {
    const finalizeJob = jest.fn(async () => ({ ok: true as const }));
    const detail = {
      ...BASE_DETAIL,
      provider_record: { id: "p1", declared_amount: "1701.00", expected_amount: "1701.00", currency: "INR", method: "onsite_cash", method_label: "Cash", provider_confirmation: { state: "confirmed", at: null }, customer_confirmation: { state: "confirmed", at: null, action: null }, status: "confirmed" as const, status_label: "Confirmed", dispute_complaint_id: null, reminder_count: 0, last_reminder_at: null },
      closure_readiness: { can_submit_provider_record: false, can_finalize: true, blockers: [] },
      allowed_actions: ["finalize_job"],
    };
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ data: detail, finalizeJob }));
    renderScreen();
    fireEvent.press(screen.getByText("Complete job"));
    expect(finalizeJob).toHaveBeenCalled();
  });
});

describe("DirectPaymentScreen — completed read-only state (spec section 20)", () => {
  it("shows a read-only completed state with no further mutation controls", () => {
    const detail = { ...BASE_DETAIL, job: { ...BASE_DETAIL.job, workflow_status: "completed", is_terminal: true } };
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ data: detail }));
    renderScreen();
    expect(screen.getByText("Job completed")).toBeTruthy();
    expect(screen.queryByText("Complete job")).toBeNull();
    expect(screen.queryByText("Submit payment record")).toBeNull();
  });
});

describe("DirectPaymentScreen — offline/loading/error", () => {
  it("goes read-only offline", () => {
    (useNetworkStatus as jest.Mock).mockReturnValue({ meta: { readiness: "production_ready" }, networkState: "offline", cacheState: "fresh", pendingDrafts: 0, syncState: "idle" });
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn());
    renderScreen();
    expect(screen.getByText("Offline")).toBeTruthy();
  });

  it("shows a loading skeleton", () => {
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ data: undefined, isLoading: true }));
    renderScreen();
    expect(screen.queryByText("₹1,701")).toBeNull();
  });

  it("shows a retryable error state", () => {
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ data: undefined, isError: true, error: { safeMessage: "Something went wrong.", code: "SERVER_UNAVAILABLE", category: "server", retryable: true } }));
    renderScreen();
    expect(screen.getByText("Retry")).toBeTruthy();
  });

  it("returns to Job Detail via the back button", () => {
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn());
    renderScreen();
    fireEvent.press(screen.getByLabelText("Back"));
    expect(mockNavigate).toHaveBeenCalledWith("JobDetail", { jobId: "j1" });
  });
});


describe("DirectPaymentScreen — did the provider receive the payment?", () => {
  it("asks, and does not let a payment be recorded until it is answered", () => {
    const declarePayment = jest.fn(async () => ({ ok: true as const }));
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ declarePayment }));
    renderScreen();
    expect(screen.getByText(/Did the provider receive/)).toBeTruthy();
    expect(screen.getByText("Yes, received")).toBeTruthy();
    expect(screen.getByText("No, not received")).toBeTruthy();

    fireEvent.press(screen.getByText("Submit payment record"), { stopPropagation: jest.fn() });
    expect(declarePayment).not.toHaveBeenCalled();
  });

  it("on No, requires an expected method before reporting nonreceipt to the backend", () => {
    const declarePayment = jest.fn(async () => ({ ok: true as const }));
    const reportPaymentNotReceived = jest.fn(async () => ({ ok: true as const }));
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ declarePayment, reportPaymentNotReceived }));
    renderScreen();
    fireEvent.press(screen.getByText("No, not received"));

    expect(screen.getByText("Payment not received")).toBeTruthy();
    expect(screen.getByText(/job stays open/)).toBeTruthy();
    expect(screen.getByText("How was payment expected?")).toBeTruthy();
    expect(screen.queryByText("Submit payment record")).toBeNull();
    fireEvent.press(screen.getByText("Report not received"));
    expect(reportPaymentNotReceived).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("UPI"));
    fireEvent.press(screen.getByText("Report not received"));
    expect(reportPaymentNotReceived).toHaveBeenCalledWith({ method: "onsite_upi" });
    expect(declarePayment).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("lets staff choose Cash or UPI when an older detail response omits the nonreceipt action", () => {
    const reportPaymentNotReceived = jest.fn(async () => ({ ok: true as const }));
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({
      data: { ...BASE_DETAIL, allowed_actions: [] },
      reportPaymentNotReceived,
    }));
    renderScreen();
    fireEvent.press(screen.getByText("No, not received"));
    fireEvent.press(screen.getByText("Cash"));
    fireEvent.press(screen.getByText("UPI"));
    fireEvent.press(screen.getByText("Report not received"));
    expect(reportPaymentNotReceived).toHaveBeenCalledWith({ method: "onsite_upi" });
  });

  it("shows the saved nonreceipt record and a path back while the customer responds", () => {
    const detail = {
      ...BASE_DETAIL,
      provider_record: {
        id: "p1", declared_amount: "1701.00", expected_amount: "1701.00", currency: "INR",
        method: "onsite_upi", method_label: "UPI", provider_payment_claim: "not_received" as const,
        provider_confirmation: { state: "not_received", at: null },
        customer_confirmation: { state: "pending", at: null, action: null },
        status: "awaiting_customer" as const, status_label: "Awaiting customer", dispute_complaint_id: null,
        reminder_count: 0, last_reminder_at: null,
      },
      closure_readiness: { can_submit_provider_record: false, can_finalize: false, blockers: ["PAYMENT_NOT_RECONCILED"] },
      allowed_actions: ["remind_customer"],
    };
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ data: detail }));
    renderScreen();
    expect(screen.getByText("Payment follow-up")).toBeTruthy();
    expect(screen.getByText(/Your nonreceipt report was saved/)).toBeTruthy();
    expect(screen.getByText("Customer response or provider resolution")).toBeTruthy();
    expect(screen.queryByText("Complete job")).toBeNull();
    fireEvent.press(screen.getByText("Back to job"));
    expect(mockNavigate).toHaveBeenCalledWith("JobDetail", { jobId: "j1" });
  });

  it("shows provider follow-up when the customer says they paid", () => {
    const detail: DirectPaymentDetailDTO = {
      ...BASE_DETAIL,
      provider_record: {
        id: "p1", declared_amount: "1701.00", expected_amount: "1701.00", currency: "INR",
        method: "onsite_upi", method_label: "UPI", provider_payment_claim: "not_received",
        provider_confirmation: { state: "not_received", at: null },
        customer_confirmation: { state: "mismatched", at: null, action: "paid_claim" },
        status: "mismatched", status_label: "Mismatch", dispute_complaint_id: null,
        reminder_count: 0, last_reminder_at: null,
      },
      closure_readiness: { can_submit_provider_record: false, can_finalize: false, blockers: ["PAYMENT_NOT_RECONCILED"] },
      allowed_actions: [],
    };
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ data: detail }));
    renderScreen();
    expect(screen.getByText("Customer says they paid; provider verification needed")).toBeTruthy();
    expect(screen.getByText(/Ask your provider to verify/)).toBeTruthy();
    expect(screen.queryByText("Complete job")).toBeNull();
  });

  it("allows job closure after the backend resolves nonreceipt as unpaid", () => {
    const finalizeJob = jest.fn(async () => ({ ok: true as const }));
    const detail: DirectPaymentDetailDTO = {
      ...BASE_DETAIL,
      prerequisites: { ...BASE_DETAIL.prerequisites, customer_handover_status: "acknowledged" },
      provider_record: {
        id: "p1", declared_amount: "1701.00", expected_amount: "1701.00", currency: "INR",
        method: "onsite_upi", method_label: "UPI", provider_payment_claim: "not_received",
        provider_confirmation: { state: "not_received", at: null },
        customer_confirmation: { state: "pending", at: null, action: "not_paid" },
        status: "unpaid", status_label: "Unpaid", dispute_complaint_id: null,
        reminder_count: 0, last_reminder_at: null,
      },
      closure_readiness: { can_submit_provider_record: false, can_finalize: true, blockers: [] },
      allowed_actions: ["finalize_job"],
    };
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ data: detail, finalizeJob }));
    renderScreen();
    expect(screen.getByText("Payment confirmed as not received")).toBeTruthy();
    expect(screen.getAllByText("Complete")).toHaveLength(4);
    fireEvent.press(screen.getByText("Complete job"));
    expect(finalizeJob).toHaveBeenCalledTimes(1);
  });

  it("treats a provider's formal unresolved outcome as ready for closure", () => {
    const detail: DirectPaymentDetailDTO = {
      ...BASE_DETAIL,
      prerequisites: { ...BASE_DETAIL.prerequisites, customer_handover_status: "acknowledged" },
      provider_record: {
        id: "p1", declared_amount: "1701.00", expected_amount: "1701.00", currency: "INR",
        method: "onsite_upi", method_label: "UPI", provider_payment_claim: "not_received",
        provider_resolution_action: "unresolved",
        provider_confirmation: { state: "not_received", at: null },
        customer_confirmation: { state: "mismatched", at: null, action: "paid_claim" },
        status: "disputed", status_label: "Disputed", dispute_complaint_id: null,
        reminder_count: 0, last_reminder_at: null,
      },
      closure_readiness: { can_submit_provider_record: false, can_finalize: true, blockers: [] },
      allowed_actions: ["finalize_job"],
    };
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ data: detail }));
    renderScreen();
    expect(screen.getByText("Provider closed payment review as unresolved")).toBeTruthy();
    expect(screen.getByText(/payment outcome is recorded/)).toBeTruthy();
    expect(screen.queryByText(/follow-up needed/)).toBeNull();
    expect(screen.getByText("Complete job")).toBeTruthy();
  });
});

describe("DirectPaymentScreen — only the methods the provider accepts", () => {
  it("offers Cash and UPI, and not the Card or Bank transfer the app used to hardcode", () => {
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn());
    renderScreen();
    fireEvent.press(screen.getByText("Yes, received"));
    expect(screen.getByText("Cash")).toBeTruthy();
    expect(screen.getByText("UPI")).toBeTruthy();
    expect(screen.queryByText(/Card/)).toBeNull();
    expect(screen.queryByText("Bank transfer")).toBeNull();
  });

  it("follows the backend, not a fixed pair: a provider who enables card sees card", () => {
    const methods: DirectPaymentMethod[] = ["onsite_cash", "onsite_upi", "onsite_card"];
    const withCard = { ...BASE_DETAIL, allowed_methods: methods };
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ data: withCard }));
    renderScreen();
    fireEvent.press(screen.getByText("Yes, received"));
    expect(screen.getByText("Card (provider terminal)")).toBeTruthy();
  });

  it("records the method that was chosen", () => {
    const declarePayment = jest.fn(async () => ({ ok: true as const }));
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ declarePayment }));
    renderScreen();
    fireEvent.press(screen.getByText("Yes, received"));
    fireEvent.press(screen.getByText("UPI"));
    fireEvent.changeText(screen.getByPlaceholderText("Enter UPI/reference ID"), "UTR123");
    fireEvent.press(screen.getByText("Submit payment record"));
    expect(declarePayment).toHaveBeenCalledWith({ amount: "1701.00", method: "onsite_upi", reference_id: "UTR123" });
  });

  it("says so, and cannot submit, when the provider has enabled no method", () => {
    const declarePayment = jest.fn(async () => ({ ok: true as const }));
    const none = { ...BASE_DETAIL, allowed_methods: [] };
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ data: none, declarePayment }));
    renderScreen();
    fireEvent.press(screen.getByText("Yes, received"));
    expect(screen.getByText("No payment method is set up")).toBeTruthy();
    fireEvent.press(screen.getByText("Submit payment record"), { stopPropagation: jest.fn() });
    expect(declarePayment).not.toHaveBeenCalled();
  });
});


describe("DirectPaymentScreen — handover readiness matches what the backend closes on", () => {
  // The backend treats a customer who had already left, as attested by the
  // technician, as a completed handover. This row demanded "acknowledged" only,
  // so a job the server would close showed a Pending handover.
  it("counts a customer who was unavailable as a completed handover", () => {
    const away = {
      ...BASE_DETAIL,
      prerequisites: { ...BASE_DETAIL.prerequisites, customer_handover_status: "customer_unavailable" },
    };
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn({ data: away }));
    renderScreen();
    // Completion proof + customer handover. (No payment record yet, so the two
    // payment rows stay Pending.)
    expect(screen.getAllByText("Complete")).toHaveLength(2);
  });

  it("still shows a merely requested handover as pending", () => {
    // Control: without it the test above would pass on the proof row alone.
    (useDirectPayment as jest.Mock).mockReturnValue(baseHookReturn());
    renderScreen();
    expect(screen.getAllByText("Complete")).toHaveLength(1);
  });
});
