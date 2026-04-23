import { useState, useMemo, useRef } from "react";
import type { ProcessInfo } from "../types";

type SortKey = "name" | "pid" | "cpu_percent" | "memory_mb" | "status" | null;
type SortDir = "asc" | "desc";

interface ProcessTableProps {
  processes: ProcessInfo[];
}

function formatMemory(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  return `${(mb * 1024).toFixed(0)} KB`;
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("run")) return "text-green-400";
  if (s.includes("sleep")) return "text-blue-400";
  if (s.includes("stop")) return "text-yellow-400";
  if (s.includes("zombie")) return "text-red-400";
  return "text-gray-400";
}

export function ProcessTable({ processes }: ProcessTableProps) {
  const [search, setSearch] = useState("");
  // 기본값 null = 정렬 없음 (최초 등장 순서 유지)
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // 최초 등장 순서를 PID 배열로 고정. 새 PID는 뒤에 추가, 사라진 PID는 제거.
  const stableOrderRef = useRef<number[]>([]);
  const pidSet = new Set(processes.map((p) => p.pid));
  const prev = stableOrderRef.current.filter((pid) => pidSet.has(pid));
  const newPids = processes.map((p) => p.pid).filter((pid) => !prev.includes(pid));
  stableOrderRef.current = [...prev, ...newPids];

  // 정렬 클릭: desc → asc → null(원래 순서) 순환
  function handleSort(key: NonNullable<SortKey>) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortDir("asc");
    } else {
      setSortKey(null);
    }
  }

  function sortIcon(key: NonNullable<SortKey>): string {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = processes.filter(
      (p) => p.name.toLowerCase().includes(q) || String(p.pid).includes(q)
    );

    if (sortKey === null) {
      // 정렬 없음: stableOrderRef 기준으로 배치
      const pidIndex = new Map(stableOrderRef.current.map((pid, i) => [pid, i]));
      list.sort((a, b) => (pidIndex.get(a.pid) ?? 0) - (pidIndex.get(b.pid) ?? 0));
    } else {
      list.sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case "name": cmp = a.name.localeCompare(b.name); break;
          case "pid": cmp = a.pid - b.pid; break;
          case "cpu_percent": cmp = a.cpu_percent - b.cpu_percent; break;
          case "memory_mb": cmp = a.memory_mb - b.memory_mb; break;
          case "status": cmp = a.status.localeCompare(b.status); break;
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return list;
  // stableOrderRef는 ref라 deps 불필요 - processes 변경 시마다 재계산
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processes, search, sortKey, sortDir]);

  const headerClass =
    "px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 select-none";

  return (
    <div className="flex flex-col h-full bg-[#1a1d2e] border-t border-[#2a2d3e] overflow-hidden">
      {/* 헤더: 타이틀 + 검색 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2d3e] flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Processes</h2>
          <span className="text-xs text-gray-600">({filtered.length})</span>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-40"
          />
          <svg
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#151827] sticky top-0">
            <tr>
              <th className={headerClass} onClick={() => handleSort("name")}>
                Name{sortIcon("name")}
              </th>
              <th
                className={`${headerClass} text-right`}
                onClick={() => handleSort("pid")}
              >
                PID{sortIcon("pid")}
              </th>
              <th
                className={`${headerClass} text-right`}
                onClick={() => handleSort("cpu_percent")}
              >
                CPU%{sortIcon("cpu_percent")}
              </th>
              <th
                className={`${headerClass} text-right`}
                onClick={() => handleSort("memory_mb")}
              >
                Memory{sortIcon("memory_mb")}
              </th>
              <th className={headerClass} onClick={() => handleSort("status")}>
                Status{sortIcon("status")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2d3e]">
            {filtered.map((proc) => (
              <tr
                key={proc.pid}
                className="hover:bg-[#232640] transition-colors"
              >
                <td className="px-3 py-2 text-gray-200 truncate max-w-[200px]">
                  {proc.name}
                </td>
                <td className="px-3 py-2 text-right text-gray-400 tabular-nums">
                  {proc.pid}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span
                    className={
                      proc.cpu_percent > 50
                        ? "text-red-400"
                        : proc.cpu_percent > 10
                          ? "text-yellow-400"
                          : "text-gray-300"
                    }
                  >
                    {proc.cpu_percent.toFixed(1)}%
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-gray-300 tabular-nums">
                  {formatMemory(proc.memory_mb)}
                </td>
                <td className={`px-3 py-2 ${statusColor(proc.status)}`}>
                  {proc.status}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-gray-500"
                >
                  No processes found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
