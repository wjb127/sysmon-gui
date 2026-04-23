import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
  XAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { MemoryMetrics, HistoryPoint } from "../types";

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
  memory: MemoryMetrics;
  history: HistoryPoint[];
}

export function MemoryPanel({ memory, history }: Props) {
  const freeGb = memory.total_gb - memory.used_gb;

  return (
    <div className="p-4 space-y-4">
      {/* 상단: 사용률 + 수치 */}
      <div className="flex items-end gap-4">
        <span className={`text-5xl font-bold tabular-nums leading-none ${textColor(memory.percent)}`}>
          {memory.percent.toFixed(1)}
          <span className="text-2xl font-medium text-gray-400">%</span>
        </span>
        <div className="pb-1 space-y-0.5">
          <p className="text-xs text-gray-300 tabular-nums">
            {memory.used_gb.toFixed(2)} GB used
          </p>
          <p className="text-xs text-gray-500 tabular-nums">
            {freeGb.toFixed(2)} GB free · {memory.total_gb.toFixed(0)} GB total
          </p>
        </div>
      </div>

      {/* 프로그레스 바 */}
      <div className="w-full h-2 bg-[#2a2d3e] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor(memory.percent)}`}
          style={{ width: `${Math.min(memory.percent, 100)}%` }}
        />
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
              formatter={(v) => [`${Number(v).toFixed(1)}%`, "Memory"]}
              labelFormatter={() => ""}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#8b5cf6"
              fill="rgba(139,92,246,0.15)"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 메모리 블록 시각화 */}
      <div>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Breakdown</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#151827] rounded-lg p-3">
            <p className="text-[10px] text-gray-500 mb-1">Used</p>
            <p className="text-sm font-semibold text-white tabular-nums">{memory.used_gb.toFixed(2)} GB</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{memory.percent.toFixed(1)}%</p>
          </div>
          <div className="bg-[#151827] rounded-lg p-3">
            <p className="text-[10px] text-gray-500 mb-1">Available</p>
            <p className="text-sm font-semibold text-white tabular-nums">{freeGb.toFixed(2)} GB</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{(100 - memory.percent).toFixed(1)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
