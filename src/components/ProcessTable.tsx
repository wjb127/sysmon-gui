import { useState, useMemo, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ProcessInfo } from "../types";

type SortKey = "name" | "count" | "cpu_percent" | "memory_mb" | null;
type SortDir = "asc" | "desc";

interface ProcessGroup {
  name: string;
  processes: ProcessInfo[];
  totalMemory: number;
  totalCpu: number;
}

interface Props {
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
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function formatStartTime(ts: number): string {
  if (ts === 0) return "—";
  return new Date(ts * 1000).toLocaleString();
}

function cpuColor(pct: number): string {
  if (pct > 50) return "text-red-400";
  if (pct > 10) return "text-yellow-400";
  return "text-gray-300";
}

export function ProcessTable({ processes }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("memory_mb");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [confirmKill, setConfirmKill] = useState(false);
  const [signalError, setSignalError] = useState<string | null>(null);

  // 검색어 바뀌면 모든 그룹 펼치기
  useEffect(() => {
    if (search) setExpandedGroups(new Set(groups.map((g) => g.name)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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

  function toggleGroup(name: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function handleSort(key: NonNullable<SortKey>) {
    if (sortKey !== key) { setSortKey(key); setSortDir("desc"); }
    else if (sortDir === "desc") setSortDir("asc");
    else setSortKey(null);
  }

  function sortIcon(key: NonNullable<SortKey>) {
    return sortKey !== key ? "" : sortDir === "asc" ? " ▲" : " ▼";
  }

  const groups = useMemo<ProcessGroup[]>(() => {
    const q = search.toLowerCase();
    const matching = processes.filter(
      (p) => p.name.toLowerCase().includes(q) || String(p.pid).includes(q)
    );

    // 이름별 그룹핑
    const map = new Map<string, ProcessInfo[]>();
    for (const p of matching) {
      const arr = map.get(p.name) ?? [];
      arr.push(p);
      map.set(p.name, arr);
    }

    const result: ProcessGroup[] = Array.from(map.entries()).map(([name, procs]) => ({
      name,
      // 그룹 내부는 메모리 내림차순
      processes: [...procs].sort((a, b) => b.memory_mb - a.memory_mb),
      totalMemory: procs.reduce((s, p) => s + p.memory_mb, 0),
      totalCpu: procs.reduce((s, p) => s + p.cpu_percent, 0),
    }));

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":    cmp = a.name.localeCompare(b.name); break;
        case "count":   cmp = a.processes.length - b.processes.length; break;
        case "cpu_percent": cmp = a.totalCpu - b.totalCpu; break;
        case "memory_mb":   cmp = a.totalMemory - b.totalMemory; break;
        default:        cmp = b.totalMemory - a.totalMemory; break; // 기본: 메모리 내림차순
      }
      return sortKey === null ? cmp : sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [processes, search, sortKey, sortDir]);

  const totalProcs = groups.reduce((s, g) => s + g.processes.length, 0);

  // 선택된 프로세스는 모든 그룹에서 검색
  const selected = selectedPid != null
    ? groups.flatMap((g) => g.processes).find((p) => p.pid === selectedPid) ?? null
    : null;

  const hdr = "px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 select-none";

  return (
    <div className="flex flex-col h-full bg-[#1a1d2e] border-t border-[#2a2d3e] overflow-hidden">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2d3e] flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Processes</h2>
          <span className="text-xs text-gray-600">
            {groups.length}그룹 · {totalProcs}개
          </span>
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#151827] sticky top-0 z-10">
            <tr>
              <th className={hdr} onClick={() => handleSort("name")}>Name{sortIcon("name")}</th>
              <th className={`${hdr} text-right`} onClick={() => handleSort("count")}>#프로세스{sortIcon("count")}</th>
              <th className={`${hdr} text-right`} onClick={() => handleSort("cpu_percent")}>CPU%{sortIcon("cpu_percent")}</th>
              <th className={`${hdr} text-right`} onClick={() => handleSort("memory_mb")}>Memory{sortIcon("memory_mb")}</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">No processes found</td></tr>
            )}
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.name);
              const isSingle = group.processes.length === 1;

              return [
                // ── 그룹 행 ──────────────────────────────────
                <tr
                  key={`g-${group.name}`}
                  onClick={() => isSingle
                    ? (setSelectedPid(group.processes[0].pid === selectedPid ? null : group.processes[0].pid), setConfirmKill(false), setSignalError(null))
                    : toggleGroup(group.name)
                  }
                  className={`cursor-pointer transition-colors border-b border-[#2a2d3e] ${
                    isSingle && group.processes[0].pid === selectedPid
                      ? "bg-indigo-500/10"
                      : "hover:bg-[#1e2235]"
                  }`}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {/* 펼치기 화살표 (복수일 때만) */}
                      {!isSingle && (
                        <svg
                          className={`w-3 h-3 flex-shrink-0 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                      {isSingle && <span className="w-3 flex-shrink-0" />}
                      <span className="text-gray-200 font-medium text-xs truncate max-w-[200px]">{group.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-gray-500">
                    {isSingle ? (
                      <span className="text-gray-600">{group.processes[0].pid}</span>
                    ) : (
                      <span className="bg-[#2a2d3e] text-gray-400 px-1.5 py-0.5 rounded text-[10px]">
                        {group.processes.length}개
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={cpuColor(group.totalCpu)}>{group.totalCpu.toFixed(1)}%</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={group.totalMemory > 500 ? "text-orange-400" : group.totalMemory > 100 ? "text-yellow-400" : "text-gray-300"}>
                      {formatMemory(group.totalMemory)}
                    </span>
                  </td>
                </tr>,

                // ── 펼쳐진 개별 프로세스 행 ──────────────────
                ...(isExpanded && !isSingle ? group.processes.map((proc) => {
                  const isSelected = proc.pid === selectedPid;
                  return (
                    <tr
                      key={`p-${proc.pid}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPid(isSelected ? null : proc.pid);
                        setConfirmKill(false);
                        setSignalError(null);
                      }}
                      className={`cursor-pointer transition-colors border-b border-[#1a1d2e] ${
                        isSelected ? "bg-indigo-500/10" : "hover:bg-[#232640]"
                      }`}
                    >
                      <td className="pl-8 pr-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-600 tabular-nums w-12 text-right">{proc.pid}</span>
                          <span className={`text-[11px] truncate max-w-[160px] ${statusColor(proc.status)}`}>
                            {proc.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5" />
                      <td className="px-3 py-1.5 text-right tabular-nums text-[11px]">
                        <span className={cpuColor(proc.cpu_percent)}>{proc.cpu_percent.toFixed(1)}%</span>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[11px] text-gray-400">
                        {formatMemory(proc.memory_mb)}
                      </td>
                    </tr>
                  );
                }) : []),
              ];
            })}
          </tbody>
        </table>
      </div>

      {/* 상세 패널 */}
      {selected && (
        <div className="flex-shrink-0 border-t border-indigo-500/30 bg-[#131625]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2d3e]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white">{selected.name}</span>
              <span className="text-xs text-gray-500">PID {selected.pid}</span>
              {selected.user && (
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">{selected.user}</span>
              )}
            </div>
            <button onClick={() => setSelectedPid(null)}
              className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-white transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2a2d3e]">
            {selected.status.toLowerCase().includes("stop") ? (
              <button onClick={() => sendSignal(selected.pid, "cont")}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>재개
              </button>
            ) : (
              <button onClick={() => sendSignal(selected.pid, "stop")}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-gray-500/10 text-gray-300 hover:bg-gray-500/20 border border-gray-600 transition-colors">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>일시정지
              </button>
            )}
            <button onClick={() => sendSignal(selected.pid, "term")}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>종료 요청
            </button>
            {confirmKill ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-red-400">강제 종료할까요?</span>
                <button onClick={() => sendSignal(selected.pid, "kill")}
                  className="px-2 py-1 rounded text-[11px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors">확인</button>
                <button onClick={() => setConfirmKill(false)}
                  className="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white transition-colors">취소</button>
              </div>
            ) : (
              <button onClick={() => setConfirmKill(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>강제 종료
              </button>
            )}
            {signalError && <span className="text-[10px] text-red-400 ml-auto">{signalError}</span>}
          </div>

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
