"use client";

import { useState } from "react";

export function AnalyticsChart({ rows }: { rows: { day: string; views: number; clicks: number }[] }) {
  const days = [...rows].reverse();
  const [selected, setSelected] = useState(days.length - 1);
  const peak = Math.max(1, ...days.flatMap((day) => [day.views, day.clicks]));
  const current = days[Math.min(selected, days.length - 1)];
  return <figure className="activity-chart">
    <figcaption className="chart-legend"><span>Views · silver</span><span>Clicks · green</span></figcaption>
    <div className="chart-plot">
      <div className="chart-axis" aria-hidden="true"><span>{peak}</span><span>{Math.round(peak / 2)}</span><span>0</span></div>
      <div className="analytics-chart" role="group" aria-label="Daily views and link clicks">
        {days.map((day, index) => <button type="button" key={day.day} className="analytics-chart-day" tabIndex={index === Math.min(selected, days.length - 1) ? 0 : -1}
          aria-label={`${day.day}: ${day.views} views, ${day.clicks} clicks`}
          onMouseEnter={() => setSelected(index)} onFocus={() => setSelected(index)}
          onKeyDown={(event) => {
            const next = event.key === "ArrowRight" ? Math.min(index + 1, days.length - 1) : event.key === "ArrowLeft" ? Math.max(index - 1, 0) : null;
            if (next !== null) { event.preventDefault(); setSelected(next); const button = event.currentTarget.parentElement?.children[next] as HTMLElement; button?.focus(); }
          }}>
          <span className="analytics-bar views" style={{ height: `${day.views / peak * 100}%` }} />
          <span className="analytics-bar clicks" style={{ height: `${day.clicks / peak * 100}%` }} />
        </button>)}
      </div>
    </div>
    <div className="chart-dates" aria-hidden="true"><span>{days[0]?.day}</span><span>{days.at(-1)?.day}</span></div>
    {current && <output className="chart-tooltip" aria-live="polite">{current.day} UTC · {current.views} views · {current.clicks} clicks</output>}
    <p className="muted">Daily activity, oldest to newest. Use arrow keys to explore. Days without recorded activity are omitted.</p>
  </figure>;
}
