import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL, isMockMode } from "../api/client";
import LivePricesContext from "./LivePricesContext";

function socketUrl() {
  const url = new URL(API_BASE_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/prices";
  url.search = "";
  return url.toString();
}

export function LivePricesProvider({ children }) {
  const listenersRef = useRef(new Map());
  const socketRef = useRef(null);
  const reconnectRef = useRef(null);
  const retryCountRef = useRef(0);
  const mockStopRef = useRef(null);
  const mockLoadingRef = useRef(false);
  const [status, setStatus] = useState("idle");

  const activeSymbols = useCallback(() => [...listenersRef.current.entries()].filter(([, listeners]) => listeners.size > 0).map(([symbol]) => symbol), []);
  const dispatch = useCallback((message) => {
    const subscribers = listenersRef.current.get(String(message.symbol || "").toUpperCase());
    if (!subscribers) return;
    for (const listener of subscribers.values()) listener(message);
  }, []);

  const stopConnection = useCallback(() => {
    clearTimeout(reconnectRef.current);
    reconnectRef.current = null;
    if (mockStopRef.current) {
      mockStopRef.current();
      mockStopRef.current = null;
    }
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
    }
    retryCountRef.current = 0;
    setStatus("idle");
  }, []);

  const connectSocket = useCallback(() => {
    if (!activeSymbols().length) return;
    if (isMockMode) {
      setStatus("mock");
      if (mockStopRef.current || mockLoadingRef.current) return;
      mockLoadingRef.current = true;
      import("../api/mock/liveFeed").then(({ startMockFeed }) => {
        mockLoadingRef.current = false;
        if (!activeSymbols().length) return;
        mockStopRef.current = startMockFeed(activeSymbols, dispatch);
      }).catch(() => {
        mockLoadingRef.current = false;
        setStatus("offline");
      });
      return;
    }

    const existing = socketRef.current;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return;
    setStatus(retryCountRef.current ? "reconnecting" : "connecting");
    const socket = new WebSocket(socketUrl());
    socketRef.current = socket;
    socket.onopen = () => {
      retryCountRef.current = 0;
      setStatus("connected");
      socket.send(JSON.stringify({ subscribe: activeSymbols() }));
    };
    socket.onmessage = (event) => {
      try { dispatch(JSON.parse(event.data)); } catch { /* Ignore malformed feed messages. */ }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (socketRef.current === socket) socketRef.current = null;
      if (!activeSymbols().length) { setStatus("idle"); return; }
      setStatus("reconnecting");
      const wait = Math.min(30_000, 500 * (2 ** retryCountRef.current));
      retryCountRef.current += 1;
      clearTimeout(reconnectRef.current);
      reconnectRef.current = setTimeout(connectSocket, wait);
    };
  }, [activeSymbols, dispatch]);

  const syncSubscriptions = useCallback(() => {
    const symbols = activeSymbols();
    if (!symbols.length) { stopConnection(); return; }
    if (isMockMode) { connectSocket(); return; }
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ subscribe: symbols }));
    else connectSocket();
  }, [activeSymbols, connectSocket, stopConnection]);

  useEffect(() => () => {
    clearTimeout(reconnectRef.current);
    mockStopRef.current?.();
    mockStopRef.current = null;
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
    }
    listenersRef.current.clear();
  }, []);

  const subscribe = useCallback((symbols, listener) => {
    const token = Symbol("live-price-subscriber");
    const normalized = [...new Set(symbols.map((symbol) => String(symbol).toUpperCase()).filter(Boolean))];
    for (const symbol of normalized) {
      if (!listenersRef.current.has(symbol)) listenersRef.current.set(symbol, new Map());
      listenersRef.current.get(symbol).set(token, listener);
    }
    syncSubscriptions();
    return () => {
      for (const symbol of normalized) {
        const listeners = listenersRef.current.get(symbol);
        listeners?.delete(token);
        if (listeners?.size === 0) listenersRef.current.delete(symbol);
      }
      syncSubscriptions();
    };
  }, [syncSubscriptions]);

  const value = useMemo(() => ({ subscribe, status }), [subscribe, status]);
  return <LivePricesContext.Provider value={value}>{children}</LivePricesContext.Provider>;
}
