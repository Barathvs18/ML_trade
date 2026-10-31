import { describe, expect, it } from "vitest";
import { baselineLabel, hasResolvedPredictions } from "./scorecardModel";

describe("scorecard labels", () => {
  it("uses plain language for baseline comparisons", () => {
    expect(baselineLabel(true)).toBe("Better than baseline");
    expect(baselineLabel(false)).toBe("Not better than baseline yet");
  });

  it("only treats a horizon with predictions as populated", () => {
    expect(hasResolvedPredictions({ "5": { count: 0 }, "10": { count: 2 } })).toBe(true);
    expect(hasResolvedPredictions({ "5": { count: 0 }, "10": { count: 0 }, "30": { count: 0 } })).toBe(false);
  });
});
