import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ThemeProvider } from "../../../design-system/themes";
import { RequestPartSheet } from "../components/RequestPartSheet";
import type { PartsCatalogItemDTO } from "../../../services/workExecution/types";

jest.mock("../usePartsCatalog");
import { usePartsCatalog } from "../usePartsCatalog";

const CAPACITOR: PartsCatalogItemDTO = {
  item_id: "item-cap", name: "AC capacitor 45uF", sku: "CAP-45", category: "AC", unit: "unit",
  unit_price: 850, warranty: "6 months", available_qty: 5, max_request_qty: 2,
};
const MOTOR: PartsCatalogItemDTO = {
  item_id: "item-motor", name: "Blower motor", sku: "MOT-1", category: "AC", unit: "unit",
  unit_price: 2400, warranty: null, available_qty: 0, max_request_qty: 0,
};

function catalog(overrides: Partial<ReturnType<typeof usePartsCatalog>> = {}) {
  return { items: [CAPACITOR, MOTOR], isLoading: false, isError: false, error: null, refetch: jest.fn(), searchTerm: "", ...overrides };
}

/** A press on a disabled control bubbles to the sheet's own backdrop guard,
 * which calls `e.stopPropagation()`; the test renderer passes no event. */
function pressDisabled(element: Parameters<typeof fireEvent.press>[0]) {
  fireEvent.press(element, { stopPropagation: jest.fn() });
}

function renderSheet(props: Partial<React.ComponentProps<typeof RequestPartSheet>> = {}) {
  const onSubmit = jest.fn();
  render(
    <ThemeProvider>
      <RequestPartSheet jobId="j1" visible onClose={jest.fn()} onSubmit={onSubmit} submitting={false} {...props} />
    </ThemeProvider>,
  );
  return { onSubmit };
}

beforeEach(() => {
  jest.clearAllMocks();
  (usePartsCatalog as jest.Mock).mockReturnValue(catalog());
});

describe("RequestPartSheet — parts come from the provider inventory", () => {
  it("offers no free-text part name or price, only the inventory list", () => {
    renderSheet();
    expect(screen.getByText("Choose a part")).toBeTruthy();
    expect(screen.queryByLabelText("Part / material")).toBeNull();
    expect(screen.queryByLabelText("Estimated cost (₹)")).toBeNull();
    expect(screen.getByText("AC capacitor 45uF")).toBeTruthy();
    expect(screen.getByText("Out of stock")).toBeTruthy();
    expect(usePartsCatalog).toHaveBeenCalledWith("j1", "", true);
  });

  it("sends the chosen inventory item, quantity and reason -- never a name or price", () => {
    const { onSubmit } = renderSheet();
    fireEvent.press(screen.getByLabelText("AC capacitor 45uF"));
    fireEvent.press(screen.getByLabelText("Increase quantity"));
    fireEvent.changeText(screen.getByLabelText("Reason"), "  Old one is burnt  ");
    fireEvent.press(screen.getByText("Send to customer"));
    expect(onSubmit).toHaveBeenCalledWith({ inventory_item_id: "item-cap", quantity: 2, reason: "Old one is burnt" });
  });

  it("shows what the customer pays and caps quantity at what one location holds", () => {
    renderSheet();
    fireEvent.press(screen.getByLabelText("AC capacitor 45uF"));
    fireEvent.press(screen.getByLabelText("Increase quantity"));
    pressDisabled(screen.getByLabelText("Increase quantity"));
    expect(screen.getByText("₹1,700")).toBeTruthy();
    expect(screen.getByText("Up to 2 from one stock location")).toBeTruthy();
  });

  it("will not send without a reason", () => {
    const { onSubmit } = renderSheet();
    fireEvent.press(screen.getByLabelText("AC capacitor 45uF"));
    pressDisabled(screen.getByText("Send to customer"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not let an out-of-stock part be chosen", () => {
    renderSheet();
    pressDisabled(screen.getByLabelText("Blower motor"));
    expect(screen.getByText("Choose a part")).toBeTruthy();
  });

  it("explains an empty inventory instead of showing a blank list", () => {
    (usePartsCatalog as jest.Mock).mockReturnValue(catalog({ items: [] }));
    renderSheet();
    expect(screen.getByText("No parts in inventory")).toBeTruthy();
  });

  it("says when a search matches nothing", () => {
    (usePartsCatalog as jest.Mock).mockReturnValue(catalog({ items: [], searchTerm: "valve" }));
    renderSheet();
    expect(screen.getByText("No matching parts")).toBeTruthy();
  });

  it("offers a retry when the inventory cannot be loaded", () => {
    const refetch = jest.fn();
    (usePartsCatalog as jest.Mock).mockReturnValue(catalog({ items: [], isError: true, refetch, error: { code: "SERVER_UNAVAILABLE", category: "server", safeMessage: "Server error", retryable: true } as any }));
    renderSheet();
    fireEvent.press(screen.getByText("Try again"));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows a submit failure inside the sheet, where the technician can see it", () => {
    renderSheet({ errorMessage: "Only 2 of AC capacitor 45uF in stock." });
    fireEvent.press(screen.getByLabelText("AC capacitor 45uF"));
    // An error left over from an earlier attempt is not shown on a fresh open.
    expect(screen.queryByText("Only 2 of AC capacitor 45uF in stock.")).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Reason"), "Burnt out");
    fireEvent.press(screen.getByText("Send to customer"));
    expect(screen.getByText("Only 2 of AC capacitor 45uF in stock.")).toBeTruthy();
  });
});
