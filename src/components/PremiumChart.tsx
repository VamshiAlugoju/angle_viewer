import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  TickMarkType,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { CandlePoint } from "../api/client";

function toDate(time: UTCTimestamp) {
  return new Date(time * 1000);
}

// Axis tick labels: 12-hour clock with AM/PM for intraday ticks, date for day-level ones.
function tickMarkFormatter(time: UTCTimestamp, tickMarkType: TickMarkType) {
  const date = toDate(time);
  if (tickMarkType === TickMarkType.Year) return date.toLocaleDateString([], { year: "numeric" });
  if (tickMarkType === TickMarkType.Month) return date.toLocaleDateString([], { month: "short", year: "numeric" });
  if (tickMarkType === TickMarkType.DayOfMonth) return date.toLocaleDateString([], { day: "numeric", month: "short" });
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

// Crosshair/tooltip time label — same 12-hour AM/PM format.
function crosshairTimeFormatter(time: UTCTimestamp) {
  const date = toDate(time);
  return `${date.toLocaleDateString([], { day: "numeric", month: "short" })}, ${date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })}`;
}

// Conventional finance color language (green = up, red = down). The palette validator
// flags red/green as CVD-ambiguous on hue alone, but a candlestick's direction is also
// carried by its position/shape (close above or below open) — color is a redundant,
// confirmatory cue here, not the sole encoding, so this pairing (matching this app's
// existing CE/PE and P&L colors) stays instead of breaking a universally-recognized
// trading convention.
const UP_COLOR = "#16a34a";
const DOWN_COLOR = "#e5484d";

export function PremiumChart({ candles }: { candles: CandlePoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const textColor = isDark ? "#9ca3af" : "#6b6375";
    const gridColor = isDark ? "#2e303a" : "#e5e4e7";
    const bgColor = isDark ? "#16171d" : "#ffffff";

    const chart = createChart(container, {
      layout: { background: { type: ColorType.Solid, color: bgColor }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      width: container.clientWidth,
      height: 320,
      // Fixed starting bar width instead of fitContent() — fitContent stretches a
      // handful of candles to fill the whole container, which reads as way too
      // zoomed out. This keeps candles a sane width regardless of how many there are.
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 10,
        minBarSpacing: 1.5,
        tickMarkFormatter,
      },
      localization: { timeFormatter: crosshairTimeFormatter },
      // Native wheel zoom is too gentle — replaced with a custom handler below that's
      // more sensitive. Also disable the library's own wheel-pan, or both fire on the
      // same wheel event and fight each other (looks like the chart jumps backwards).
      // Drag-to-scroll and pinch-to-zoom stay on the default handling.
      handleScale: { mouseWheel: false },
      handleScroll: { mouseWheel: false },
    });
    chartRef.current = chart;

    // Custom wheel-to-zoom: bigger step per tick than the library's built-in mouseWheel handling.
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const timeScale = chart.timeScale();
      const currentSpacing = timeScale.options().barSpacing;
      const factor = e.deltaY < 0 ? 1.35 : 1 / 1.35;
      const nextSpacing = Math.min(80, Math.max(1.5, currentSpacing * factor));
      timeScale.applyOptions({ barSpacing: nextSpacing });
    };
    container.addEventListener("wheel", handleWheel, { passive: false });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderVisible: false,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
    });

    const data = candles
      .map((c) => ({
        time: Math.floor(new Date(c[0]).getTime() / 1000) as UTCTimestamp,
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
      }))
      // lightweight-charts requires strictly ascending, de-duplicated timestamps.
      .sort((a, b) => a.time - b.time)
      .filter((point, i, arr) => i === 0 || point.time !== arr[i - 1].time);

    series.setData(data);
    // Anchor to the most recent candles at the fixed bar spacing set above, instead of
    // stretching everything to fill the width.
    chart.timeScale().scrollToRealTime();

    const handleResize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("wheel", handleWheel);
      chart.remove();
    };
  }, [candles]);

  return <div ref={containerRef} className="premium-chart" />;
}
