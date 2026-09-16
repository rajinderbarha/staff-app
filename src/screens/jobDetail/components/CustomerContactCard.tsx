import React from "react";
import { View } from "react-native";
import { useTheme } from "../../../design-system/themes";
import { Card } from "../../../design-system/components/foundation/Layout";
import { AppText } from "../../../design-system/components/typography/AppText";
import { CustomerAlias, RelayContactButton } from "../../../design-system/components/data-display/Privacy";
import { DateTimeText } from "../../../design-system/components/data-display/DateTimeText";
import { CustomerContactDTO } from "../../../services/jobDetail/types";

/** Backend reasons a call cannot be placed, in wording a technician can act on.
 * Kept as a closed map so an unrecognised code falls back to a neutral message
 * rather than showing a raw error constant to a field user. */
export const CANNOT_CALL_COPY: Record<string, string> = {
  MASKED_CALLING_JOB_NOT_CALLABLE: "This job is closed, so calls are turned off.",
  MASKED_CALLING_NO_CUSTOMER_NUMBER: "No contact number on file for this customer.",
};

export function cannotCallText(reasonCode: string | null | undefined): string | null {
  return reasonCode ? (CANNOT_CALL_COPY[reasonCode] ?? "Calling is unavailable right now.") : null;
}

export interface CustomerContactCardProps {
  customer: CustomerContactDTO;
  onCall: () => void;
  onMessageRelay: () => void;
  calling?: boolean;
  callError?: string | null;
}

/**
 * The customer's number is never rendered or held here: the Call button asks
 * the backend for it, which records the tap, and opens the phone dialer.
 *
 * Availability and the call log both come from the job-detail projection, so
 * the "last called" time is the backend's record, not a local guess.
 */
export function CustomerContactCard({
  customer, onCall, onMessageRelay, calling, callError,
}: CustomerContactCardProps) {
  const { theme } = useTheme();
  const canCall = customer.phone_call_available;
  const reasonText = cannotCallText(customer.phone_call_reason);
  const callCount = customer.call_count ?? 0;

  return (
    <Card>
      <CustomerAlias alias={customer.customer_alias} showAvatar />

      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: theme.spacing.xs }}>
        {customer.last_called_at ? (
          <>
            <AppText variant="caption" color="secondary">
              {`Called ${callCount} ${callCount === 1 ? "time" : "times"} · last `}
            </AppText>
            <DateTimeText isoString={customer.last_called_at} variant="caption" color="secondary" />
          </>
        ) : (
          <AppText variant="caption" color="secondary">Not called yet</AppText>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: theme.spacing.lg, marginTop: theme.spacing.sm }}>
        <RelayContactButton
          label={calling ? "Opening dialer…" : callCount > 0 ? "Call again" : "Call customer"}
          onPress={onCall}
          disabled={!canCall || !!calling}
        />
        <RelayContactButton
          label="Message"
          onPress={onMessageRelay}
          disabled={!customer.message_relay_available}
        />
      </View>

      {!canCall && reasonText ? (
        <AppText variant="caption" color="secondary" style={{ marginTop: theme.spacing.xs }}>
          {reasonText}
        </AppText>
      ) : null}

      {callError ? (
        <AppText variant="caption" color="danger" style={{ marginTop: theme.spacing.xs }}>
          {callError}
        </AppText>
      ) : null}
    </Card>
  );
}
