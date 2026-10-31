import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LivePricesProvider } from "./LivePricesProvider";
import { useLivePrices } from "./useLivePrices";

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.sent = [];
    MockWebSocket.instances.push(this);
  }

  send(message) { this.sent.push(message); }
  open() { this.readyState = MockWebSocket.OPEN; this.onopen?.(); }
  receive(data) { this.onmessage?.({ data: JSON.stringify(data) }); }
  disconnect() { this.readyState = MockWebSocket.CLOSED; this.onclose?.(); }
  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

describe("useLivePrices", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("receives ticks, reconnects with backoff, and closes the socket on cleanup", async () => {
    const wrapper = ({ children }) => <LivePricesProvider>{children}</LivePricesProvider>;
    const { result, unmount } = renderHook(() => useLivePrices(["RELIANCE"]), { wrapper });

    expect(MockWebSocket.instances).toHaveLength(1);
    const firstSocket = MockWebSocket.instances[0];
    expect(firstSocket.url).toMatch(/^ws:\/\/.*\/ws\/prices$/);
    act(() => firstSocket.open());
    expect(JSON.parse(firstSocket.sent[0])).toEqual({ subscribe: ["RELIANCE"] });
    act(() => firstSocket.receive({ type: "tick", symbol: "RELIANCE", ltp: 2500, ts: "2026-11-01T09:30:00+05:30" }));
    expect(result.current.prices.RELIANCE.ltp).toBe(2500);

    act(() => firstSocket.disconnect());
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(MockWebSocket.instances).toHaveLength(2);

    const secondSocket = MockWebSocket.instances[1];
    act(() => secondSocket.open());
    unmount();
    expect(secondSocket.readyState).toBe(MockWebSocket.CLOSED);
  });
});
