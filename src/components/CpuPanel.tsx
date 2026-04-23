import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import type { CpuMetrics, HistoryPoint } from "../types";

// 사용량에 따른 프로그레스 바 색상
function barColor(pct: number): string {
  if (pct < 60) return "bg-green-500";
  if (pct < 80) return "bg-yellow-500";
  return "bg-red-500";
}

// 사용량에 따른 텍스트 색상
function textColor(pct: number): string {
  if (pct < 60) return "text-green-400";
  if (pct < 80) return "text-yellow-400";
  return "text-red-400";
}

interface CpuPanelProps {
  cpu: CpuMetrics;
  history: HistoryPoint[];
}

export function CpuPanel({ cpu, history }: CpuPanelProps) {
  return (
    <div className="bg-[#1a1d2e] rounded-xl p-5 border border-[#2a2d3e]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          CPU
        </h2>
        <span className="text-xs text-gray-500">{cpu.core_count} cores</span>
      </div>

      {/* 스파크라인 차트 */}
      <div className="mb-3">
        <ResponsiveContainer width="100%" height={50}>
          <AreaChart data={history}>
            <YAxis domain={[0, 100]} hide />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              fill="rgba(99,102,241,0.12)"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 전체 사용률 */}
      <div className="flex items-end justify-between mb-2">
        <span className={`text-3xl font-bold tabular-nums ${textColor(cpu.overall)}`}>
          {cpu.overall.toFixed(1)}%
        </span>
      </div>

      {/* 프로그레스 바 */}
      <div className="w-full h-2 bg-[#2a2d3e] rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor(cpu.overall)}`}
          style={{ width: `${Math.min(cpu.overall, 100)}%` }}
        />
      </div>

      {/* 코어별 사용률 그리드 */}
      <div className="grid grid-cols-4 gap-1.5">
        {cpu.cores.map((usage, i) => (
          <div key={i} className="text-center">
            <div className="w-full h-1.5 bg-[#2a2d3e] rounded-full overflow-hidden mb-0.5">
              <div
                className={`h-full rounded-full ${barColor(usage)}`}
                style={{ width: `${Math.min(usage, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500 tabular-nums">
              {usage.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
