import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "../../../design-system/themes";
import { AmountDueCard } from "../components/AmountDueCard";
import { ExpectedAmountDTO } from "../../../services/directPayment/types";

function amount(isApproved: boolean): ExpectedAmountDTO {
  return {
    expected_amount: "400.00", currency: "INR",
    approved_estimate: { quote_id: "q1", version_number: 1, total_amount: "944.00", is_approved: isApproved },
    visit_fee_adjustment: "0",
  } as unknown as ExpectedAmountDTO;
}

describe("AmountDueCard estimate line", () => {
  it("does not call an estimate the customer never approved 'approved'", () => {
    render(<ThemeProvider><AmountDueCard amount={amount(false)} /></ThemeProvider>);
    expect(screen.getByText("Estimate v1 (not approved)")).toBeTruthy();
    expect(screen.queryByText(/Approved estimate/)).toBeNull();
  });

  it("labels an approved estimate as approved", () => {
    render(<ThemeProvider><AmountDueCard amount={amount(true)} /></ThemeProvider>);
    expect(screen.getByText("Approved estimate v1")).toBeTruthy();
  });
});
