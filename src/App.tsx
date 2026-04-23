import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState, useRef, useCallback } from "react";
import { CpuPanel } from "./components/CpuPanel";
import { MemoryPanel } from "./components/MemoryPanel";
import { DiskPanel } from "./components/DiskPanel";
import { ProcessTable } from "./components/ProcessTable";
import type { SystemMetrics, HistoryPoint } from "./types";

const MAX_HISTORY = 60;

type TabId = "cpu" | "memory" | "disk";

function usageColor(pct: number) {
  if (pct < 60) return "text-green-400";
  if (pct < 80) return "text-yellow-400";
  return "text-red-400";
}

function App() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [cpuHistory, setCpuHistory] = useState<HistoryPoint[]>([]);
  const [memHistory, setMemHistory] = useState<HistoryPoint[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("cpu");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await invoke<SystemMetrics>("get_metrics");
      setMetrics(data);
      setError(null);
      const now = Date.now();
      setCpuHistory((prev) => {
        const next = [...prev, { time: now, value: data.cpu.overall }];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      });
      setMemHistory((prev) => {
        const next = [...prev, { time: now, value: data.memory.percent }];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      });
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    if (isLive) {
      fetchMetrics();
      intervalRef.current = setInterval(fetchMetrics, 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isLive, fetchMetrics]);

  const tabs: { id: TabId; label: string; summary: string; color: string }[] = metrics
    ? [
        {
          id: "cpu",
          label: "CPU",
          summary: `${metrics.cpu.overall.toFixed(1)}%`,
          color: usageColor(metrics.cpu.overall),
        },
        {
          id: "memory",
          label: "Memory",
          summary: `${metrics.memory.used_gb.toFixed(1)} / ${metrics.memory.total_gb.toFixed(0)} GB`,
          color: usageColor(metrics.memory.percent),
        },
        {
          id: "disk",
          label: "Disk",
          summary: metrics.disks[0]
            ? `${metrics.disks[0].percent.toFixed(0)}%`
            : "—",
          color: metrics.disks[0] ? usageColor(metrics.disks[0].percent) : "text-gray-400",
        },
      ]
    : [];

  return (
    <div className="h-screen flex flex-col bg-[#0f1117] text-white overflow-hidden">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#2a2d3e] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-indigo-500/20 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-tight">System Monitor</h1>
            {metrics && (
              <p className="text-[10px] text-gray-500 leading-tight">{metrics.hostname} · {metrics.os_version}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => setIsLive((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            isLive
              ? "bg-green-500/10 text-green-400 border border-green-500/30"
              : "bg-gray-700/50 text-gray-400 border border-gray-600"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
          {isLive ? "Live" : "Paused"}
        </button>
      </header>

      {error && (
        <div className="mx-4 mt-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400 flex-shrink-0">
          {error}
        </div>
      )}

      {!metrics && !error && (
        <div className="flex items-center justify-center flex-1">
          <p className="text-gray-500 text-sm">Loading system metrics...</p>
        </div>
      )}

      {metrics && (
        <>
          {/* 탭 바 */}
          <div className="flex border-b border-[#2a2d3e] flex-shrink-0">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex flex-col items-center py-2.5 px-3 text-xs font-medium transition-colors relative ${
                    active
                      ? "text-white bg-[#1a1d2e]"
                      : "text-gray-500 hover:text-gray-300 hover:bg-[#1a1d2e]/50"
                  }`}
                >
                  {active && (
                    <span className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-b" />
                  )}
                  <span className="text-[11px] uppercase tracking-wider mb-0.5">{tab.label}</span>
                  <span className={`text-sm font-bold tabular-nums ${active ? tab.color : "text-gray-500"}`}>
                    {tab.summary}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 탭 상세 패널 */}
          <div className="flex-shrink-0 border-b border-[#2a2d3e]">
            {activeTab === "cpu" && (
              <CpuPanel cpu={metrics.cpu} history={cpuHistory} />
            )}
            {activeTab === "memory" && (
              <MemoryPanel memory={metrics.memory} history={memHistory} />
            )}
            {activeTab === "disk" && (
              <DiskPanel disks={metrics.disks} />
            )}
          </div>

          {/* 프로세스 테이블 — 남은 공간 전부 사용 */}
          <div className="flex-1 overflow-hidden">
            <ProcessTable processes={metrics.processes} />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
