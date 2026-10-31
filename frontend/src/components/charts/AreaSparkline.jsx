import { useEffect, useMemo, useRef } from "react";
import { ColorType, createChart } from "lightweight-charts";

export default function AreaSparkline({ data = [], color = "#10b981", height = 64, className = "" }) {
  const hostRef = useRef(null);
  const seriesRef = useRef(null);
  const normalized = useMemo(() => data.map((point) => ({
    time: typeof point.time === "number" ? point.time : Math.floor(new Date(point.time ?? point.t).getTime() / 1000),
    value: Number(point.value ?? point.close ?? point.c),
  })).filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value)), [data]);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const chart = createChart(hostRef.current, {
      width: hostRef.current.clientWidth,
      height,
      layout: { background: { type: ColorType.Solid, color: "rgba(255,255,255,0)" }, textColor: "transparent", fontFamily: "Inter, sans-serif" },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { visible: false }, leftPriceScale: { visible: false },
      timeScale: { visible: false, borderVisible: false, rightOffset: 0 },
      crosshair: { vertLine: { visible: false, labelVisible: false }, horzLine: { visible: false, labelVisible: false } },
      handleScroll: false, handleScale: false,
    });
    const series = chart.addAreaSeries({ lineColor: color, topColor: `${color}35`, bottomColor: `${color}02`, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    seriesRef.current = series;
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry?.contentRect.width) chart.applyOptions({ width: entry.contentRect.width });
    });
    resizeObserver.observe(hostRef.current);
    return () => { resizeObserver.disconnect(); chart.remove(); seriesRef.current = null; };
  }, [height, color]);

  useEffect(() => { seriesRef.current?.setData(normalized); }, [normalized]);
  return <div ref={hostRef} className={`min-w-0 w-full ${className}`} style={{ height }} aria-hidden="true" />;
}
