import React, { useCallback, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTheme } from "../../design-system/themes";
import { SafeAreaScreen } from "../../design-system/components/foundation/SafeAreaScreen";
import { Card, Section } from "../../design-system/components/foundation/Layout";
import { AppText } from "../../design-system/components/typography/AppText";
import { IconButton } from "../../design-system/components/actions/IconButton";
import { TextField } from "../../design-system/components/forms/TextField";
import { TextArea } from "../../design-system/components/forms/TextArea";
import { Skeleton, LoadingSpinner } from "../../design-system/components/feedback/Loading";
import { ErrorState } from "../../design-system/components/feedback/States";
import { InlineAlert } from "../../design-system/components/feedback/Banner";
import { PrimaryButton, SecondaryButton } from "../../design-system/components/actions/Buttons";
import { AttachmentThumbnail } from "../../design-system/components/data-display/AttachmentThumbnail";
import { ChecklistItemRow } from "../inspection/components/ChecklistItemRow";
import { WorkFinishedBanner } from "./components/WorkFinishedBanner";
import { EvidenceGrid } from "./components/EvidenceGrid";
import { PartsUsedList } from "./components/PartsUsedList";
import { CustomerHandoverCard } from "./components/CustomerHandoverCard";
import { useCompletionProof } from "./useCompletionProof";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { JobExecutionStackParamList } from "../../navigation/routeTypes";
import { CompletionProofDefinitionDTO } from "../../services/completionProof/types";

type FinalCheck = CompletionProofDefinitionDTO["final_checks"][number];

/** A typed technician attestation is explicit; it is not presented as a
 * handwritten customer signature. The checklist API stores the same response
 * shape as other checks, and a configured photo requirement is still enforced. */
function SignatureFinalCheck({ item, disabled, saving, uploading, evidence, onSave, onPickEvidence }: {
  item: FinalCheck;
  disabled: boolean;
  saving: boolean;
  uploading: boolean;
  evidence: { file_id: string }[];
  onSave: (value: Record<string, unknown> | null, evidence: { file_id: string }[] | null) => void;
  onPickEvidence: () => Promise<{ ok: boolean; fileId?: string }>;
}) {
  const { theme } = useTheme();
  const existingName = item.response?.response_value?.value;
  const [name, setName] = useState(typeof existingName === "string" ? existingName : "");
  return (
    <View style={{ paddingVertical: theme.spacing.base, borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle }}>
      <AppText variant="bodyStrong">{item.label}{item.is_required ? " · Required" : ""}</AppText>
      {item.help_text ? <AppText variant="caption" color="tertiary">{item.help_text}</AppText> : null}
      <AppText variant="caption" color="tertiary">Type your full name to attest to this final check.</AppText>
      <TextField
        value={name}
        onChangeText={setName}
        onBlur={() => { if (!disabled && name.trim()) onSave({ value: name.trim(), format: "typed_name" }, null); }}
        editable={!disabled}
        placeholder="Technician full name"
      />
      {item.evidence_required ? (
        <View style={{ marginTop: theme.spacing.sm }}>
          <AppText variant="caption" color="tertiary">Attach a photo of the signed document ({evidence.length} of {Math.max(item.min_evidence_count, 1)} required).</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {evidence.map(file => <AttachmentThumbnail key={file.file_id} label="Signature evidence" />)}
            {!disabled && (uploading ? <LoadingSpinner /> : <AttachmentThumbnail label="Add photo" onPress={async () => {
              const result = await onPickEvidence();
              if (result.ok && result.fileId) onSave(name.trim() ? { value: name.trim(), format: "typed_name" } : null, [...evidence, { file_id: result.fileId }]);
            }} />)}
          </View>
        </View>
      ) : null}
      {saving ? <LoadingSpinner /> : null}
    </View>
  );
}

type Props = NativeStackScreenProps<JobExecutionStackParamList, "CompletionProof">;

/**
 * Completion Proof & Customer Handover (Phase N). Submitting proof never
 * confirms payment or triggers final completion/commission -- those remain
 * separate, later, canonical actions (spec sections 15, 16).
 */
