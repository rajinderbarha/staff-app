import { Linking } from "react-native";
import { renderHook, act } from "@testing-library/react-native";
import { telUrl, useCustomerCall } from "../useCustomerCall";
import * as api from "../../../services/jobDetail/jobDetailApi";
import type { AppError } from "../../../services/api/types";

jest.mock("../../../services/jobDetail/jobDetailApi");

const JOB_ID = "job-1";

function okCall(phone = "+91 98123-45678") {
  return {
    ok: true as const,
    meta: {} as never,
    data: {
      job_id: JOB_ID, customer_phone: phone, called_at: "2026-09-14T06:02:00Z",
      call_count: 1, recent_call_times: ["2026-09-14T06:02:00Z"],
    },
  };
}

function errResult(safeMessage: string) {
  return {
    ok: false as const,
    error: { code: "NETWORK_OFFLINE", category: "network", safeMessage, retryable: true } as unknown as AppError,
  };
}

describe("useCustomerCall", () => {
  let openURL: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  });

  it("records the tap first, then opens the dialer with the returned number", async () => {
    const onRecorded = jest.fn();
    (api.recordCustomerCall as jest.Mock).mockResolvedValue(okCall());
    const { result } = renderHook(() => useCustomerCall(JOB_ID, onRecorded));

    let opened = false;
    await act(async () => { opened = await result.current.callCustomer(); });

    expect(opened).toBe(true);
    expect(api.recordCustomerCall).toHaveBeenCalledWith(JOB_ID);
    expect(openURL).toHaveBeenCalledWith("tel:+919812345678");
    expect(onRecorded).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.calling).toBe(false);
  });

  it("keeps the dialer closed when the tap could not be recorded", async () => {
    const onRecorded = jest.fn();
    (api.recordCustomerCall as jest.Mock).mockResolvedValue(errResult("Couldn't reach Fuvay."));
    const { result } = renderHook(() => useCustomerCall(JOB_ID, onRecorded));

    await act(async () => { await result.current.callCustomer(); });

    expect(openURL).not.toHaveBeenCalled();
    expect(onRecorded).not.toHaveBeenCalled();
    expect(result.current.error).toBe("Couldn't reach Fuvay.");
  });

  it("reports a device that cannot open the dialer, after the tap is on record", async () => {
    const onRecorded = jest.fn();
    (api.recordCustomerCall as jest.Mock).mockResolvedValue(okCall());
    openURL.mockRejectedValue(new Error("No activity found"));
    const { result } = renderHook(() => useCustomerCall(JOB_ID, onRecorded));

    await act(async () => { await result.current.callCustomer(); });

    expect(onRecorded).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe("Couldn't open the phone dialer on this device.");
  });

  it("records a double tap once", async () => {
    let resolve: (value: ReturnType<typeof okCall>) => void = () => {};
    (api.recordCustomerCall as jest.Mock).mockReturnValue(new Promise(r => { resolve = r; }));
    const { result } = renderHook(() => useCustomerCall(JOB_ID));

    await act(async () => {
      const first = result.current.callCustomer();
      const second = result.current.callCustomer();
      resolve(okCall());
      await Promise.all([first, second]);
    });

    expect(api.recordCustomerCall).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledTimes(1);
  });
});

describe("telUrl", () => {
  it("keeps only digits and a leading plus", () => {
    expect(telUrl("+91 98123-45678")).toBe("tel:+919812345678");
    expect(telUrl("9812345678")).toBe("tel:9812345678");
  });
});
