import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PredictionResultCard from "./PredictionResultCard";
import { formatCountdown, getPredictionReveal } from "./utils";

describe("pending prediction outcome protection", () => {
  it("formats a live resolve countdown", () => {
    expect(formatCountdown("2026-01-01T00:00:05.000Z", Date.parse("2026-01-01T00:00:00.000Z"))).toBe("00:05");
  });

  it("does not expose outcome fields or actual-return copy while pending", () => {
    const prediction = {
      _id: "demo-pending",
      symbol: "RELIANCE",
      horizon: 5,
      direction: "UP",
      probability: 0.58,
      probabilities: { UP: 0.58, DOWN: 0.27, SIDEWAYS: 0.15 },
      confidence: "medium",
      model: "kronos",
      made_at: "2026-01-01T00:00:00.000Z",
      resolve_at: "2026-01-01T00:00:05.000Z",
      entry_price: 100,
      forecast_close: 101,
      status: "pending",
      actual_direction: "UP",
      actual_return_pct: 1,
      correct: true,
    };

    render(<PredictionResultCard prediction={prediction} marketOpen />);

    expect(screen.getByText(/Outcome pending/i)).toBeInTheDocument();
    expect(screen.queryByText(/Actual Up/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Actual return/i)).not.toBeInTheDocument();
    expect(getPredictionReveal(prediction)).toBeNull();
  });

  it("reveals server-provided outcome only after resolved status", () => {
    expect(getPredictionReveal({ status: "resolved", actual_direction: "DOWN", actual_return_pct: -0.4, correct: false, baseline_correct: false })).toEqual({
      actualDirection: "DOWN",
      actualReturnPct: -0.4,
      correct: false,
      baselineCorrect: false,
    });
  });
});
