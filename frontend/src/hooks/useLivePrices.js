import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import LivePricesContext from "./LivePricesContext";

/**
 * Subscribe to the app-wide price feed. When `onMessage` is supplied updates are delivered imperatively
 * without changing this component's state; otherwise the hook returns throttled price/candle snapshots.
 * @param {string[]} symbols
 * @param {{onMessage?:(message:object)=>void,includePrices?:boolean,throttleMs?:number}} [options]
 */
export function useLivePrices(symbols = [], options = {}) {
  const context = useContext(LivePricesContext);
  if (!context) throw new Error("useLivePrices must be used within LivePricesProvider");
  const { subscribe, status } = context;
  const symbolKey = useMemo(() => [...new Set(symbols.map((symbol) => String(symbol).toUpperCase()).filter(Boolean))].sort().join(","), [symbols]);
  const selectedSymbols = useMemo(() => symbolKey ? symbolKey.split(",") : [], [symbolKey]);
  const [prices, setPrices] = useState({});
  const [candles, setCandles] = useState({});
  const callbackRef = useRef(options.onMessage);
  const lastTickAtRef = useRef(new Map());
  callbackRef.current = options.onMessage;
  const includePrices = options.includePrices ?? !options.onMessage;
  const throttleMs = options.throttleMs ?? 0;

  const receive = useCallback((message) => {
    callbackRef.current?.(message);
    if (!includePrices || !message.symbol) return;
    const symbol = String(message.symbol).toUpperCase();
    if (message.type === "tick") {
      const now = Date.now();
      if (throttleMs && now - (lastTickAtRef.current.get(symbol) || 0) < throttleMs) return;
      lastTickAtRef.current.set(symbol, now);
      setPrices((previous) => ({ ...previous, [symbol]: message }));
    } else if (message.type === "candle") {
      setCandles((previous) => ({ ...previous, [symbol]: message }));
    }
  }, [includePrices, throttleMs]);

  useEffect(() => subscribe(selectedSymbols, receive), [subscribe, selectedSymbols, receive]);
  return { prices, candles, status, isConnected: status === "connected" || status === "mock" };
}
