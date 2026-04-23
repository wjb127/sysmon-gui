import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
  XAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { CpuMetrics, HistoryPoint } from "../types";

function barColor(pct: number) {
  if (pct < 60) return "bg-green-500";
  if (pct < 80) return "bg-yellow-500";
  return "bg-red-500";
}

function textColor(pct: number) {
  if (pct < 60) return "text-green-400";
  if (pct < 80) return "text-yellow-400";
  return "text-red-400";
}

interface Props {
  cpu: CpuMetrics;
  history: HistoryPoint[];
}

export function CpuPanel({ cpu, history }: Props) {
  return (
    <div className="p-4 space-y-4">
      {/* 상단: 전체 사용률 + 메타 */}
      <div className="flex items-end gap-4">
        <span className={`text-5xl font-bold tabular-nums leading-none ${textColor(cpu.overall)}`}>
          {cpu.overall.toFixed(1)}
          <span className="text-2xl font-medium text-gray-400">%</span>
        </span>
        <div className="pb-1 space-y-0.5">
          <p className="text-xs text-gray-400">{cpu.core_count} cores</p>
          <div className="w-32 h-1.5 bg-[#2a2d3e] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${barColor(cpu.overall)}`}
              style={{ width: `${Math.min(cpu.overall, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 히스토리 차트 */}
      <div className="bg-[#151827] rounded-lg p-3">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Usage History (60s)</p>
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={history} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" vertical={false} />
            <YAxis domain={[0, 100]} hide />
            <XAxis dataKey="time" hide />
            <Tooltip
              contentStyle={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 6, fontSize: 11 }}
              formatter={(v) => [`${Number(v).toFixed(1)}%`, "CPU"]}
              labelFormatter={() => ""}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              fill="rgba(99,102,241,0.15)"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 코어별 사용률 그리드 */}
      <div>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Per Core</p>
        <div className="grid grid-cols-4 gap-2">
          {cpu.cores.map((usage, i) => (
            <div key={i} className="bg-[#151827] rounded-lg p-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-gray-500">C{i}</span>
                <span className={`text-[11px] font-medium tabular-nums ${textColor(usage)}`}>
                  {usage.toFixed(0)}%
                </span>
              </div>
              <div className="w-full h-1 bg-[#2a2d3e] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor(usage)}`}
                  style={{ width: `${Math.min(usage, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
