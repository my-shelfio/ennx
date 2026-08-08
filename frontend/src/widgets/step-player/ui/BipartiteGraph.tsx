import type { MatchingStepSnapshot } from "../../../entities/matching";
import { cn } from "../../../shared/lib";
import type { EdgeKind, HighlightedEdge } from "../lib/highlightedEdge";

export interface BipartiteGraphProps {
  proposerNames: readonly string[];
  receiverNames: readonly string[];
  snapshot: MatchingStepSnapshot;
  highlightedEdge: HighlightedEdge;
  /** true の場合、ハイライトのアニメーションを抑制する（`prefers-reduced-motion`）。 */
  reduceMotion: boolean;
  /**
   * 追跡対象の提案者（社員、0-indexed）。指定されている間、現在のステップに関係なく
   * ノードと現在の配属エッジを常時ハイライトする（社員追跡機能）。null の場合は追跡なし。
   */
  trackedProposerIndex?: number | null;
}

const ROW_HEIGHT = 44;
const TOP_PADDING = 24;
const NODE_RADIUS = 14;
const COLUMN_INSET = 70;

const EDGE_STYLE: Record<EdgeKind, { stroke: string; dashed: boolean }> = {
  propose: { stroke: "var(--color-slate-400, #94a3b8)", dashed: true },
  tentative: { stroke: "var(--color-primary-500)", dashed: false },
  confirm: { stroke: "var(--color-ok-600, #059669)", dashed: false },
  reject: { stroke: "var(--color-danger-500)", dashed: true },
  waitlist: { stroke: "var(--color-warning-500, #d97706)", dashed: true },
  cutoff: { stroke: "var(--color-warning-500, #d97706)", dashed: false },
};

const LEGEND: { kind: EdgeKind; label: string }[] = [
  { kind: "propose", label: "提案" },
  { kind: "tentative", label: "仮受入" },
  { kind: "confirm", label: "確定" },
  { kind: "reject", label: "棄却" },
  { kind: "waitlist", label: "待機" },
  { kind: "cutoff", label: "カットオフ" },
];

/**
 * 実行過程の二部グラフ図。
 * 左列に提案者（社員）ノード、右列に受入者（部署）ノードを配置し、現在の仮受入/確定
 * エッジ（`snapshot`）を細線で、当該ステップで変化したエッジ（`highlightedEdge`）を
 * 太線 + 色分けで表示する。凡例は色分けの意味を示す。
 */
export function BipartiteGraph({
  proposerNames,
  receiverNames,
  snapshot,
  highlightedEdge,
  reduceMotion,
  trackedProposerIndex = null,
}: BipartiteGraphProps) {
  const rowCount = Math.max(proposerNames.length, receiverNames.length, 1);
  const height = rowCount * ROW_HEIGHT + TOP_PADDING * 2;
  const width = 320;
  const leftX = COLUMN_INSET;
  const rightX = width - COLUMN_INSET;

  const proposerY = (index: number) => TOP_PADDING + index * ROW_HEIGHT + ROW_HEIGHT / 2;
  const receiverY = (index: number) => TOP_PADDING + index * ROW_HEIGHT + ROW_HEIGHT / 2;

  const highlightStyle = EDGE_STYLE[highlightedEdge.kind];
  const trackedName =
    trackedProposerIndex !== null ? (proposerNames[trackedProposerIndex] ?? null) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="w-full overflow-x-auto rounded-control border border-slate-200 bg-white p-2">
        <svg
          role="img"
          aria-label={`ステップの二部グラフ図（提案者 ${proposerNames.length} 名・受入者 ${receiverNames.length} 件）${
            trackedName !== null ? `。${trackedName}を追跡中` : ""
          }`}
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto"
          style={{ minWidth: 280, height }}
        >
          {/* 現在の仮受入/確定エッジ（細線）。追跡対象社員のエッジは常時ハイライトする。 */}
          {snapshot.proposerMatch.map((receiverIndex, proposerIndex) => {
            if (receiverIndex === -1) {
              return null;
            }
            const isTracked = proposerIndex === trackedProposerIndex;
            return (
              <line
                key={`base-${proposerIndex}`}
                x1={leftX}
                y1={proposerY(proposerIndex)}
                x2={rightX}
                y2={receiverY(receiverIndex)}
                stroke={isTracked ? "var(--color-primary-600)" : "var(--color-slate-300, #cbd5e1)"}
                strokeWidth={isTracked ? 3 : 2}
              />
            );
          })}

          {/* 当該ステップで変化したエッジ（太線 + 色分け + ハイライト）。 */}
          {highlightedEdge.proposerIndex !== null ? (
            <line
              x1={leftX}
              y1={proposerY(highlightedEdge.proposerIndex)}
              x2={rightX}
              y2={receiverY(highlightedEdge.receiverIndex)}
              stroke={highlightStyle.stroke}
              strokeWidth={4}
              strokeDasharray={highlightStyle.dashed ? "6 4" : undefined}
              className={reduceMotion ? undefined : "animate-pulse"}
            />
          ) : null}

          {proposerNames.map((name, index) => {
            const isTracked = index === trackedProposerIndex;
            return (
              <g key={`proposer-${index}`}>
                {isTracked ? (
                  <circle
                    cx={leftX}
                    cy={proposerY(index)}
                    r={NODE_RADIUS + 5}
                    fill="none"
                    stroke="var(--color-primary-600)"
                    strokeWidth={2}
                  />
                ) : null}
                <circle
                  cx={leftX}
                  cy={proposerY(index)}
                  r={NODE_RADIUS}
                  fill={isTracked ? "var(--color-primary-100, #e0e7ff)" : "white"}
                  stroke="var(--color-primary-500)"
                  strokeWidth={isTracked ? 3 : 2}
                />
                <text
                  x={leftX - NODE_RADIUS - 6}
                  y={proposerY(index)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight={isTracked ? 700 : 400}
                  fill="#334155"
                >
                  {name}
                </text>
              </g>
            );
          })}

          {receiverNames.map((name, index) => {
            const isCutoffTarget =
              highlightedEdge.kind === "cutoff" && highlightedEdge.receiverIndex === index;
            return (
              <g key={`receiver-${index}`}>
                <circle
                  cx={rightX}
                  cy={receiverY(index)}
                  r={NODE_RADIUS}
                  fill="white"
                  stroke={isCutoffTarget ? "var(--color-warning-500, #d97706)" : "var(--color-slate-500, #64748b)"}
                  strokeWidth={isCutoffTarget ? 4 : 2}
                  className={isCutoffTarget && !reduceMotion ? "animate-pulse" : undefined}
                />
                <text x={rightX + NODE_RADIUS + 6} y={receiverY(index)} textAnchor="start" dominantBaseline="middle" fontSize={11} fill="#334155">
                  {name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {LEGEND.map(({ kind, label }) => (
          <li key={kind} className="flex items-center gap-1.5">
            <span
              className={cn("inline-block h-2.5 w-2.5 rounded-pill")}
              style={{ backgroundColor: EDGE_STYLE[kind].stroke }}
            />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
