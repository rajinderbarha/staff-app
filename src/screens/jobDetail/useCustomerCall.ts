import { useCallback, useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import { recordCustomerCall } from "../../services/jobDetail/jobDetailApi";

const DIALER_UNAVAILABLE = "Couldn't open the phone dialer on this device.";

/** `tel:` accepts digits and a leading +; spaces or dashes from a typed
 * number would otherwise reach the dialer as-is. */
export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/**
 * Drives "Call customer": record the tap, then open the phone dialer with the
 * number the backend returns.
 *
 * The backend hands out the number only while recording the tap, so the
 * dialer never opens without a record. If recording fails the dialer stays
 * closed and the error is shown instead.
 *
 * `onRecorded` runs once the tap is on record, so the screen can refetch and
 * show the new "last called" time.
 */
export function useCustomerCall(jobId: string, onRecorded?: () => void) {
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  // Synchronous double-tap guard: two presses in the same tick both see
  // `calling === false`, and each would record a tap and open the dialer.
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const callCustomer = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setCalling(true);
    setError(null);
    try {
      const res = await recordCustomerCall(jobId);
      if (!res.ok) {
        if (mounted.current) setError(res.error.safeMessage);
        return false;
      }
      onRecorded?.();
      try {
        await Linking.openURL(telUrl(res.data.customer_phone));
      } catch {
        if (mounted.current) setError(DIALER_UNAVAILABLE);
        return false;
      }
      return true;
    } finally {
      inFlight.current = false;
      if (mounted.current) setCalling(false);
    }
  }, [jobId, onRecorded]);

  return { calling, error, callCustomer };
}
