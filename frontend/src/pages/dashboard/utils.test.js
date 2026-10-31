import { describe, expect, it } from "vitest";
import { preferredTodayPnl } from "./utils";

describe("dashboard today P&L source", () => {
  it("prefers the backend value when it is present", () => {
    expect(preferredTodayPnl({ today_pnl: 42.5 }, -10)).toBe(42.5);
  });

  it("falls back to the locally derived value for older responses", () => {
    expect(preferredTodayPnl({ total_pnl: 200 }, 17)).toBe(17);
    expect(preferredTodayPnl(undefined, 0)).toBe(0);
  });
});
