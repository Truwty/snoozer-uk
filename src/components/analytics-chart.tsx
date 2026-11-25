"use client";

import { useId, useState } from "react";

type Row = { day: string; views: number; clicks: number };

function curve(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const distance = current.x - previous.x;
    path += ` C ${previous.x + distance * .42} ${previous.y}, ${current.x - distance * .42} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}

export function AnalyticsChart({ rows }: { rows: Row[] }) {
  const days = [...rows].reverse();
  const [selected, setSelected] = useState(Math.max(0, days.length - 1));
  const gradientId = "activity-fill-" + useId().replaceAll(":", "");
  const peak = Math.max(1, ...days.flatMap((day) => [day.views, day.clicks]));
  const points = days.map((day, index) => {
    const x = days.length <= 1 ? 500 : 20 + index / (days.length - 1) * 960;
    return {
      x,
      views: 174 - day.views / peak * 148,
      clicks: 174 - day.clicks / peak * 148,
    };
  });
  const viewPoints = points.map(({ x, views: y }) => ({ x, y }));
  const clickPoints = points.map(({ x, clicks: y }) => ({ x, y }));
  const viewPath = curve(viewPoints);
  const clickPath = curve(clickPoints);
  const areaPath = viewPath && viewPoints.length
    ? viewPath + ` L ${viewPoints[viewPoints.length - 1].x} 184 L ${viewPoints[0].x} 184 Z`
    : "";
  const current = days[Math.min(selected, days.length - 1)];
  const currentPoint = points[Math.min(selected, points.length - 1)];

  return <figure className="activity-chart">
    <figcaption className="chart-legend"><span>Profile views</span><span>Link clicks</span></figcaption>
    <div className="chart-plot">
      <div className="chart-axis" aria-hidden="true"><span>{peak.toLocaleString("en-GB")}</span><span>{Math.round(peak / 2).toLocaleString("en-GB")}</span><span>0</span></div>
      <div className="chart-stage">
        <svg className="analytics-line-svg" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d8fb86" stopOpacity=".24"/>
              <stop offset="100%" stopColor="#d8fb86" stopOpacity="0"/>
            </linearGradient>
          </defs>
          {[26, 100, 174].map((y) => <line key={y} x1="0" y1={y} x2="1000" y2={y} className="chart-gridline"/>)}
          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`}/>}
          {viewPath && <path d={viewPath} className="chart-line-views"/>}
          {clickPath && <path d={clickPath} className="chart-line-clicks"/>}
          {currentPoint && <>
            <line x1={currentPoint.x} y1="14" x2={currentPoint.x} y2="184" className="chart-selected-line"/>
            <circle cx={currentPoint.x} cy={currentPoint.views} r="5" className="chart-selected-dot-views"/>
            <circle cx={currentPoint.x} cy={currentPoint.clicks} r="4" className="chart-selected-dot-clicks"/>
          </>}
        </svg>
        <div className="analytics-chart" role="group" aria-label="Daily profile views and link clicks">
          {days.map((day, index) => <button type="button" key={day.day}
            className="analytics-chart-day"
            tabIndex={index === Math.min(selected, days.length - 1) ? 0 : -1}
            aria-label={`${day.day}: ${day.views} views, ${day.clicks} clicks`}
            aria-pressed={index === selected}
            onMouseEnter={() => setSelected(index)}
            onFocus={() => setSelected(index)}
            onKeyDown={(event) => {
              const next = event.key === "ArrowRight" ? Math.min(index + 1, days.length - 1)
                : event.key === "ArrowLeft" ? Math.max(index - 1, 0) : null;
              if (next !== null) {
                event.preventDefault();
                setSelected(next);
                const button = event.currentTarget.parentElement?.children[next] as HTMLElement | undefined;
                button?.focus();
              }
            }}/>
          )}
        </div>
      </div>
    </div>
    <div className="chart-dates" aria-hidden="true"><span>{days[0]?.day}</span><span>{days.at(-1)?.day}</span></div>
    {current && <output className="chart-tooltip" aria-live="polite">{current.day} UTC · {current.views.toLocaleString("en-GB")} views · {current.clicks.toLocaleString("en-GB")} clicks</output>}
    <p className="muted">Daily activity, oldest to newest. Focus the chart and use the arrow keys to inspect each date. Only days with recorded activity are returned.</p>
  </figure>;
}
