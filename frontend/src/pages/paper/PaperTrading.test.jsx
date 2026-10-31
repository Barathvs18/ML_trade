import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LivePricesContext from "../../hooks/LivePricesContext";
import OrderTicket from "./OrderTicket";
import ResetAccountCard from "./ResetAccountCard";
import { estimatePaperOrder, isResetConfirmed, isSquareoffSoon, mapPaperOrderError, validatePaperOrder } from "./utils";

const stocks = [{ symbol: "RELIANCE", name: "Reliance Industries" }];
function withLiveProvider(element) {
  return <LivePricesContext.Provider value={{ subscribe: () => () => {}, status: "mock" }}>{element}</LivePricesContext.Provider>;
}

describe("paper order validation", () => {
  const basics = { quantity: "2", entryPrice: 100 };
  it("validates quantity and long and short stop/target sides", () => {
    expect(validatePaperOrder({ ...basics, side: "BUY", stopLoss: "95", target: "110" })).toBe("");
    expect(validatePaperOrder({ ...basics, side: "BUY", stopLoss: "100" })).toMatch(/long stop-loss/i);
    expect(validatePaperOrder({ ...basics, side: "BUY", target: "99" })).toMatch(/long target/i);
    expect(validatePaperOrder({ ...basics, side: "SELL", stopLoss: "105", target: "90" })).toBe("");
    expect(validatePaperOrder({ ...basics, side: "SELL", stopLoss: "95" })).toMatch(/short stop-loss/i);
    expect(validatePaperOrder({ ...basics, side: "SELL", target: "101" })).toMatch(/short target/i);
    expect(validatePaperOrder({ ...basics, side: "BUY", quantity: "1.5" })).toMatch(/whole number/i);
    expect(validatePaperOrder({ ...basics, side: "BUY", quantity: "0" })).toMatch(/at least 1/i);
  });

  it("shows the margin, charge and slippage estimate in the order ticket", () => {
    const estimate = estimatePaperOrder({ side: "BUY", quantity: "2", ltp: 100 });
    expect(estimate.requiredMargin).toBeCloseTo(200.04);
    expect(estimate.totalCharges).toBeGreaterThan(0);
    expect(estimate.slippageTotal).toBeCloseTo(0.04);

    render(withLiveProvider(<OrderTicket stocks={stocks} symbol="RELIANCE" symbolValid initialPrice={100} marketOpen marketReason="" submitting={false} error="" onSubmit={vi.fn()} onSymbolChange={vi.fn()} />));
    expect(screen.getByText(/Estimated required margin/i).parentElement).toHaveTextContent("₹100.02");
    expect(screen.getByText("Estimated charges").parentElement).toHaveTextContent("₹0.04");
    expect(screen.getByText(/Estimated slippage/i).parentElement).toHaveTextContent("₹0.02");
  });

  it("maps insufficient margin, closed market, invalid quantity and opposite-side errors", () => {
    expect(mapPaperOrderError({ response: { status: 400, data: { error: { code: "insufficient_balance" } } } })).toMatch(/not enough available virtual balance/i);
    expect(mapPaperOrderError({ response: { status: 409, data: { error: { code: "market_closed" } } } })).toMatch(/market is closed/i);
    expect(mapPaperOrderError({ response: { status: 422, data: { error: { code: "invalid_order", message: "Invalid quantity" } } } })).toMatch(/Invalid quantity/i);
    expect(mapPaperOrderError({ response: { status: 422, data: { error: { code: "quantity_exceeds_position" } } } })).toMatch(/automatic reversal is disabled/i);
  });
});

describe("reset confirmation", () => {
  it("requires the exact RESET text before enabling the account reset", async () => {
    const onReset = vi.fn().mockResolvedValue({ archived_trades: 3 });
    render(<ResetAccountCard onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset account" }));
    const confirm = screen.getByRole("button", { name: "Confirm reset" });
    expect(confirm).toBeDisabled();
    const input = screen.getByRole("textbox", { name: /type reset to confirm account reset/i });
    fireEvent.change(input, { target: { value: "reset" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(input, { target: { value: "RESET" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(onReset).toHaveBeenCalledOnce());
  });

  it("only accepts RESET exactly", () => {
    expect(isResetConfirmed("RESET")).toBe(true);
    expect(isResetConfirmed("reset")).toBe(false);
    expect(isResetConfirmed(" RESET ")).toBe(false);
  });
});

describe("square-off warning timing", () => {
  it("shows during the final 30 minutes of the IST session and not outside it", () => {
    expect(isSquareoffSoon(new Date("2026-10-29T09:20:00.000Z"), true)).toBe(true); // 14:50 IST
    expect(isSquareoffSoon(new Date("2026-10-29T09:49:00.000Z"), true)).toBe(true); // 15:19 IST
    expect(isSquareoffSoon(new Date("2026-10-29T09:50:00.000Z"), true)).toBe(true); // 15:20 IST
    expect(isSquareoffSoon(new Date("2026-10-29T09:51:00.000Z"), true)).toBe(false);
    expect(isSquareoffSoon(new Date("2026-10-31T09:20:00.000Z"), true)).toBe(false);
    expect(isSquareoffSoon(new Date("2026-10-29T09:20:00.000Z"), false)).toBe(false);
  });
});
