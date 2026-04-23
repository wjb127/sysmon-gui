import { useState, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
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

function formatRuntime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatStartTime(ts: number): string {
  if (ts === 0) return "—";
  return new Date(ts * 1000).toLocaleString();
}

export function ProcessTable({ processes }: ProcessTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [confirmKill, setConfirmKill] = useState(false);
  const [signalError, setSignalError] = useState<string | null>(null);

  async function sendSignal(pid: number, signal: string) {
    setSignalError(null);
    try {
      await invoke("signal_process", { pid, signal });
      if (signal === "kill" || signal === "term") setSelectedPid(null);
    } catch (e) {
      setSignalError(String(e));
    } finally {
      setConfirmKill(false);
    }
  }

  const stableOrderRef = useRef<number[]>([]);
  const pidSet = new Set(processes.map((p) => p.pid));
  const prev = stableOrderRef.current.filter((pid) => pidSet.has(pid));
  const newPids = processes.map((p) => p.pid).filter((pid) => !prev.includes(pid));
  stableOrderRef.current = [...prev, ...newPids];

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processes, search, sortKey, sortDir]);

  // 선택된 프로세스 — 매 렌더마다 최신 데이터로 갱신
  const selected = selectedPid != null
    ? processes.find((p) => p.pid === selectedPid) ?? null
    : null;

  const headerClass =
    "px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 select-none";

  return (
    <div className="flex flex-col h-full bg-[#1a1d2e] border-t border-[#2a2d3e] overflow-hidden">
      {/* 헤더 */}
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
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <th className={headerClass} onClick={() => handleSort("name")}>Name{sortIcon("name")}</th>
              <th className={`${headerClass} text-right`} onClick={() => handleSort("pid")}>PID{sortIcon("pid")}</th>
              <th className={`${headerClass} text-right`} onClick={() => handleSort("cpu_percent")}>CPU%{sortIcon("cpu_percent")}</th>
              <th className={`${headerClass} text-right`} onClick={() => handleSort("memory_mb")}>Memory{sortIcon("memory_mb")}</th>
              <th className={headerClass} onClick={() => handleSort("status")}>Status{sortIcon("status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2d3e]">
            {filtered.map((proc) => {
              const isSelected = proc.pid === selectedPid;
              return (
                <tr
                  key={proc.pid}
                  onClick={() => {
                    setSelectedPid(isSelected ? null : proc.pid);
                    setConfirmKill(false);
                    setSignalError(null);
                  }}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? "bg-indigo-500/10 border-l-2 border-indigo-500" : "hover:bg-[#232640]"
                  }`}
                >
                  <td className="px-3 py-2 text-gray-200 truncate max-w-[200px]">{proc.name}</td>
                  <td className="px-3 py-2 text-right text-gray-400 tabular-nums">{proc.pid}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={
                      proc.cpu_percent > 50 ? "text-red-400"
                      : proc.cpu_percent > 10 ? "text-yellow-400"
                      : "text-gray-300"
                    }>
                      {proc.cpu_percent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{formatMemory(proc.memory_mb)}</td>
                  <td className={`px-3 py-2 ${statusColor(proc.status)}`}>{proc.status}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">No processes found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 상세 패널 — 프로세스 선택 시 표시 */}
      {selected && (
        <div className="flex-shrink-0 border-t border-indigo-500/30 bg-[#131625]">
          {/* 패널 헤더 */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2d3e]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white">{selected.name}</span>
              <span className="text-xs text-gray-500">PID {selected.pid}</span>
              {selected.user && (
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                  {selected.user}
                </span>
              )}
            </div>
            <button
              onClick={() => setSelectedPid(null)}
              className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 액션 버튼 */}
          {(() => {
            const isStopped = selected.status.toLowerCase().includes("stop");
            return (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2a2d3e]">
                {/* 일시정지 / 재개 */}
                {isStopped ? (
                  <button
                    onClick={() => sendSignal(selected.pid, "cont")}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    재개
                  </button>
                ) : (
                  <button
                    onClick={() => sendSignal(selected.pid, "stop")}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-gray-500/10 text-gray-300 hover:bg-gray-500/20 border border-gray-600 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>
                    일시정지
                  </button>
                )}

                {/* 종료 요청 (SIGTERM) */}
                <button
                  onClick={() => sendSignal(selected.pid, "term")}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  종료 요청
                </button>

                {/* 강제 종료 (SIGKILL) */}
                {confirmKill ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-red-400">강제 종료할까요?</span>
                    <button
                      onClick={() => sendSignal(selected.pid, "kill")}
                      className="px-2 py-1 rounded text-[11px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors"
                    >
                      확인
                    </button>
                    <button
                      onClick={() => setConfirmKill(false)}
                      className="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white transition-colors"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmKill(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    강제 종료
                  </button>
                )}

                {/* 에러 메시지 */}
                {signalError && (
                  <span className="text-[10px] text-red-400 ml-auto">{signalError}</span>
                )}
              </div>
            );
          })()}

          {/* 메트릭 그리드 */}
          <div className="grid grid-cols-4 gap-px bg-[#2a2d3e] border-b border-[#2a2d3e]">
            {[
              { label: "CPU", value: `${selected.cpu_percent.toFixed(1)}%` },
              { label: "Memory", value: formatMemory(selected.memory_mb) },
              { label: "Status", value: selected.status },
              { label: "Parent PID", value: selected.parent_pid != null ? String(selected.parent_pid) : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#131625] px-3 py-2">
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
                <div className="text-xs font-medium text-white tabular-nums mt-0.5">{value}</div>
              </div>
            ))}
          </div>

          {/* 경로 + 커맨드 */}
          <div className="px-4 py-2.5 space-y-1.5">
            {selected.exe_path && (
              <div>
                <span className="text-[9px] text-gray-500 uppercase tracking-wider mr-2">Path</span>
                <span className="text-[11px] text-gray-300 font-mono break-all">{selected.exe_path}</span>
              </div>
            )}
            {selected.cmd && selected.cmd !== selected.exe_path && (
              <div>
                <span className="text-[9px] text-gray-500 uppercase tracking-wider mr-2">CMD</span>
                <span className="text-[11px] text-gray-400 font-mono break-all line-clamp-2">{selected.cmd}</span>
              </div>
            )}
            <div className="flex gap-4 text-[10px] text-gray-500">
              <span>Started {formatStartTime(selected.start_time)}</span>
              <span>Running {formatRuntime(selected.run_time)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
