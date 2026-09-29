import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ThemeProvider } from "../../../design-system/themes";
import { AddItemSheet } from "../components/AddItemSheet";
import type { PartsCatalogItemDTO } from "../../../services/workExecution/types";
import type { QuoteLineItemDTO } from "../../../services/estimate/types";

// The estimate draws on the SAME inventory the mid-job parts request uses, so it
// reads the same hook -- mocked once here for both.
jest.mock("../../workExecution/usePartsCatalog");
import { usePartsCatalog } from "../../workExecution/usePartsCatalog";

const CAPACITOR: PartsCatalogItemDTO = {
  item_id: "item-cap", name: "AC capacitor 45uF", sku: "CAP-45", category: "AC", unit: "unit",
  unit_price: 850, warranty: "6 months", available_qty: 5, max_request_qty: 2,
};
const EMPTY_SHELF: PartsCatalogItemDTO = {
  item_id: "item-motor", name: "Blower motor", sku: "MOT-1", category: "AC", unit: "unit",
  unit_price: 2400, warranty: null, available_qty: 0, max_request_qty: 0,
};

function catalog() {
  return { items: [CAPACITOR, EMPTY_SHELF], isLoading: false, isError: false, error: null, refetch: jest.fn(), searchTerm: "" };
}

function renderSheet(props: Partial<React.ComponentProps<typeof AddItemSheet>> = {}) {
  const onSubmit = jest.fn();
  render(
    <ThemeProvider>
      <AddItemSheet jobId="j1" visible onClose={jest.fn()} onSubmit={onSubmit} submitting={false} {...props} />
    </ThemeProvider>,
  );
  return { onSubmit };
}

beforeEach(() => {
  jest.clearAllMocks();
  (usePartsCatalog as jest.Mock).mockReturnValue(catalog());
});

describe("AddItemSheet — labour stays as it was", () => {
  it("is a free-form line with the technician's own rate, and no inventory", () => {
    renderSheet();
    expect(screen.getByText("Unit rate (₹)")).toBeTruthy();
    expect(screen.queryByText("Choose from your provider's inventory")).toBeNull();
  });

  it("submits a manual labour line with no inventory link", () => {
    const { onSubmit } = renderSheet();
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Gas refill & leak repair"), "Fit and test");
    fireEvent.changeText(screen.getAllByDisplayValue("")[0], "350");
    // The sheet's title and its button share the text "Add item"; the button is last.
    const addButtons = screen.getAllByText("Add item");
    fireEvent.press(addButtons[addButtons.length - 1]);
    const sent = onSubmit.mock.calls[0][0];
    expect(sent.item_type).toBe("labour");
    expect(sent.item_name).toBe("Fit and test");
    expect(sent.inventory_item_id).toBeUndefined();
  });
});

describe("AddItemSheet — parts and materials come from inventory", () => {
  it("shows the inventory, not a price field, for a part", () => {
    renderSheet();
    fireEvent.press(screen.getByText("Part"));
    expect(screen.getByText("Choose from your provider's inventory")).toBeTruthy();
    expect(screen.getByText("AC capacitor 45uF")).toBeTruthy();
    // No way to type a price for a stocked item.
    expect(screen.queryByText("Unit rate (₹)")).toBeNull();
  });

  it("does the same for a material", () => {
    renderSheet();
    fireEvent.press(screen.getByText("Material"));
    expect(screen.getByText("Choose from your provider's inventory")).toBeTruthy();
  });

  it("sends the inventory item and its catalogue name, not anything typed", () => {
    const { onSubmit } = renderSheet();
    fireEvent.press(screen.getByText("Part"));
    fireEvent.press(screen.getByText("AC capacitor 45uF"));
    expect(screen.getByText("Price from your provider's inventory.")).toBeTruthy();
    fireEvent.press(screen.getByText("Add to estimate"));

    expect(onSubmit).toHaveBeenCalledWith({
      item_type: "part",
      item_name: "AC capacitor 45uF",
      quantity: 1,
      unit_price: 850,
      inventory_item_id: "item-cap",
    });
  });

  it("will not let a part with nothing on one shelf be picked", () => {
    renderSheet();
    fireEvent.press(screen.getByText("Part"));
    expect(screen.getByText("Out of stock")).toBeTruthy();
    // Pressing it must not select it.
    fireEvent.press(screen.getByText("Blower motor"), { stopPropagation: jest.fn() });
    expect(screen.queryByText("Add to estimate")).toBeNull();
  });
});

describe("AddItemSheet — editing a line already on the estimate", () => {
  const INVENTORY_LINE: QuoteLineItemDTO = {
    id: "l1", item_type: "part", item_name: "AC capacitor 45uF", item_description: null,
    quantity: "2", unit_price: "850", line_total: "1700", is_customer_visible: true,
    inventory: { inventory_item_id: "item-cap", sku: "CAP-45", unit: "unit" },
  };

  it("locks an inventory line's price and offers only the quantity", () => {
    renderSheet({ initial: INVENTORY_LINE });
    expect(screen.getByText("Edit quantity")).toBeTruthy();
    expect(screen.getByText(/can't be changed here/)).toBeTruthy();
    expect(screen.queryByText("Unit rate (₹)")).toBeNull();
  });

  it("keeps a part typed in before this change editable the old way", () => {
    // Nothing already on an estimate may become uneditable.
    const legacy: QuoteLineItemDTO = { ...INVENTORY_LINE, id: "l2", inventory: null };
    renderSheet({ initial: legacy });
    expect(screen.getByText("Unit rate (₹)")).toBeTruthy();
    expect(screen.queryByText("Choose from your provider's inventory")).toBeNull();
  });
});
