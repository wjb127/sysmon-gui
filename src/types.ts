// Rust 백엔드에서 반환하는 메트릭 타입 정의

export interface CpuMetrics {
  overall: number;
  cores: number[];
  core_count: number;
}

export interface MemoryMetrics {
  used_gb: number;
  total_gb: number;
  percent: number;
}

export interface DiskMetrics {
  name: string;
  mount: string;
  used_gb: number;
  total_gb: number;
  percent: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_mb: number;
  status: string;
}

export interface SystemMetrics {
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disks: DiskMetrics[];
  processes: ProcessInfo[];
  hostname: string;
  os_version: string;
}

// 스파크라인 차트용 히스토리 데이터 포인트
export interface HistoryPoint {
  time: number;
  value: number;
}

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size_bytes: number;
  child_count: number | null;
  is_hidden: boolean;
}
