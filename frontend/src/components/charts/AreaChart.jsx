import { useEffect, useMemo, useRef } from "react";
import { ColorType, createChart } from "lightweight-charts";

function normalizePoint(point) {
  const value = point.equity ?? point.value ?? point.c;
  const rawTime = point.time ?? point.ts ?? point.t;
  const time = typeof rawTime === "number" ? rawTime : Math.floor(new Date(rawTime).getTime() / 1000);
  return { time, value: Number(value) };
}

export default function AreaChart({ data = [], height = 260, color = "#10b981", className = "" }) {
  const hostRef = useRef(null);
  const seriesRef = useRef(null);
  const points = useMemo(() => data.map(normalizePoint).filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value)), [data]);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const chart = createChart(hostRef.current, {
      width: hostRef.current.clientWidth,
      height,
      layout: { background: { type: ColorType.Solid, color: "rgba(255,255,255,0)" }, textColor: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 11 },
      grid: { vertLines: { color: "rgba(148,163,184,0.1)" }, horzLines: { color: "rgba(148,163,184,0.15)" } },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.2)" },
      timeScale: { borderColor: "rgba(148,163,184,0.2)", timeVisible: true, secondsVisible: false },
      localization: { locale: "en-IN" },
    });
    seriesRef.current = chart.addAreaSeries({ lineColor: color, topColor: `${color}30`, bottomColor: `${color}03`, lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
    const observer = new ResizeObserver(([entry]) => { if (entry?.contentRect.width) chart.applyOptions({ width: entry.contentRect.width }); });
    observer.observe(hostRef.current);
    return () => { observer.disconnect(); chart.remove(); seriesRef.current = null; };
  }, [height, color]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    series.setData(points);
  }, [points]);

  return <div ref={hostRef} className={`min-w-0 w-full ${className}`} style={{ height }} role="img" aria-label="Equity curve area chart" />;
}
