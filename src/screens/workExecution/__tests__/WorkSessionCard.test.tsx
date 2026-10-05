import React from "react";
import { act, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "../../../design-system/themes";
import { WorkSessionCard } from "../components/WorkSessionCard";
import { WorkSessionDTO } from "../../../services/workExecution/types";

function session(accumulated: number, state: WorkSessionDTO["state"] = "active"): WorkSessionDTO {
  return {
    session_id: "s1", job_id: "j1", state, started_at: "2026-10-05T05:00:00Z",
    paused_at: null, pause_reason: null, accumulated_seconds: accumulated, finished_at: null,
  };
}

function renderCard(s: WorkSessionDTO) {
  return render(
    <ThemeProvider>
      <WorkSessionCard session={s} onPause={() => {}} onResume={() => {}} />
    </ThemeProvider>,
  );
}

describe("WorkSessionCard elapsed time", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("ticks forward from the server's live value", () => {
    renderCard(session(100));
    act(() => { jest.advanceTimersByTime(5000); });
    expect(screen.getByLabelText("Elapsed time 00:01:45")).toBeTruthy();
  });

  it("does not double-count when a refetch brings a newer live value", () => {
    const view = renderCard(session(100));
    act(() => { jest.advanceTimersByTime(30_000); });
    // The 30s refetch: the backend now reports 130 live seconds. Before the
    // fix the card added its own 30s again and showed 00:02:40.
    view.rerender(
      <ThemeProvider>
        <WorkSessionCard session={session(130)} onPause={() => {}} onResume={() => {}} />
      </ThemeProvider>,
    );
    expect(screen.getByLabelText("Elapsed time 00:02:10")).toBeTruthy();
    act(() => { jest.advanceTimersByTime(3000); });
    expect(screen.getByLabelText("Elapsed time 00:02:13")).toBeTruthy();
  });

  it("shows the frozen server value while paused", () => {
    renderCard(session(313, "paused"));
    act(() => { jest.advanceTimersByTime(10_000); });
    expect(screen.getByLabelText("Elapsed time 00:05:13")).toBeTruthy();
  });
});
