import { describe, expect, it } from "vitest";
import { getHistoryPage, mapPredictionError, validateOrderForm } from "./utils";

describe("prediction error messages", () => {
  it("maps market-closed, rate-limit, model-unavailable, and network errors", () => {
    expect(mapPredictionError({ response: { status: 409 } })).toMatch(/market closed/i);
    expect(mapPredictionError({ response: { status: 429, headers: { "retry-after": "37" } } })).toMatch(/37 seconds/);
    expect(mapPredictionError({ response: { status: 503 } })).toMatch(/temporarily unavailable/i);
    expect(mapPredictionError({ message: "Network Error" })).toMatch(/check your connection/i);
  });
});

describe("paper bracket validation", () => {
  const common = { quantity: "2", entryPrice: 100 };

  it("accepts and rejects long stop-loss/target prices on the proper sides", () => {
    expect(validateOrderForm({ ...common, side: "BUY", stopLoss: "95", target: "110" })).toBe("");
    expect(validateOrderForm({ ...common, side: "BUY", stopLoss: "100", target: "110" })).toMatch(/long stop-loss/i);
    expect(validateOrderForm({ ...common, side: "BUY", stopLoss: "95", target: "99" })).toMatch(/long target/i);
  });

  it("reverses bracket sides for short orders and rejects non-whole quantities", () => {
    expect(validateOrderForm({ ...common, side: "SELL", stopLoss: "105", target: "90" })).toBe("");
    expect(validateOrderForm({ ...common, side: "SELL", stopLoss: "95", target: "90" })).toMatch(/short stop-loss/i);
    expect(validateOrderForm({ ...common, side: "SELL", stopLoss: "105", target: "101" })).toMatch(/short target/i);
    expect(validateOrderForm({ ...common, side: "BUY", quantity: "1.5" })).toMatch(/whole number/i);
  });
});

describe("history pagination", () => {
  it("pages forward through the fetched history and ends with a null cursor", () => {
    const rows = Array.from({ length: 23 }, (_, index) => ({ id: index }));
    const first = getHistoryPage(rows, 0, 10);
    const second = getHistoryPage(rows, first.nextCursor, 10);
    const third = getHistoryPage(rows, second.nextCursor, 10);

    expect(first.rows.map((row) => row.id)).toEqual(Array.from({ length: 10 }, (_, index) => index));
    expect(second.rows).toHaveLength(10);
    expect(third.rows).toHaveLength(3);
    expect(third.nextCursor).toBeNull();
  });
});
