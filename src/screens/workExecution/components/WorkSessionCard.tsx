import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useTheme } from "../../../design-system/themes";
import { Card } from "../../../design-system/components/foundation/Layout";
import { AppText } from "../../../design-system/components/typography/AppText";
import { NumericText } from "../../../design-system/components/typography/NumericText";
import { SecondaryButton } from "../../../design-system/components/actions/Buttons";
import { WorkSessionDTO } from "../../../services/workExecution/types";

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
}

export interface WorkSessionCardProps {
  session: WorkSessionDTO | null;
  onPause: () => void;
  onResume: () => void;
  disabled?: boolean;
}

/**
 * Server-authoritative elapsed time (spec section 7). For an active session
 * the backend's `accumulated_seconds` is already LIVE -- it includes the
 * running segment as of the moment it answered. The local ticker therefore
 * only adds the time since that answer arrived, and re-anchors on every
 * refetch. It used to add its own count since mount on top of the live value,
 * so each 30s refetch pushed the clock further ahead (it read about double).
 */
export function WorkSessionCard({ session, onPause, onResume, disabled }: WorkSessionCardProps) {
  const { theme } = useTheme();
  const [now, setNow] = useState(() => Date.now());
  // When the current server value arrived: re-anchors each time a refetch
  // delivers a different value (or the session pauses/resumes).
  const serverValue = `${session?.state}:${session?.accumulated_seconds}`;
  const anchoredAt = useMemo(() => (serverValue ? Date.now() : 0), [serverValue]);

  useEffect(() => {
    if (session?.state !== "active") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [session?.state]);

  if (!session) return null;

  const sinceAnswer = Math.max(0, Math.floor((now - anchoredAt) / 1000));
  const displaySeconds = session.state === "active" ? session.accumulated_seconds + sinceAnswer : session.accumulated_seconds;

  return (
    <Card>
      <AppText variant="label" color="warning">Work session</AppText>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: theme.spacing.xs }}>
        <NumericText size="large" accessibilityLabel={`Elapsed time ${formatElapsed(displaySeconds)}`}>
          {formatElapsed(displaySeconds)}
        </NumericText>
        {session.state === "active" ? (
          <SecondaryButton label="Pause" onPress={onPause} disabled={disabled} />
        ) : session.state === "paused" ? (
          <SecondaryButton label="Resume" onPress={onResume} disabled={disabled} />
        ) : null}
      </View>
      <AppText variant="caption" color="tertiary">
        {session.started_at ? `Started ${new Date(session.started_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}
        {session.state === "paused" && session.pause_reason ? ` · Paused: ${session.pause_reason}` : ""}
      </AppText>
    </Card>
  );
}
