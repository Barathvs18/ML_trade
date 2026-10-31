import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEquityCurve } from "../../api/dashboard";
import { getPredictionStats } from "../../api/predictions";
import { useAuth } from "../../auth/useAuth";
import { useMarketStatus } from "../../hooks/useMarketStatus";
import DashboardSummary from "./DashboardSummary";
import EquityCurveCard from "./EquityCurveCard";
import ScorecardCard from "./ScorecardCard";

vi.mock("../../api/dashboard", () => ({ getEquityCurve: vi.fn() }));
vi.mock("../../api/predictions", () => ({ getPredictionStats: vi.fn() }));
vi.mock("../../auth/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("../../hooks/useMarketStatus", () => ({ useMarketStatus: vi.fn() }));

function renderCard(card) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter>{card}</MemoryRouter></QueryClientProvider>);
}

describe("dashboard loading, empty, and error states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { name: "Demo Learner" } });
    useMarketStatus.mockReturnValue({ isLoading: false, isError: false, data: { market_open: false, upstox_token_ok: false } });
  });

  it("shows the equity chart loading skeleton", () => {
    getEquityCurve.mockReturnValue(new Promise(() => {}));
    renderCard(<EquityCurveCard />);
    expect(screen.getByRole("heading", { name: "Equity curve" })).toBeInTheDocument();
    expect(document.querySelector(".skeleton")).toBeInTheDocument();
  });

  it("shows an empty state when no equity snapshots exist", async () => {
    getEquityCurve.mockResolvedValue([]);
    renderCard(<EquityCurveCard />);
    expect(await screen.findByText("No equity snapshots yet")).toBeInTheDocument();
  });

  it("shows an error state when the scorecard endpoint fails", async () => {
    vi.useFakeTimers();
    getPredictionStats.mockRejectedValue(new Error("offline"));
    renderCard(<ScorecardCard />);
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(screen.getByRole("alert")).toHaveTextContent("Scorecard unavailable");
    vi.useRealTimers();
  });

  it("shows an empty scorecard with a prediction action for a new user", async () => {
    getPredictionStats.mockResolvedValue({ "5": { count: 0 }, "10": { count: 0 }, "30": { count: 0 } });
    renderCard(<ScorecardCard />);
    expect(await screen.findByText("No resolved predictions yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try a prediction" })).toHaveAttribute("href", "/prediction");
  });

  it("does not turn failed summary values into zero balances", () => {
    renderCard(<DashboardSummary summary={undefined} todayValue={null} todayLoading={false} todayUnavailable summaryLoading={false} summaryError onRetry={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Account summary unavailable");
    expect(screen.getAllByText("Unavailable")).toHaveLength(4);
  });
});
