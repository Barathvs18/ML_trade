import { getMockPrice, setMockPrice, getOpenCandles, setOpenCandle } from "./state";

const randomStates = new Map();

function randomFor(symbol) {
  let state = randomStates.get(symbol) ?? [...symbol].reduce((seed, character) => (seed * 33 + character.charCodeAt(0)) >>> 0, 7);
  state = (1664525 * state + 1013904223) >>> 0;
  randomStates.set(symbol, state);
  return state / 4294967296;
}

function candleStart(ts) {
  return Math.floor(ts / 300) * 300;
}

/** Starts a one-second seeded quote/candle stream for active mock subscriptions. */
export function startMockFeed(getSymbols, emit) {
  const timer = setInterval(() => {
    const ts = Date.now();
    const epoch = Math.floor(ts / 1000);
    for (const symbol of getSymbols()) {
      const previous = getMockPrice(symbol);
      const move = (randomFor(symbol) - 0.5) * 0.0008;
      const ltp = Math.max(1, previous.ltp * (1 + move));
      const tick = { ltp, ts: new Date(ts).toISOString(), volume: previous.volume + Math.floor(randomFor(symbol) * 80) + 1 };
      setMockPrice(symbol, tick);
      emit({ type: "tick", symbol, ...tick });

      const start = candleStart(epoch);
      const current = getOpenCandles().get(symbol);
      if (current && current.start !== start) emit({ type: "candle", symbol, interval: "5m", ohlcv: current, closed: true });
      let candle = current;
      if (!candle || candle.start !== start) candle = { start, o: ltp, h: ltp, l: ltp, c: ltp, v: tick.volume };
      else candle = { ...candle, h: Math.max(candle.h, ltp), l: Math.min(candle.l, ltp), c: ltp, v: candle.v + 1 };
      setOpenCandle(symbol, candle);
      emit({ type: "candle", symbol, interval: "5m", ohlcv: candle, closed: false });
    }
  }, 1000);
  return () => clearInterval(timer);
}
