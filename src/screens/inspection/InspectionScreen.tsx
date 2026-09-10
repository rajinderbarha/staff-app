import React, { useCallback } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTheme } from "../../design-system/themes";
import { SafeAreaScreen } from "../../design-system/components/foundation/SafeAreaScreen";
import { Card, Section } from "../../design-system/components/foundation/Layout";
import { AppText } from "../../design-system/components/typography/AppText";
import { IconButton } from "../../design-system/components/actions/IconButton";
import { ProgressBar, Skeleton } from "../../design-system/components/feedback/Loading";
import { ErrorState, EmptyState } from "../../design-system/components/feedback/States";
import { InlineAlert } from "../../design-system/components/feedback/Banner";
import { PrimaryButton, SecondaryButton } from "../../design-system/components/actions/Buttons";
import { ChecklistItemRow } from "./components/ChecklistItemRow";
import { useInspection } from "./useInspection";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { JobExecutionStackParamList } from "../../navigation/routeTypes";

type Props = NativeStackScreenProps<JobExecutionStackParamList, "Inspection">;

/**
 * Inspection & Diagnosis command center (Phase K). Structure/hierarchy
 * follows the approved reference: progress card, read-only customer report,
 * checklist sections (definition-driven), a sticky Complete
 * inspection actions. Pricing is explicitly out of scope (spec section 14).
 */