export function CompletionProofScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const { jobId } = route.params;
  const networkStatus = useNetworkStatus();
  const offline = networkStatus.networkState === "offline";

  const [resolutionSummary, setResolutionSummary] = useState<string | null>(null);
  const [serviceNotes, setServiceNotes] = useState<string | null>(null);
  const [pendingEvidence, setPendingEvidence] = useState<Record<string, { file_id: string }[]>>({});
  const [pendingResponses, setPendingResponses] = useState<Record<string, Record<string, unknown> | null>>({});

  const {
    data, isLoading, isError, error, isRefetching, refetch,
    mutating, mutationError, uploadingCategory, savingItemId, uploadingItemId,
    saveDraft, saveFinalCheck, uploadFinalCheckEvidence, addEvidenceFromUpload, removeEvidence, submit, requestHandover, sendReminder, markCustomerUnavailable,
  } = useCompletionProof(jobId);

  const goBack = useCallback(() => navigation.navigate("JobDetail", { jobId }), [navigation, jobId]);
  const goToPayment = useCallback(() => navigation.navigate("DirectPaymentConfirmation", { jobId }), [navigation, jobId]);

  const summaryValue = resolutionSummary ?? data?.proof.resolution_summary ?? "";
  const notesValue = serviceNotes ?? data?.proof.final_service_notes ?? "";

  const handleBlurSave = useCallback(() => {
    saveDraft({ resolution_summary: summaryValue, final_service_notes: notesValue });
  }, [saveDraft, summaryValue, notesValue]);

  const handleSubmit = useCallback(async () => {
    const result = await submit();
    if (result.ok) { /* stay on screen to show submitted read-only state + handover controls */ }
  }, [submit]);

  const handleRequestHandover = useCallback(async () => {
    const result = await requestHandover();
    // Payment declaration is the technician's next step. It may be recorded
    // while the customer is acknowledging handover; final closure remains
    // guarded by the backend until both customer confirmations pass.
    if (result.ok) goToPayment();
  }, [requestHandover, goToPayment]);

  const handleAddEvidence = useCallback(async (category: "before" | "after") => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await addEvidenceFromUpload(category, asset.uri, asset.fileName ?? "evidence.jpg", asset.mimeType ?? "image/jpeg");
  }, [addEvidenceFromUpload]);

  const handlePickFinalCheckEvidence = useCallback(async (itemId: string): Promise<{ ok: boolean; fileId?: string }> => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { ok: false };
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return { ok: false };
    const asset = result.assets[0];
    const upload = await uploadFinalCheckEvidence(itemId, asset.uri, asset.fileName ?? "final-check.jpg", asset.mimeType ?? "image/jpeg");
    return upload.ok ? { ok: true, fileId: upload.fileId } : { ok: false };
  }, [uploadFinalCheckEvidence]);

  const handleSaveFinalCheck = useCallback(async (
    item: FinalCheck, responseValue: Record<string, unknown> | null, evidence: { file_id: string }[] | null,
  ) => {
    const mergedEvidence = [...new Map([
      ...(item.response?.evidence ?? []), ...(pendingEvidence[item.id] ?? []), ...(evidence ?? []),
    ].map(file => [file.file_id, { file_id: file.file_id }])).values()];
    const value = responseValue ?? pendingResponses[item.id] ?? item.response?.response_value ?? null;
    const minimum = item.evidence_required ? Math.max(item.min_evidence_count, 1) : 0;
    if (mergedEvidence.length < minimum || value === null || Object.keys(value).length === 0) {
      setPendingEvidence(previous => ({ ...previous, [item.id]: mergedEvidence }));
      if (responseValue) setPendingResponses(previous => ({ ...previous, [item.id]: responseValue }));
      return;
    }
    const saved = await saveFinalCheck(item.instance_id, item.id, value, mergedEvidence.length ? mergedEvidence : null);
    if (saved.ok) {
      setPendingEvidence(previous => { const next = { ...previous }; delete next[item.id]; return next; });
      setPendingResponses(previous => { const next = { ...previous }; delete next[item.id]; return next; });
    } else {
      setPendingEvidence(previous => ({ ...previous, [item.id]: mergedEvidence }));
      setPendingResponses(previous => ({ ...previous, [item.id]: value }));
    }
  }, [pendingEvidence, pendingResponses, saveFinalCheck]);

  if (isLoading) {
    return (
      <SafeAreaScreen>
        <View style={{ padding: theme.spacing.lg }}>
          <Skeleton width="60%" height={20} />
          <View style={{ height: theme.spacing.sm }} />
          <Skeleton width="100%" height={120} radius={theme.radiusUsage.card} />
          <View style={{ height: theme.spacing.sm }} />
          <Skeleton width="100%" height={200} radius={theme.radiusUsage.card} />
        </View>
      </SafeAreaScreen>
    );
  }

  if (isError && !data) {
    return (
      <SafeAreaScreen>
        <ErrorState icon="cloud-offline-outline" title="Couldn't load completion proof" message={error?.safeMessage ?? "Please try again."} actionLabel="Retry" onAction={() => refetch()} />
      </SafeAreaScreen>
    );
  }

  if (!data) return null;

  if (data.job.workflow_status !== "work_done" && data.proof.status !== "submitted") {
    return (
      <SafeAreaScreen edges={["top", "left", "right"]}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: theme.spacing.sm, height: 52 }}>
          <IconButton icon="chevron-back" accessibilityLabel="Back" onPress={goBack} />
        </View>
        <ErrorState icon="lock-closed-outline" title="Work isn't finished yet" message="Completion proof opens once Work Execution has reached Finish Work." />
      </SafeAreaScreen>
    );
  }

  const isDraft = data.proof.status === "draft";
  const isEditable = isDraft && !offline;
  const canSubmit = data.allowed_actions.includes("submit_proof");

  return (
    <SafeAreaScreen edges={["top", "left", "right"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: theme.spacing.sm, height: 52 }}>
        <IconButton icon="chevron-back" accessibilityLabel="Back" onPress={goBack} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <AppText variant="bodyStrong">Completion proof</AppText>
          <AppText variant="caption" color="tertiary">{data.job.job_reference}</AppText>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.brandPrimary} />}
      >
        {offline ? <View style={{ marginBottom: theme.spacing.base }}><InlineAlert tone="neutral" title="Offline" message="Completion proof is read-only until you reconnect." /></View> : null}
        {mutationError ? <View style={{ marginBottom: theme.spacing.base }}><InlineAlert tone="danger" title="Couldn't complete that action" message={mutationError.safeMessage} /></View> : null}

        <Section>
          <WorkFinishedBanner
            workSummary={data.work_summary}
            checklistLabel={`All work checklist items completed${data.work_summary.approved_quote_version ? ` · Estimate v${data.work_summary.approved_quote_version}` : ""}`}
          />
        </Section>

        <Section>
          <AppText variant="title" style={{ marginBottom: theme.spacing.xs }}>Resolution summary</AppText>
          <Card>
            <TextArea
              value={summaryValue}
              onChangeText={setResolutionSummary}
              onBlur={handleBlurSave}
              editable={isEditable}
              placeholder="Describe the diagnosed issue, work performed and final test result…"
              minLines={3}
            />
          </Card>
        </Section>

        {data.definition.final_checks.length > 0 ? (
          <Section>
            <AppText variant="title" style={{ marginBottom: theme.spacing.xs }}>Final checks</AppText>
            <Card padding="base">
              {data.definition.final_checks.map(item => item.item_type === "SIGNATURE" ? (
                <SignatureFinalCheck
                  key={item.id}
                  item={item}
                  disabled={!isEditable}
                  saving={savingItemId === item.id}
                  uploading={uploadingItemId === item.id}
                  evidence={[...new Map([...(item.response?.evidence ?? []), ...(pendingEvidence[item.id] ?? [])].map(file => [file.file_id, { file_id: file.file_id }])).values()]}
                  onSave={(value, evidence) => { void handleSaveFinalCheck(item, value, evidence); }}
                  onPickEvidence={() => handlePickFinalCheckEvidence(item.id)}
                />
              ) : (
                <ChecklistItemRow
                  key={item.id}
                  item={pendingEvidence[item.id]?.length ? {
                    ...item,
                    response: {
                      id: item.response?.id ?? "",
                      job_checklist_instance_id: item.instance_id,
                      checklist_item_id: item.id,
                      response_value: item.response?.response_value ?? null,
                      validation_result: item.response?.validation_result ?? null,
                      evidence: [...new Map([
                        ...(item.response?.evidence ?? []), ...pendingEvidence[item.id],
                      ].map(file => [file.file_id, { file_id: file.file_id }])).values()],
                    },
                  } : item}
                  disabled={!isEditable}
                  saving={savingItemId === item.id}
                  uploading={uploadingItemId === item.id}
                  onSave={(value, evidence) => { void handleSaveFinalCheck(item, value, evidence); }}
                  onPickEvidence={() => handlePickFinalCheckEvidence(item.id)}
                />
              ))}
            </Card>
          </Section>
        ) : null}

        <Section>
          <AppText variant="title" style={{ marginBottom: theme.spacing.xs }}>Before & after evidence</AppText>
          <Card padding="base">
            <EvidenceGrid
              beforeIds={data.proof.before_photo_ids}
              afterIds={data.proof.after_photo_ids}
              editable={isEditable}
              uploadingCategory={uploadingCategory}
              onAddBefore={() => handleAddEvidence("before")}
              onAddAfter={() => handleAddEvidence("after")}
              onRemove={(category, fileId) => removeEvidence(category, fileId)}
            />
            {isEditable ? (
              <AppText variant="caption" color="tertiary" style={{ marginTop: theme.spacing.xs }}>Optional. You can submit without photos.</AppText>
            ) : null}
          </Card>
        </Section>

        <Section>
          <AppText variant="title" style={{ marginBottom: theme.spacing.xs }}>Parts used</AppText>
          <Card padding="base">
            <PartsUsedList parts={data.parts_used} />
          </Card>
        </Section>

        {data.proof.status === "submitted" ? (
          <Section>
            <CustomerHandoverCard
              status={data.proof.handover_status}
              onRequest={handleRequestHandover}
              onSendReminder={sendReminder}
              onMarkUnavailable={markCustomerUnavailable}
              canRequest={data.allowed_actions.includes("request_handover")}
              canRemind={data.allowed_actions.includes("send_reminder")}
              disabled={mutating || offline}
            />
          </Section>
        ) : null}

        <Section>
          <AppText variant="title" style={{ marginBottom: theme.spacing.xs }}>Final service notes</AppText>
          <Card>
            <TextArea
              value={notesValue}
              onChangeText={setServiceNotes}
              onBlur={handleBlurSave}
              editable={isEditable}
              placeholder="Care instructions or warranty notes…"
              minLines={2}
            />
          </Card>
        </Section>

        <InlineAlert tone="info" message="Submitting proof does not confirm payment or complete the job." />
      </ScrollView>

      {isDraft && !offline ? (
        <View style={{ flexDirection: "row", gap: theme.spacing.sm, padding: theme.spacing.base, borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle }}>
          <View style={{ flex: 1 }}>
            <SecondaryButton label="Save draft" onPress={handleBlurSave} fullWidth />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton label="Submit completion proof" onPress={handleSubmit} disabled={!canSubmit} loading={mutating} fullWidth />
          </View>
        </View>
      ) : data.proof.status === "submitted" && data.proof.handover_status !== "not_requested" ? (
        <View style={{ padding: theme.spacing.base, borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle }}>
          <PrimaryButton
            label={data.proof.handover_status === "acknowledged" ? "Record payment received" : "Continue to payment"}
            onPress={goToPayment}
            disabled={offline}
            fullWidth
          />
        </View>
      ) : null}
    </SafeAreaScreen>
  );
}
