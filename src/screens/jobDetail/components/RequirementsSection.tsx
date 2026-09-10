import React from "react";
import { View } from "react-native";
import { useTheme } from "../../../design-system/themes";
import { AppText } from "../../../design-system/components/typography/AppText";
import { Icon } from "../../../design-system/components/Icon";
import { ListRow, SectionHeader } from "../../../design-system/components/data-display/InfoRow";
import { RequirementsDTO } from "../../../services/jobDetail/types";
import { JobExecutionStackParamList } from "../../../navigation/routeTypes";

/**
 * Every requirement carries a `route_key` naming the screen that satisfies it.
 * Nothing consumed it, so these rows were a read-only status list and the
 * screens behind them were reachable only when the backend happened to make
 * one the single next required action -- which is how a technician ended up
 * told to "create and send an estimate" with no way to open the estimate
 * builder.
 *
 * A key with no screen stays unmapped and its row stays inert, rather than
 * routing somewhere plausible-looking.
 */
const SCREEN_FOR_ROUTE_KEY: Record<string, keyof JobExecutionStackParamList> = {
  CHECKLIST: "Inspection",
  ESTIMATE: "Estimate",
  PARTS_REQUEST: "PartsRequest",
  COMPLETION_PROOF: "CompletionProof",
  DIRECT_PAYMENT_CONFIRMATION: "DirectPaymentConfirmation",
};

interface Row {
  key: string;
  title: string;
  subtitle: string;
  done: boolean | null;
  screen?: keyof JobExecutionStackParamList;
}

function toRows(requirements: RequirementsDTO): Row[] {
  const rows: Row[] = [];
  const { checklist, photos, estimate, parts, completion_proof, payment_confirmation } = requirements;

  rows.push({
    key: "checklist",
    title: "Inspection checklist",
    subtitle: checklist.required ? `${checklist.completed_items} of ${checklist.total_items} completed` : "Not required",
    done: checklist.required ? checklist.completed_items >= checklist.total_items && checklist.total_items > 0 : null,
    screen: SCREEN_FOR_ROUTE_KEY[checklist.route_key],
  });

  if (photos.required !== false) {
    rows.push({ key: "photos", title: "Photos", subtitle: `${photos.uploaded_count} uploaded`, done: photos.uploaded_count > 0 ? true : null, screen: SCREEN_FOR_ROUTE_KEY[photos.route_key] });
  }

  if (estimate.required) {
    rows.push({
      key: "estimate", title: "Estimate",
      subtitle: estimate.state ? estimate.state.replace(/_/g, " ") : "Not created",
      done: estimate.state === "approved",
      screen: SCREEN_FOR_ROUTE_KEY[estimate.route_key],
    });
  }

  if (parts.requested) {
    rows.push({ key: "parts", title: "Parts request", subtitle: parts.approval_state ? parts.approval_state.replace(/_/g, " ") : "Pending", done: parts.approval_state === "approved", screen: SCREEN_FOR_ROUTE_KEY[parts.route_key] });
  }

  if (completion_proof.required) {
    rows.push({ key: "completion_proof", title: "Completion proof", subtitle: completion_proof.state.replace(/_/g, " "), done: completion_proof.state === "submitted", screen: SCREEN_FOR_ROUTE_KEY[completion_proof.route_key] });
  }

  if (payment_confirmation.required) {
    rows.push({ key: "payment_confirmation", title: "Payment confirmation", subtitle: payment_confirmation.state ? payment_confirmation.state.replace(/_/g, " ") : "Pending", done: payment_confirmation.state === "confirmed", screen: SCREEN_FOR_ROUTE_KEY[payment_confirmation.route_key] });
  }

  return rows;
}

/** Every row is a direct projection of backend requirement state -- no
 * readiness value is inferred beyond the explicit fields provided. */
export function RequirementsSection({
  requirements, onOpen,
}: {
  requirements: RequirementsDTO;
  /** Omitted by callers that have nowhere to route to; rows then stay inert. */
  onOpen?: (screen: keyof JobExecutionStackParamList) => void;
}) {
  const { theme } = useTheme();
  const rows = toRows(requirements);
  return (
    <View>
      <SectionHeader title="Requirements" />
      {rows.map(row => {
        const open = onOpen && row.screen ? () => onOpen(row.screen!) : undefined;
        return (
          <ListRow
            key={row.key}
            title={row.title}
            subtitle={row.subtitle}
            onPress={open}
            trailing={
              <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
                {row.done === null ? (
                  <Icon name="time-outline" size="compact" color={theme.colors.textTertiary} decorative />
                ) : row.done ? (
                  <Icon name="checkmark-circle" size="compact" color={theme.colors.statusSuccess} decorative />
                ) : (
                  <Icon name="ellipse-outline" size="compact" color={theme.colors.textTertiary} decorative />
                )}
                {open ? <Icon name="chevron-forward" size="compact" color={theme.colors.textTertiary} decorative /> : null}
              </View>
            }
          />
        );
      })}
    </View>
  );
}
