import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState, useRef, useCallback } from "react";
import { CpuPanel } from "./components/CpuPanel";
import { MemoryPanel } from "./components/MemoryPanel";
import { DiskPanel } from "./components/DiskPanel";
import { ProcessTable } from "./components/ProcessTable";
import type { SystemMetrics, HistoryPoint } from "./types";

// 히스토리에 보관할 최대 데이터 포인트 수
const MAX_HISTORY = 30;

function App() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [cpuHistory, setCpuHistory] = useState<HistoryPoint[]>([]);
  const [memHistory, setMemHistory] = useState<HistoryPoint[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 메트릭 폴링
  const fetchMetrics = useCallback(async () => {
    try {
      const data = await invoke<SystemMetrics>("get_metrics");
      setMetrics(data);
      setError(null);

      const now = Date.now();

      // CPU 히스토리 갱신
      setCpuHistory((prev) => {
        const next = [...prev, { time: now, value: data.cpu.overall }];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      });

      // 메모리 히스토리 갱신
      setMemHistory((prev) => {
        const next = [...prev, { time: now, value: data.memory.percent }];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      });
    } catch (e) {
      setError(String(e));
    }
  }, []);

  // 폴링 시작/중지
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

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-4 select-none">
      {/* 상단 헤더 */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* 로고 아이콘 */}
          <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
            <svg
              className="w-5 h-5 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">
              System Monitor
            </h1>
            {metrics && (
              <p className="text-xs text-gray-500">
                {metrics.hostname} - {metrics.os_version}
              </p>
            )}
          </div>
        </div>

        {/* Live 토글 */}
        <button
          onClick={() => setIsLive((v) => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isLive
              ? "bg-green-500/10 text-green-400 border border-green-500/30"
              : "bg-gray-700/50 text-gray-400 border border-gray-600"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isLive ? "bg-green-400 animate-pulse" : "bg-gray-500"
            }`}
          />
          {isLive ? "Live" : "Paused"}
        </button>
      </header>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 로딩 상태 */}
      {!metrics && !error && (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 text-sm">
            Loading system metrics...
          </div>
        </div>
      )}

      {/* 메트릭 대시보드 */}
      {metrics && (
        <>
          {/* 상단 카드 3개: CPU, Memory, Disk */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <CpuPanel cpu={metrics.cpu} history={cpuHistory} />
            <MemoryPanel memory={metrics.memory} history={memHistory} />
            <DiskPanel disks={metrics.disks} />
          </div>

          {/* 하단: 프로세스 테이블 */}
          <ProcessTable processes={metrics.processes} />
        </>
      )}
    </div>
  );
}

export default App;
