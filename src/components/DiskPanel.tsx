import type { DiskMetrics } from "../types";

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

interface DiskPanelProps {
  disks: DiskMetrics[];
}

export function DiskPanel({ disks }: DiskPanelProps) {
  return (
    <div className="bg-[#1a1d2e] rounded-xl p-5 border border-[#2a2d3e]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          Disk
        </h2>
        <span className="text-xs text-gray-500">
          {disks.length} volume{disks.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3">
        {disks.map((disk, i) => (
          <div key={i}>
            {/* 디스크 이름과 마운트 포인트 */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-300 truncate max-w-[140px]">
                {disk.mount || disk.name || "Unknown"}
              </span>
              <span className={`text-sm font-medium tabular-nums ${textColor(disk.percent)}`}>
                {disk.percent.toFixed(0)}%
              </span>
            </div>

            {/* 프로그레스 바 */}
            <div className="w-full h-2 bg-[#2a2d3e] rounded-full overflow-hidden mb-1">
              <div
                className={`h-full rounded-full transition-all duration-300 ${barColor(disk.percent)}`}
                style={{ width: `${Math.min(disk.percent, 100)}%` }}
              />
            </div>

            {/* 용량 표시 */}
            <div className="text-xs text-gray-500 tabular-nums">
              {disk.used_gb.toFixed(0)} / {disk.total_gb.toFixed(0)} GB
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
