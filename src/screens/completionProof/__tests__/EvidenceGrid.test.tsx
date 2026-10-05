import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "../../../design-system/themes";
import { EvidenceGrid } from "../components/EvidenceGrid";
import { __clearEvidencePreviewCache } from "../../../services/media/useEvidencePreview";

jest.mock("../../../services/auth/tokenCoordinator", () => ({ getAccessToken: () => "tech-token" }));

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; __clearEvidencePreviewCache(); });

function mockImageFetch() {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    headers: { get: () => "image/jpeg" },
    arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer,
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function renderGrid(overrides: Partial<React.ComponentProps<typeof EvidenceGrid>> = {}) {
  const props = {
    beforeIds: ["b1"], afterIds: ["a1"], editable: true, uploadingCategory: null,
    onAddBefore: jest.fn(), onAddAfter: jest.fn(), onRemove: jest.fn(),
    ...overrides,
  };
  render(<ThemeProvider><EvidenceGrid {...props} /></ThemeProvider>);
  return props;
}

describe("EvidenceGrid", () => {
  it("asks before removing a photo instead of deleting it on tap", () => {
    const props = renderGrid();
    fireEvent.press(screen.getByLabelText("After photo, tap to remove"));
    expect(props.onRemove).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Remove photo"));
    expect(props.onRemove).toHaveBeenCalledWith("after", "a1");
  });

  it("keeps the photo when the technician backs out", () => {
    const props = renderGrid();
    fireEvent.press(screen.getByLabelText("Before photo, tap to remove"));
    fireEvent.press(screen.getByText("Keep it"));
    expect(props.onRemove).not.toHaveBeenCalled();
  });

  it("offers a way to add a before photo as well as an after photo", () => {
    const props = renderGrid({ beforeIds: [], afterIds: [] });
    fireEvent.press(screen.getByLabelText("Add before"));
    fireEvent.press(screen.getByLabelText("Add after"));
    expect(props.onAddBefore).toHaveBeenCalledTimes(1);
    expect(props.onAddAfter).toHaveBeenCalledTimes(1);
  });

  it("shows the real photo, fetched with the technician's credentials", async () => {
    const fetchMock = mockImageFetch();
    renderGrid({ beforeIds: [], afterIds: ["a1"], editable: false });
    await waitFor(() => {
      const images = screen.UNSAFE_queryAllByType(require("react-native").Image);
      expect(images[0]?.props.source.uri).toBe("data:image/jpeg;base64,/9j/2Q==");
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toMatch(/\/v1\/media\/a1\/view$/);
    expect(init.headers.Authorization).toBe("Bearer tech-token");
  });

  it("keeps the placeholder when the preview cannot be loaded", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, headers: { get: () => null } })) as unknown as typeof fetch;
    renderGrid({ beforeIds: [], afterIds: ["a1"], editable: false });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.UNSAFE_queryAllByType(require("react-native").Image)).toHaveLength(0);
  });
});
