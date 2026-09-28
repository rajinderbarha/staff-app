import React, { useState } from "react";
import { View } from "react-native";
import { useTheme } from "../../../design-system/themes";
import { Card } from "../../../design-system/components/foundation/Layout";
import { AppText } from "../../../design-system/components/typography/AppText";
import { Icon } from "../../../design-system/components/Icon";
import { TextField } from "../../../design-system/components/forms/TextField";
import { PrimaryButton, SecondaryButton } from "../../../design-system/components/actions/Buttons";
import { ArrivalConfirmationDTO } from "../../../services/jobDetail/types";

export interface ArrivalConfirmationCardProps {
  arrival: ArrivalConfirmationDTO;
  customerAlias: string;
  submitting: boolean;
  errorMessage?: string | null;
  onSubmitCode: (challengeId: string, code: string) => void;
}

const CODE_LENGTH = 6;

function expiryLabel(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const at = new Date(expiresAt);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Says out loud that the job is waiting on the customer, not on the app.
 *
 * Pressing "Mark Reached" on an Instagram visit does not advance the job -- the
 * customer is asked to confirm the technician is at the door, and the job stays
 * put until they answer. Nothing told the technician that, so standing at a door
 * watching an unchanged screen was indistinguishable from a hung app, and the
 * natural response was to press the button again.
 *
 * The code route is offered second and deliberately plainly: most customers will
 * just tap confirm in the chat, and a technician who reads this should understand
 * that doing nothing is a valid thing to be doing.
 */
export function ArrivalConfirmationCard({
  arrival, customerAlias, submitting, errorMessage, onSubmitCode,
}: ArrivalConfirmationCardProps) {
  const { theme } = useTheme();
  const [code, setCode] = useState("");
  const [showCodeEntry, setShowCodeEntry] = useState(false);

  const expired = arrival.state === "expired";
  const until = expiryLabel(arrival.expires_at);
  const codeReady = code.trim().length === CODE_LENGTH;

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm }}>
        <Icon
          name={expired ? "alert-circle-outline" : "hourglass-outline"}
          size="standard"
          color={expired ? theme.colors.statusWarning : theme.colors.brandPrimary}
          decorative
        />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">
            {expired ? "Arrival request expired" : "Waiting for the customer to confirm"}
          </AppText>

          {expired ? (
            <AppText variant="bodySmall" color="secondary" style={{ marginTop: 4 }}>
              {customerAlias} did not confirm in time. Press Mark Reached Site again to send a
              fresh request.
            </AppText>
          ) : (
            <>
              <AppText variant="bodySmall" color="secondary" style={{ marginTop: 4 }}>
                {arrival.notification_sent
                  ? `We asked ${customerAlias} in their booking chat to confirm you have arrived. ` +
                    "The job moves on by itself the moment they do — you do not need to press " +
                    "anything again."
                  : `The confirmation message could not be delivered to ${customerAlias}. ` +
                    "Ask them to open their booking chat, or use the code below."}
              </AppText>
              {until ? (
                <AppText variant="caption" color="tertiary" style={{ marginTop: 4 }}>
                  This request is valid until {until}.
                </AppText>
              ) : null}
            </>
          )}

          {arrival.failed_code_attempts > 0 ? (
            <AppText variant="caption" color="warning" style={{ marginTop: 4 }}>
              {arrival.failed_code_attempts} incorrect code{arrival.failed_code_attempts === 1 ? "" : "s"} entered
              so far.
            </AppText>
          ) : null}

          {!expired ? (
            showCodeEntry ? (
              <View style={{ marginTop: theme.spacing.sm }}>
                <TextField
                  label={`${CODE_LENGTH}-digit code from the customer's chat`}
                  value={code}
                  onChangeText={text => setCode(text.replace(/[^0-9]/g, "").slice(0, CODE_LENGTH))}
                  keyboardType="number-pad"
                  placeholder="000000"
                  editable={!submitting}
                  errorText={errorMessage ?? undefined}
                  helperText="Ask the customer to read it out. Only their chat shows it."
                />
                <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
                  <View style={{ flex: 1 }}>
                    <SecondaryButton
                      label="Keep waiting"
                      onPress={() => { setShowCodeEntry(false); setCode(""); }}
                      disabled={submitting}
                      fullWidth
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      label="Confirm arrival"
                      onPress={() => onSubmitCode(arrival.challenge_id, code.trim())}
                      disabled={!codeReady || submitting}
                      loading={submitting}
                      fullWidth
                    />
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ marginTop: theme.spacing.sm }}>
                <SecondaryButton
                  label="Customer will read out the code instead"
                  onPress={() => setShowCodeEntry(true)}
                  fullWidth
                />
              </View>
            )
          ) : null}
        </View>
      </View>
    </Card>
  );
}
