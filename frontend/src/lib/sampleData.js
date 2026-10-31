// NSE session boundaries expressed as UTC minutes (09:15–15:30 Asia/Kolkata).
const IST_OFFSET_MINUTES = 5 * 60 + 30;
const SESSION_START_MINUTES = 9 * 60 + 15 - IST_OFFSET_MINUTES;
const SESSION_END_MINUTES = 15 * 60 + 30 - IST_OFFSET_MINUTES;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function isWeekday(date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function sessionTimes(count, intervalMinutes, endDate = new Date()) {
  const points = [];
  const barsPerSession = Math.ceil((SESSION_END_MINUTES - SESSION_START_MINUTES) / intervalMinutes);
  const day = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - 1);

  while (points.length < count) {
    if (isWeekday(day)) {
      for (let index = barsPerSession - 1; index >= 0 && points.length < count; index -= 1) {
        const minutes = SESSION_START_MINUTES + index * intervalMinutes;
        points.unshift(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), Math.floor(minutes / 60), minutes % 60) / 1000);
      }
    }
    day.setUTCDate(day.getUTCDate() - 1);
  }
  return points.slice(-count);
}

/** Deterministic, plausible OHLCV candles for UI previews. Never use as market data. */
export function generateSampleCandles({
  count = 96,
  seed = 2025,
  startPrice = 2400,
  intervalMinutes = 5,
  endDate,
} = {}) {
  const random = seededRandom(seed);
  const times = sessionTimes(count, intervalMinutes, endDate);
  let previousClose = startPrice;

  return times.map((time, index) => {
    const date = new Date(time * 1000);
    const sessionOpen = index === 0 || date.getUTCHours() === 3 && date.getUTCMinutes() === 45;
    const gap = sessionOpen ? (random() - 0.5) * 0.003 : 0;
    const open = Math.max(1, previousClose * (1 + gap));
    const dailyDrift = Math.sin(index / 19) * 0.00022;
    const move = (random() - 0.49) * 0.006 + dailyDrift;
    const close = Math.max(1, open * (1 + move));
    const spread = open * (0.00035 + random() * 0.0009);
    const high = Math.max(open, close) + spread * random();
    const low = Math.min(open, close) - spread * random();
    const volume = Math.round(18000 + random() * 170000);
    previousClose = close;

    return { time, t: new Date(time * 1000).toISOString(), open, high, low, close, volume, o: open, h: high, l: low, c: close, v: volume };
  });
}

export function generateSampleLine(count = 40, seed = 17, startPrice = 2450) {
  return generateSampleCandles({ count, seed, startPrice, intervalMinutes: 30 }).map(({ time, close }) => ({ time, value: close }));
}

export const SAMPLE_STOCKS = [
  { symbol: "RELIANCE", name: "Reliance Industries", price: 1428.4, change: 0.62, seed: 101 },
  { symbol: "TCS", name: "Tata Consultancy Services", price: 3241.8, change: -0.24, seed: 202 },
  { symbol: "HDFCBANK", name: "HDFC Bank", price: 1786.2, change: 0.38, seed: 303 },
];
