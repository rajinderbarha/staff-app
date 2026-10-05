import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTheme } from "../../design-system/themes";
import { SafeAreaScreen } from "../../design-system/components/foundation/SafeAreaScreen";
import { Card, Section } from "../../design-system/components/foundation/Layout";
import { AppText } from "../../design-system/components/typography/AppText";
import { IconButton } from "../../design-system/components/actions/IconButton";
import { TextField } from "../../design-system/components/forms/TextField";
import { SegmentedControl } from "../../design-system/components/forms/SegmentedControl";
import { Skeleton } from "../../design-system/components/feedback/Loading";
import { ErrorState } from "../../design-system/components/feedback/States";
import { InlineAlert } from "../../design-system/components/feedback/Banner";
import { PrimaryButton, SecondaryButton } from "../../design-system/components/actions/Buttons";
import { AmountDueCard } from "./components/AmountDueCard";
import { ClosureReadinessList, ReadinessRow } from "./components/ClosureReadinessList";
import { useDirectPayment } from "./useDirectPayment";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { DirectPaymentMethod } from "../../services/directPayment/types";
import { JobExecutionStackParamList } from "../../navigation/routeTypes";
import { backToJobDetail } from "../../navigation/backToJobDetail";

type Props = NativeStackScreenProps<JobExecutionStackParamList, "DirectPaymentConfirmation">;

/**
 * Labels only. WHICH methods are offered is the provider's decision, sent as
 * `allowed_methods` -- this list used to be hardcoded with Card and Bank
 * transfer that most providers have not enabled, and the server refuses a
 * disabled method with DIRECT_PAYMENT_METHOD_NOT_ENABLED. Offering it was
 * offering a button that could only fail.
 */
const METHOD_LABEL: Record<DirectPaymentMethod, string> = {
  onsite_cash: "Cash",
  onsite_upi: "UPI",
  onsite_card: "Card (provider terminal)",
  onsite_bank_transfer: "Bank transfer",
  onsite_other: "Other",
};

/** Did the provider receive the money? Unanswered until the technician says. */
type Received = "yes" | "no" | null;

const RECEIVED_OPTIONS: { value: "yes" | "no"; label: string }[] = [
  { value: "yes", label: "Yes, received" },
  { value: "no", label: "No, not received" },
];

const STATUS_LABEL: Record<string, string> = {
  not_declared: "Not recorded", awaiting_provider: "Awaiting provider", awaiting_customer: "Awaiting customer confirmation",
  confirmed: "Confirmed", mismatched: "Amount mismatch", disputed: "Disputed", cancelled: "Cancelled", reversed: "Reversed",
  unpaid: "Payment unpaid",
};

const NONRECEIPT_STATUS_LABEL: Record<string, string> = {
  awaiting_customer: "Payment not received; customer response pending",
  mismatched: "Customer says they paid; provider verification needed",
  unpaid: "Payment confirmed as not received",
  confirmed: "Payment verified as received",
  disputed: "Payment disputed; provider review pending",
};

/**
 * Direct Payment Confirmation & Final Job Closure (Phase O). Fuvay
 * never collects this payment -- it only records the provider's assertion
 * and the customer's independent confirmation (spec section 1).
 */
