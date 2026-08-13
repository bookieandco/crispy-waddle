"use client";

// Horizontal bar chart: product listings per category. Single series (one
// measure — listing count — across categories), so per the dataviz
// skill's color formula this gets ONE brand hue, not a cycled color per
// bar (cycling a color per bar in a single-series chart is one of its
// listed anti-patterns: color should follow an entity/series, and here
// there's only one series — "listings"). No legend box either, for the
// same single-series reason; the chart's own heading already says what's
// plotted.
//
// Mark spec followed: bars capped at 24px thick, 4px rounded data-end
// (square at the baseline — the left edge, since this is horizontal),
// a 2px surface gap between bars, hairline recessive gridline at zero,
// value labeled at the tip (not on every bar redundantly, but every bar
// here — with only ~8 categories this doesn't cross into "chaos", it's
// the axis and there's no gridline scale otherwise since there's no
// second reference to compare against).

import { CategoryCount } from "@/lib/admin/stats";

const BAR_HEIGHT = 22;
const BAR_GAP = 10; // 2px surface gap + comfortable row spacing
const LABEL_WIDTH = 84;
const CHART_WIDTH = 320;

interface Props {
  data: CategoryCount[];
}

export default function CategoryBarChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-ink/50">No product data yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.count));
  const plotWidth = CHART_WIDTH - LABEL_WIDTH - 36; // room for the value label
  const rowHeight = BAR_HEIGHT + BAR_GAP;
  const svgHeight = data.length * rowHeight;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${svgHeight}`}
      width="100%"
      height={svgHeight}
      role="img"
      aria-label="Product listings per category"
    >
      {/* baseline gridline */}
      <line
        x1={LABEL_WIDTH}
        y1={0}
        x2={LABEL_WIDTH}
        y2={svgHeight}
        stroke="#BEA991"
        strokeWidth={1}
      />
      {data.map((d, i) => {
        const barLen = max > 0 ? (d.count / max) * plotWidth : 0;
        const y = i * rowHeight + BAR_GAP / 2;
        return (
          <g key={d.category}>
            <title>{`${d.category}: ${d.count} listing${d.count === 1 ? "" : "s"}`}</title>
            <text
              x={LABEL_WIDTH - 8}
              y={y + BAR_HEIGHT / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-ink/70"
              fontSize={12}
            >
              {d.category}
            </text>
            <rect
              x={LABEL_WIDTH}
              y={y}
              width={Math.max(barLen, 2)}
              height={BAR_HEIGHT}
              rx={4}
              fill="#AE7841"
            />
            <text
              x={LABEL_WIDTH + Math.max(barLen, 2) + 8}
              y={y + BAR_HEIGHT / 2}
              dominantBaseline="middle"
              className="fill-ink/70"
              fontSize={12}
              fontWeight={600}
            >
              {d.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
