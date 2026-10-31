import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { ColorType, createChart, TickMarkType } from "lightweight-charts";

function formatIstTick(time, tickMarkType) {
  let date;
  if (typeof time === "number") date = new Date(time * 1000);
  else date = new Date(Date.UTC(time.year, time.month - 1, time.day));
  const options = tickMarkType === TickMarkType.Time || tickMarkType === TickMarkType.TimeWithSeconds
    ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
    : tickMarkType === TickMarkType.Year
      ? { year: "numeric" }
      : tickMarkType === TickMarkType.Month
        ? { month: "short", year: "2-digit" }
        : { day: "2-digit", month: "short" };
  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "Asia/Kolkata" }).format(date);
}

function normalizeCandle(candle) {
  const rawTime = candle.time ?? candle.t ?? candle.start;
  const date = typeof rawTime === "number" ? rawTime : Math.floor(new Date(rawTime).getTime() / 1000);
  return {
    time: date,
    open: Number(candle.open ?? candle.o),
    high: Number(candle.high ?? candle.h),
    low: Number(candle.low ?? candle.l),
    close: Number(candle.close ?? candle.c),
    volume: Number(candle.volume ?? candle.v ?? 0),
  };
}

const CandleChart = forwardRef(function CandleChart({ candles = [], volume, markers = [], height = 360, className = "" }, ref) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const previousDataRef = useRef([]);
  const previousVolumeRef = useRef([]);
  const normalized = useMemo(() => candles.map(normalizeCandle).filter((item) => Number.isFinite(item.time) && Number.isFinite(item.close)), [candles]);

  useImperativeHandle(ref, () => ({
    updateCandle(rawCandle) {
      const candle = normalizeCandle(rawCandle);
      if (!Number.isFinite(candle.time) || !Number.isFinite(candle.close) || !candleSeriesRef.current || !volumeSeriesRef.current) return;
      const rows = previousDataRef.current;
      if (rows.length && candle.time < rows.at(-1).time) return;
      if (rows.at(-1)?.time === candle.time) rows[rows.length - 1] = candle;
      else rows.push(candle);
      if (rows.length > 200) rows.shift();
      const barVolume = { time: candle.time, value: candle.volume, color: candle.close >= candle.open ? "rgba(16,185,129,0.32)" : "rgba(239,68,68,0.3)" };
      candleSeriesRef.current.update(candle);
      volumeSeriesRef.current.update(barVolume);
      const volumeRows = previousVolumeRef.current;
      if (volumeRows.at(-1)?.time === candle.time) volumeRows[volumeRows.length - 1] = barVolume;
      else volumeRows.push(barVolume);
      if (volumeRows.length > 200) volumeRows.shift();
    },
    updateLastPrice(tick) {
      const last = previousDataRef.current.at(-1);
      const price = Number(tick.ltp);
      if (!last || !Number.isFinite(price)) return;
      this.updateCandle({ ...last, high: Math.max(last.high, price), low: Math.min(last.low, price), close: price, volume: Number(tick.volume ?? last.volume) });
    },
    setMarkers(nextMarkers) { candleSeriesRef.current?.setMarkers(nextMarkers); },
  }), []);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const chart = createChart(hostRef.current, {
      width: hostRef.current.clientWidth,
      height,
      layout: { background: { type: ColorType.Solid, color: "rgba(255,255,255,0)" }, textColor: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 11 },
      grid: { vertLines: { color: "rgba(148,163,184,0.12)" }, horzLines: { color: "rgba(148,163,184,0.16)" } },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.25)", scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: { borderColor: "rgba(148,163,184,0.25)", timeVisible: true, secondsVisible: false, rightOffset: 3, tickMarkFormatter: formatIstTick },
      crosshair: { vertLine: { color: "rgba(100,116,139,0.35)", labelBackgroundColor: "#334155" }, horzLine: { color: "rgba(100,116,139,0.35)", labelBackgroundColor: "#334155" } },
      localization: { locale: "en-IN" },
    });
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981", downColor: "#ef4444", borderUpColor: "#10b981", borderDownColor: "#ef4444", wickUpColor: "#10b981", wickDownColor: "#ef4444",
      priceLineColor: "#10b981", priceLineVisible: false,
    });
    const volumeSeries = chart.addHistogramSeries({
      color: "rgba(16,185,129,0.35)", priceFormat: { type: "volume" }, priceScaleId: "volume",
      lastValueVisible: false, priceLineVisible: false,
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, borderVisible: false });
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry?.contentRect.width) chart.applyOptions({ width: entry.contentRect.width });
    });
    resizeObserver.observe(hostRef.current);
    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      previousDataRef.current = [];
      previousVolumeRef.current = [];
    };
  }, [height]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries) return;

    const previous = previousDataRef.current;
    const nextVolume = volume ?? normalized.map((item) => ({ time: item.time, value: item.volume, color: item.close >= item.open ? "rgba(16,185,129,0.32)" : "rgba(239,68,68,0.3)" }));
    const previousVolume = previousVolumeRef.current;
    const isAppendOrUpdate = normalized.length > 0 && previous.length > 0 && normalized.length >= previous.length &&
      previous.every((item, index) => item.time === normalized[index]?.time && item.open === normalized[index]?.open && item.high === normalized[index]?.high && item.low === normalized[index]?.low && item.close === normalized[index]?.close);
    const canUpdateVolume = nextVolume.length > 0 && previousVolume.length > 0 && nextVolume.length >= previousVolume.length &&
      previousVolume.every((item, index) => item.time === nextVolume[index]?.time);

    if (isAppendOrUpdate) {
      for (const candle of normalized.slice(previous.length)) candleSeries.update(candle);
      if (normalized.length === previous.length && normalized.at(-1)?.time === previous.at(-1)?.time) candleSeries.update(normalized.at(-1));
      if (canUpdateVolume) {
        for (const bar of nextVolume.slice(previousVolume.length)) volumeSeries.update(bar);
        if (nextVolume.length === previousVolume.length) volumeSeries.update(nextVolume.at(-1));
      } else volumeSeries.setData(nextVolume);
    } else {
      candleSeries.setData(normalized);
      volumeSeries.setData(nextVolume);
      if (normalized.length) chart?.timeScale().fitContent();
    }
    candleSeries.setMarkers(markers);
    previousDataRef.current = normalized;
    previousVolumeRef.current = nextVolume;
  }, [normalized, volume, markers]);

  return <div ref={hostRef} className={`min-w-0 w-full ${className}`} style={{ height }} role="img" aria-label="Candlestick chart with volume" />;
});

export default CandleChart;