export function DirectPaymentScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const { jobId } = route.params;
  const networkStatus = useNetworkStatus();
  const offline = networkStatus.networkState === "offline";

  const [received, setReceived] = useState<Received>(null);
  const [method, setMethod] = useState<DirectPaymentMethod | null>(null);
  const [notReceivedMethod, setNotReceivedMethod] = useState<DirectPaymentMethod | null>(null);
  const [reference, setReference] = useState("");

  const { data, isLoading, isError, error, isRefetching, refetch, mutating, mutationError, declarePayment, reportPaymentNotReceived, remindCustomer, finalizeJob } = useDirectPayment(jobId);

  const goBack = useCallback(() => backToJobDetail(navigation, jobId), [navigation, jobId]);

  const allowedMethods = data?.allowed_methods ?? [];
  useEffect(() => {
    if (!allowedMethods.length) {
      setMethod(null);
    } else if (!method || !allowedMethods.includes(method)) {
      setMethod(allowedMethods[0]);
    }
    if (notReceivedMethod && !allowedMethods.includes(notReceivedMethod)) {
      setNotReceivedMethod(null);
    }
    // `allowedMethods` is rebuilt each render; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedMethods.join(",")]);

  const handleDeclare = useCallback(async () => {
    // Recording a payment asserts the provider has the money, so it is only
    // reachable after an explicit "Yes, received".
    if (received !== "yes" || !method || !data?.amount.expected_amount) return;
    await declarePayment({ amount: data.amount.expected_amount, method, reference_id: reference.trim() || undefined });
  }, [data, declarePayment, method, reference, received]);

  const handleFinalize = useCallback(async () => {
    const result = await finalizeJob();
    if (result.ok) goBack();
  }, [finalizeJob, goBack]);

  const handleReportNotReceived = useCallback(async () => {
    if (received !== "no" || !notReceivedMethod) return;
    await reportPaymentNotReceived({ method: notReceivedMethod });
  }, [notReceivedMethod, received, reportPaymentNotReceived]);

  if (isLoading) {
    return (
      <SafeAreaScreen>
        <View style={{ padding: theme.spacing.lg }}>
          <Skeleton width="60%" height={20} />
          <View style={{ height: theme.spacing.sm }} />
          <Skeleton width="100%" height={140} radius={theme.radiusUsage.card} />
        </View>
      </SafeAreaScreen>
    );
  }

  if (isError && !data) {
    return (
      <SafeAreaScreen>
        <ErrorState icon="cloud-offline-outline" title="Couldn't load payment confirmation" message={error?.safeMessage ?? "Please try again."} actionLabel="Retry" onAction={() => refetch()} />
      </SafeAreaScreen>
    );
  }

  if (!data) return null;

  if (data.job.workflow_status === "completed") {
    return (
      <SafeAreaScreen edges={["top", "left", "right"]}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: theme.spacing.sm, height: 52 }}>
          <IconButton icon="chevron-back" accessibilityLabel="Back" onPress={goBack} />
        </View>
        <View style={{ alignItems: "center", padding: theme.spacing.xxl }}>
          <AppText variant="title">Job completed</AppText>
          <AppText color="secondary" style={{ textAlign: "center", marginTop: theme.spacing.xs }}>
            {data.provider_record?.provider_resolution_action === "unresolved"
              ? "The provider recorded the payment outcome as unresolved."
              : data.provider_record?.provider_payment_claim === "not_received" && data.provider_record.status !== "confirmed"
              ? "Payment was reported as not received and recorded for follow-up."
              : "Payment recorded as paid directly to the provider."}
          </AppText>
        </View>
      </SafeAreaScreen>
    );
  }

  const hasRecord = Boolean(data.provider_record);
  const canDeclare = data.allowed_actions.includes("declare_payment");
  // Older job-detail responses may omit the nonreceipt action while still
  // reporting that a provider payment record can be submitted. The mutation
  // endpoint performs the final authorization and readiness checks.
  const canReportNotReceived = data.allowed_actions.includes("report_payment_not_received")
    || data.closure_readiness.can_submit_provider_record;
  const canRemind = data.allowed_actions.includes("remind_customer");
  const canFinalize = data.allowed_actions.includes("finalize_job");
  const nonReceipt = data.provider_record?.provider_payment_claim === "not_received";
  const recordStatus = data.provider_record?.status ?? "not_declared";
  const providerClosedUnresolved = nonReceipt && data.provider_record?.provider_resolution_action === "unresolved";
  const recordStatusLabel = (providerClosedUnresolved ? "Provider closed payment review as unresolved" : null)
    ?? (nonReceipt ? NONRECEIPT_STATUS_LABEL[recordStatus] : null)
    ?? STATUS_LABEL[recordStatus]
    ?? data.provider_record?.status_label
    ?? recordStatus;

  const readinessRows: ReadinessRow[] = [
    { label: "Completion proof", complete: data.prerequisites.completion_proof_submitted },
    // Same rule the backend closes on: an absent customer, attested by the
    // technician, satisfies handover. Showing it as incomplete here while the
    // server counted it as done made a closable job look blocked.
    {
      label: "Customer handover",
      complete: ["acknowledged", "customer_unavailable"].includes(data.prerequisites.customer_handover_status),
    },
    { label: "Provider payment record", complete: hasRecord },
    {
      label: nonReceipt ? "Customer response or provider resolution" : "Customer payment confirmation",
      complete: hasRecord && !data.closure_readiness.blockers.includes("PAYMENT_NOT_RECONCILED"),
    },
  ];

  return (
    <SafeAreaScreen edges={["top", "left", "right"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: theme.spacing.sm, height: 52 }}>
        <IconButton icon="chevron-back" accessibilityLabel="Back" onPress={goBack} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <AppText variant="bodyStrong">Payment confirmation</AppText>
          <AppText variant="caption" color="tertiary">{data.job.job_reference}</AppText>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.brandPrimary} />}
      >
        {offline ? <View style={{ marginBottom: theme.spacing.base }}><InlineAlert tone="neutral" title="Offline" message="Payment confirmation is read-only until you reconnect." /></View> : null}
        {mutationError ? <View style={{ marginBottom: theme.spacing.base }}><InlineAlert tone="danger" title="Couldn't complete that action" message={mutationError.safeMessage} /></View> : null}

        {/* A plain block, not a flex row: inside a row the alert's flex:1 text
            column collapsed to zero width and only the tick showed. */}
        <View style={{ marginBottom: theme.spacing.base }}>
          <InlineAlert
            tone={data.prerequisites.completion_proof_submitted ? "success" : "neutral"}
            message={data.prerequisites.completion_proof_submitted ? "Completion proof submitted" : "Completion proof not submitted yet"}
          />
        </View>

        <Section>
          <AmountDueCard amount={data.amount} />
        </Section>

        <InlineAlert tone="info" message="Customer pays the provider directly. Fuvay does not collect this payment." />

        {!hasRecord ? (
          <Section>
            <AppText variant="title" style={{ marginTop: theme.spacing.base, marginBottom: theme.spacing.xs }}>
              {data.amount.expected_amount
                ? `Did the provider receive ₹${data.amount.expected_amount} from the customer?`
                : "Did the provider receive the payment from the customer?"}
            </AppText>
            <SegmentedControl
              options={RECEIVED_OPTIONS}
              value={received ?? undefined}
              onChange={value => setReceived(value)}
              disabled={!(canDeclare || canReportNotReceived) || offline || mutating}
            />
            <View style={{ height: theme.spacing.sm }} />

            {received === "yes" ? (
              allowedMethods.length === 0 ? (
                <InlineAlert
                  tone="warning"
                  title="No payment method is set up"
                  message="Your provider hasn't enabled any payment methods yet. Ask them to turn on Cash or UPI in Finance readiness, then record this payment."
                />
              ) : (
                <View>
                  <AppText variant="bodySmall" color="secondary" style={{ marginBottom: theme.spacing.xs }}>How was it paid?</AppText>
                  <SegmentedControl
                    options={allowedMethods.map(value => ({ value, label: METHOD_LABEL[value] ?? value }))}
                    value={method ?? undefined}
                    onChange={setMethod}
                    disabled={!canDeclare || offline}
                  />
                  {method && method !== "onsite_cash" ? (
                    <View style={{ marginTop: theme.spacing.sm }}>
                      <TextField label="Transaction reference" value={reference} onChangeText={setReference} placeholder="Enter UPI/reference ID" editable={canDeclare && !offline} />
                    </View>
                  ) : null}
                  <AppText variant="caption" color="tertiary" style={{ marginTop: theme.spacing.sm }}>
                    The customer is asked to confirm this in the Fuvay app before the job can close.
                  </AppText>
                </View>
              )
            ) : null}

            {received === "no" ? (
              <Card>
                <AppText variant="bodyStrong">Payment not received</AppText>
                <AppText variant="bodySmall" color="secondary" style={{ marginTop: 4 }}>
                  Report this to your provider. The customer will be asked whether they paid, and the job stays open until the outcome is resolved.
                </AppText>
                {allowedMethods.length === 0 ? (
                  <InlineAlert tone="warning" title="No payment method is set up" message="Ask your provider to enable a payment method in Finance readiness before reporting this payment." />
                ) : (
                  <View style={{ marginTop: theme.spacing.sm }}>
                    <AppText variant="bodySmall" color="secondary" style={{ marginBottom: theme.spacing.xs }}>How was payment expected?</AppText>
                    <SegmentedControl
                      options={allowedMethods.map(value => ({ value, label: METHOD_LABEL[value] ?? value }))}
                      value={notReceivedMethod ?? undefined}
                      onChange={setNotReceivedMethod}
                      disabled={offline || mutating}
                    />
                  </View>
                )}
              </Card>
            ) : null}
          </Section>
        ) : (
          <Section>
            <AppText variant="title" style={{ marginBottom: theme.spacing.xs }}>{nonReceipt ? "Payment follow-up" : "Customer confirmation"}</AppText>
            <Card>
              <AppText variant="bodyStrong">{recordStatusLabel}</AppText>
              <AppText variant="caption" color="tertiary">
                {providerClosedUnresolved
                  ? "The payment outcome is recorded. You can complete the job when its other requirements pass."
                  : nonReceipt && recordStatus === "mismatched"
                  ? "Ask your provider to verify the customer's payment claim in their portal."
                  : nonReceipt && recordStatus === "awaiting_customer"
                  ? "Your nonreceipt report was saved. The customer has been asked whether they paid in the Fuvay app."
                  : nonReceipt
                  ? "Your provider manages any remaining payment follow-up in their portal."
                  : "A confirmation request was sent in the Fuvay app."}
              </AppText>
              {canRemind ? (
                <View style={{ marginTop: theme.spacing.sm }}>
                  <SecondaryButton label="Send reminder" onPress={() => { void remindCustomer(); }} disabled={mutating || offline} />
                </View>
              ) : null}
            </Card>
          </Section>
        )}

        <Section>
          <AppText variant="title" style={{ marginBottom: theme.spacing.xs }}>Final closure readiness</AppText>
          <Card padding="base">
            <ClosureReadinessList rows={readinessRows} />
          </Card>
        </Section>

        <InlineAlert tone="warning" message="Job completes when the payment outcome and other requirements are resolved." />
      </ScrollView>

      <View style={{ flexDirection: "row", gap: theme.spacing.sm, padding: theme.spacing.base, borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle }}>
        <View style={{ flex: 1 }}>
          {/* This only ever re-fetched; it never saved anything. */}
          <SecondaryButton label="Refresh" onPress={() => { void refetch(); }} fullWidth disabled={offline} />
        </View>
        <View style={{ flex: 1 }}>
          {!hasRecord ? (
            received === "no" ? (
              <PrimaryButton
                label="Report not received"
                onPress={handleReportNotReceived}
                disabled={!canReportNotReceived || !notReceivedMethod || offline || mutating}
                loading={mutating}
                fullWidth
              />
            ) : (
              <PrimaryButton
                label="Submit payment record"
                onPress={handleDeclare}
                disabled={!canDeclare || received !== "yes" || !method || offline}
                loading={mutating}
                fullWidth
              />
            )
          ) : (
            canFinalize ? (
              <PrimaryButton label="Complete job" onPress={handleFinalize} disabled={offline || mutating} loading={mutating} fullWidth />
            ) : (
              <PrimaryButton label="Back to job" onPress={goBack} fullWidth />
            )
          )}
        </View>
      </View>
    </SafeAreaScreen>
  );
}