export function InspectionScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const { jobId } = route.params;
  const networkStatus = useNetworkStatus();
  const offline = networkStatus.networkState === "offline";

  const {
    data, isLoading, isError, error, isRefetching, refetch,
    savingItemId, saveError, saveItemResponse,
    uploadingItemId, uploadEvidence,
    completing, completeError, complete,
  } = useInspection(jobId);

  const goBack = useCallback(() => navigation.navigate("JobDetail", { jobId }), [navigation, jobId]);

  const handlePickEvidence = useCallback(async (itemId: string): Promise<{ ok: boolean; fileId?: string }> => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { ok: false };
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return { ok: false };
    const asset = result.assets[0];
    const upload = await uploadEvidence(itemId, asset.uri, asset.fileName ?? "evidence.jpg", asset.mimeType ?? "image/jpeg");
    if (!upload.ok) return { ok: false };
    return { ok: true, fileId: upload.fileId };
  }, [uploadEvidence]);

  const handleComplete = useCallback(async () => {
    const result = await complete();
    if (result.ok) goBack();
  }, [complete, goBack]);

  if (isLoading) {
    return (
      <SafeAreaScreen>
        <View style={{ padding: theme.spacing.lg }}>
          <Skeleton width="60%" height={20} />
          <View style={{ height: theme.spacing.sm }} />
          <Skeleton width="100%" height={100} radius={theme.radiusUsage.card} />
          <View style={{ height: theme.spacing.sm }} />
          <Skeleton width="100%" height={200} radius={theme.radiusUsage.card} />
        </View>
      </SafeAreaScreen>
    );
  }

  if (isError && !data) {
    return (
      <SafeAreaScreen>
        <ErrorState icon="cloud-offline-outline" title="Couldn't load inspection" message={error?.safeMessage ?? "Please try again."} actionLabel="Retry" onAction={() => refetch()} />
      </SafeAreaScreen>
    );
  }

  if (!data) return null;

  if (data.definition_status === "UNAVAILABLE") {
    // A missing checklist is a configuration gap, not a dead end: the backend
    // has no required checks to enforce here, so it still allows the
    // inspection to be completed. Without this the job parked on
    // `inspection_started` with no way forward anywhere in the app.
    return (
      <SafeAreaScreen edges={["top", "left", "right"]}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: theme.spacing.sm, height: 52 }}>
          <IconButton icon="chevron-back" accessibilityLabel="Back" onPress={goBack} />
          <View style={{ flex: 1, alignItems: "center" }}>
            <AppText variant="bodyStrong">Inspection</AppText>
            <AppText variant="caption" color="tertiary">{data.job.job_reference} · {data.job.service_label ?? "Service"}</AppText>
          </View>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="clipboard-outline"
            title="No inspection checklist configured"
            message="This job type doesn't have an inspection checklist mapped yet, so there is nothing to fill in. Tell your admin, and carry on with the job."
          />
        </View>
        {completeError ? (
          <View style={{ paddingHorizontal: theme.spacing.base }}>
            <InlineAlert tone="danger" title="Couldn't complete inspection" message={completeError.safeMessage} />
          </View>
        ) : null}
        {data.readiness.can_complete && !offline ? (
          <View style={{ padding: theme.spacing.base, borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle }}>
            <PrimaryButton label="Complete inspection" onPress={handleComplete} loading={completing} fullWidth />
          </View>
        ) : null}
      </SafeAreaScreen>
    );
  }

  const isCompleted = data.instance?.state === "COMPLETED";
  const readOnly = isCompleted || data.job.is_terminal || offline;
  const renderedItemCount = data.sections.reduce((total, section) => total + section.items.length, 0);
  const remainingChecks = data.readiness.total_required - data.readiness.completed_required;

  return (
    <SafeAreaScreen edges={["top", "left", "right"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: theme.spacing.sm, height: 52 }}>
        <IconButton icon="chevron-back" accessibilityLabel="Back" onPress={goBack} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <AppText variant="bodyStrong">Inspection</AppText>
          <AppText variant="caption" color="tertiary">{data.job.job_reference} · {data.job.service_label ?? "Service"}</AppText>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.brandPrimary} />}
      >
        {offline ? <View style={{ marginBottom: theme.spacing.base }}><InlineAlert tone="neutral" title="Offline" message="Inspection is read-only until you reconnect." /></View> : null}
        {saveError ? <View style={{ marginBottom: theme.spacing.base }}><InlineAlert tone="danger" title="Couldn't save" message={saveError.safeMessage} /></View> : null}
        {completeError ? <View style={{ marginBottom: theme.spacing.base }}><InlineAlert tone="danger" title="Couldn't complete inspection" message={completeError.safeMessage} /></View> : null}

        <Section>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: theme.spacing.xs }}>
              <AppText variant="bodyStrong">
                {data.readiness.completed_required} of {data.readiness.total_required} checks complete
              </AppText>
              {isCompleted ? <AppText variant="caption" color="success">Completed</AppText> : null}
            </View>
            <ProgressBar progress={data.readiness.total_required > 0 ? data.readiness.completed_required / data.readiness.total_required : 0} />
          </Card>
        </Section>

        <Section>
          <AppText variant="title" style={{ marginBottom: theme.spacing.xs }}>Customer reported issue</AppText>
          <Card>
            <AppText color="secondary">{data.customer_report.issue_label ?? "No issue recorded."}</AppText>
          </Card>
        </Section>

        {renderedItemCount === 0 ? (
          <Section>
            <InlineAlert
              tone="warning"
              title="This checklist has no questions"
              message="A checklist is mapped to this job type but its published version contains no items. Tell your admin -- there is nothing here for you to fill in."
            />
          </Section>
        ) : null}

        {data.sections.map(section => (
          <Section key={section.section_id}>
            <AppText variant="title" style={{ marginBottom: theme.spacing.xs }}>{section.title}</AppText>
            <Card padding="base">
              {section.items.map(item => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  disabled={readOnly}
                  saving={savingItemId === item.id}
                  uploading={uploadingItemId === item.id}
                  onSave={(value, evidence) => data.instance && saveItemResponse(data.instance.instance_id, item.id, value, evidence)}
                  onPickEvidence={() => handlePickEvidence(item.id)}
                />
              ))}
            </Card>
          </Section>
        ))}

        <InlineAlert tone="info" message="Estimate can be created after all required checks are complete." />
      </ScrollView>

      {!readOnly ? (
        <View style={{ padding: theme.spacing.base, borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle }}>
          {/* Each answer is saved the moment it is ticked, so there is no
              draft to save. This used to be a "Save draft" button that only
              called refetch() -- it looked like it discarded the technician's
              work every time they pressed it. */}
          <AppText variant="caption" color="tertiary" style={{ marginBottom: theme.spacing.xs, textAlign: "center" }}>
            Answers save as you tick them
          </AppText>
          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <SecondaryButton label="Refresh" onPress={() => { void refetch(); }} fullWidth />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label={data.readiness.can_complete
                  ? "Complete inspection"
                  : `Complete inspection (${remainingChecks} left)`}
                onPress={handleComplete}
                disabled={!data.readiness.can_complete}
                loading={completing}
                fullWidth
              />
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaScreen>
  );
}
