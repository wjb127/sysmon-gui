import type { DiskMetrics } from "../types";

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
  disks: DiskMetrics[];
}

export function DiskPanel({ disks }: Props) {
  const totalUsed = disks.reduce((s, d) => s + d.used_gb, 0);
  const totalSize = disks.reduce((s, d) => s + d.total_gb, 0);
  const totalPct = totalSize > 0 ? (totalUsed / totalSize) * 100 : 0;

  return (
    <div className="p-4 space-y-4">
      {/* 요약 */}
      <div className="flex items-end gap-4">
        <span className={`text-5xl font-bold tabular-nums leading-none ${textColor(totalPct)}`}>
          {totalPct.toFixed(1)}
          <span className="text-2xl font-medium text-gray-400">%</span>
        </span>
        <div className="pb-1 space-y-0.5">
          <p className="text-xs text-gray-300 tabular-nums">
            {totalUsed.toFixed(1)} GB used
          </p>
          <p className="text-xs text-gray-500 tabular-nums">
            {(totalSize - totalUsed).toFixed(1)} GB free · {totalSize.toFixed(0)} GB total
          </p>
        </div>
      </div>

      {/* 볼륨별 상세 */}
      <div>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
          Volumes ({disks.length})
        </p>
        <div className="space-y-3">
          {disks.map((disk, i) => (
            <div key={i} className="bg-[#151827] rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm text-white font-medium">{disk.mount || "/"}</p>
                  {disk.name && disk.name !== disk.mount && (
                    <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[200px]">{disk.name}</p>
                  )}
                </div>
                <span className={`text-sm font-bold tabular-nums ${textColor(disk.percent)}`}>
                  {disk.percent.toFixed(1)}%
                </span>
              </div>

              {/* 프로그레스 바 */}
              <div className="w-full h-2 bg-[#2a2d3e] rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${barColor(disk.percent)}`}
                  style={{ width: `${Math.min(disk.percent, 100)}%` }}
                />
              </div>

              {/* 수치 */}
              <div className="flex justify-between text-[11px] tabular-nums">
                <span className="text-gray-400">{disk.used_gb.toFixed(1)} GB used</span>
                <span className="text-gray-500">{(disk.total_gb - disk.used_gb).toFixed(1)} GB free</span>
                <span className="text-gray-500">{disk.total_gb.toFixed(0)} GB total</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
