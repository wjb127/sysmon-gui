import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DiskMetrics, DirEntry } from "../types";

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

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

interface Props {
  disks: DiskMetrics[];
}

export function DiskPanel({ disks }: Props) {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ name: string; path: string }[]>([]);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  async function navigateTo(path: string, _name: string, newCrumbs: { name: string; path: string }[]) {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<DirEntry[]>("read_dir_entries", { path });
      setEntries(result);
      setCurrentPath(path);
      setBreadcrumbs(newCrumbs);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function enterVolume(mount: string) {
    navigateTo(mount, mount, [{ name: mount, path: mount }]);
  }

  function enterDir(entry: DirEntry) {
    const newCrumbs = [...breadcrumbs, { name: entry.name, path: entry.path }];
    navigateTo(entry.path, entry.name, newCrumbs);
  }

  function navigateToCrumb(index: number) {
    const crumb = breadcrumbs[index];
    const newCrumbs = breadcrumbs.slice(0, index + 1);
    navigateTo(crumb.path, crumb.name, newCrumbs);
  }

  function goBack() {
    if (breadcrumbs.length <= 1) {
      setCurrentPath(null);
      setBreadcrumbs([]);
      setEntries([]);
    } else {
      const newCrumbs = breadcrumbs.slice(0, -1);
      const prev = newCrumbs[newCrumbs.length - 1];
      navigateTo(prev.path, prev.name, newCrumbs);
    }
  }

  const visible = showHidden ? entries : entries.filter((e) => !e.is_hidden);

  const totalUsed = disks.reduce((s, d) => s + d.used_gb, 0);
  const totalSize = disks.reduce((s, d) => s + d.total_gb, 0);
  const totalPct = totalSize > 0 ? (totalUsed / totalSize) * 100 : 0;

  // 볼륨 목록 화면
  if (currentPath === null) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-end gap-4">
          <span className={`text-5xl font-bold tabular-nums leading-none ${textColor(totalPct)}`}>
            {totalPct.toFixed(1)}
            <span className="text-2xl font-medium text-gray-400">%</span>
          </span>
          <div className="pb-1 space-y-0.5">
            <p className="text-xs text-gray-300 tabular-nums">{totalUsed.toFixed(1)} GB used</p>
            <p className="text-xs text-gray-500 tabular-nums">
              {(totalSize - totalUsed).toFixed(1)} GB free · {totalSize.toFixed(0)} GB total
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Volumes — 클릭하면 탐색</p>
          <div className="space-y-2">
            {disks.map((disk, i) => (
              <button
                key={i}
                onClick={() => enterVolume(disk.mount || "/")}
                className="w-full text-left bg-[#151827] hover:bg-[#1e2235] rounded-lg p-3 transition-colors group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm text-white font-medium group-hover:text-indigo-300 transition-colors">
                      {disk.mount || "/"}
                    </p>
                    {disk.name && disk.name !== disk.mount && (
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[200px]">{disk.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold tabular-nums ${textColor(disk.percent)}`}>
                      {disk.percent.toFixed(1)}%
                    </span>
                    <svg className="w-4 h-4 text-gray-600 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-[#2a2d3e] rounded-full overflow-hidden mb-1.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor(disk.percent)}`}
                    style={{ width: `${Math.min(disk.percent, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] tabular-nums text-gray-500">
                  <span>{disk.used_gb.toFixed(1)} GB used</span>
                  <span>{(disk.total_gb - disk.used_gb).toFixed(1)} GB free · {disk.total_gb.toFixed(0)} GB total</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 디렉토리 탐색 화면
  return (
    <div className="flex flex-col" style={{ maxHeight: 280 }}>
      {/* 브레드크럼 + 컨트롤 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2d3e] flex-shrink-0">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <button
            onClick={goBack}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-[#2a2d3e] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {/* 브레드크럼 — 마지막 2개만 표시 */}
          <div className="flex items-center gap-1 text-xs min-w-0 overflow-hidden">
            {breadcrumbs.length > 2 && (
              <>
                <button
                  onClick={() => navigateToCrumb(0)}
                  className="text-gray-500 hover:text-gray-300 flex-shrink-0"
                >
                  {breadcrumbs[0].name}
                </button>
                <span className="text-gray-600 flex-shrink-0">›</span>
                <span className="text-gray-600 flex-shrink-0">…</span>
                <span className="text-gray-600 flex-shrink-0">›</span>
              </>
            )}
            {breadcrumbs.slice(-2).map((crumb, idx) => {
              const realIdx = breadcrumbs.length > 2 ? breadcrumbs.length - 2 + idx : idx;
              const isLast = realIdx === breadcrumbs.length - 1;
              return (
                <span key={realIdx} className="flex items-center gap-1 min-w-0">
                  {realIdx > 0 && <span className="text-gray-600 flex-shrink-0">›</span>}
                  {isLast ? (
                    <span className="text-white truncate">{crumb.name}</span>
                  ) : (
                    <button
                      onClick={() => navigateToCrumb(realIdx)}
                      className="text-gray-400 hover:text-gray-200 truncate"
                    >
                      {crumb.name}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>
        <button
          onClick={() => setShowHidden((v) => !v)}
          className={`flex-shrink-0 ml-2 text-[10px] px-2 py-0.5 rounded transition-colors ${
            showHidden ? "bg-indigo-500/20 text-indigo-400" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          hidden
        </button>
      </div>

      {/* 엔트리 목록 */}
      <div className="overflow-y-auto flex-1">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <span className="text-xs text-gray-500">Loading...</span>
          </div>
        )}
        {error && (
          <div className="px-3 py-3 text-xs text-red-400">{error}</div>
        )}
        {!loading && !error && visible.length === 0 && (
          <div className="px-3 py-6 text-xs text-gray-500 text-center">비어 있음</div>
        )}
        {!loading && !error && visible.map((entry, i) => (
          <div
            key={i}
            onClick={() => entry.is_dir && enterDir(entry)}
            className={`flex items-center gap-2 px-3 py-1.5 border-b border-[#1e2235] last:border-0 ${
              entry.is_dir
                ? "cursor-pointer hover:bg-[#1e2235] group"
                : "cursor-default"
            } ${entry.is_hidden ? "opacity-50" : ""}`}
          >
            {/* 아이콘 */}
            <span className="flex-shrink-0 text-sm">
              {entry.is_dir ? "📁" : "📄"}
            </span>

            {/* 이름 */}
            <span className={`flex-1 text-xs truncate ${entry.is_dir ? "text-blue-300 group-hover:text-blue-200" : "text-gray-300"}`}>
              {entry.name}
            </span>

            {/* 우측 정보 */}
            <span className="flex-shrink-0 text-[10px] text-gray-500 tabular-nums">
              {entry.is_dir
                ? entry.child_count != null ? `${entry.child_count} items` : "—"
                : formatBytes(entry.size_bytes)
              }
            </span>

            {/* 디렉토리 화살표 */}
            {entry.is_dir && (
              <svg className="flex-shrink-0 w-3 h-3 text-gray-600 group-hover:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
