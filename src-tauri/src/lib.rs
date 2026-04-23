use serde::Serialize;
use std::sync::Mutex;
use sysinfo::{Disks, System};
use tauri::State;

// CPU 메트릭
#[derive(Serialize, Clone)]
pub struct CpuMetrics {
    pub overall: f32,
    pub cores: Vec<f32>,
    pub core_count: usize,
}

// 메모리 메트릭
#[derive(Serialize, Clone)]
pub struct MemoryMetrics {
    pub used_gb: f64,
    pub total_gb: f64,
    pub percent: f32,
}

// 디스크 메트릭
#[derive(Serialize, Clone)]
pub struct DiskMetrics {
    pub name: String,
    pub mount: String,
    pub used_gb: f64,
    pub total_gb: f64,
    pub percent: f32,
}

// 프로세스 정보
#[derive(Serialize, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_percent: f32,
    pub memory_mb: f64,
    pub status: String,
}

// 전체 시스템 메트릭
#[derive(Serialize, Clone)]
pub struct SystemMetrics {
    pub cpu: CpuMetrics,
    pub memory: MemoryMetrics,
    pub disks: Vec<DiskMetrics>,
    pub processes: Vec<ProcessInfo>,
    pub hostname: String,
    pub os_version: String,
}

pub struct AppState(pub Mutex<System>);

#[tauri::command]
fn get_metrics(state: State<AppState>) -> SystemMetrics {
    let mut sys = state.0.lock().unwrap();
    sys.refresh_all();

    // CPU
    let overall = sys.global_cpu_usage();
    let cores: Vec<f32> = sys.cpus().iter().map(|c| c.cpu_usage()).collect();
    let core_count = cores.len();
    let cpu = CpuMetrics {
        overall,
        cores,
        core_count,
    };

    // 메모리
    let used = sys.used_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let total = sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let percent = if total > 0.0 {
        (used / total * 100.0) as f32
    } else {
        0.0
    };
    let memory = MemoryMetrics {
        used_gb: used,
        total_gb: total,
        percent,
    };

    // 디스크
    let disks_info = Disks::new_with_refreshed_list();
    let disks = disks_info
        .iter()
        .map(|d| {
            let total_gb = d.total_space() as f64 / 1024.0 / 1024.0 / 1024.0;
            let used_gb =
                (d.total_space() - d.available_space()) as f64 / 1024.0 / 1024.0 / 1024.0;
            let percent = if total_gb > 0.0 {
                (used_gb / total_gb * 100.0) as f32
            } else {
                0.0
            };
            DiskMetrics {
                name: d.name().to_string_lossy().to_string(),
                mount: d.mount_point().to_string_lossy().to_string(),
                used_gb,
                total_gb,
                percent,
            }
        })
        .collect();

    // 프로세스 (CPU 사용량 상위 50개)
    let mut processes: Vec<ProcessInfo> = sys
        .processes()
        .iter()
        .map(|(pid, p)| ProcessInfo {
            pid: pid.as_u32(),
            name: p.name().to_string_lossy().to_string(),
            cpu_percent: p.cpu_usage(),
            memory_mb: p.memory() as f64 / 1024.0 / 1024.0,
            status: format!("{:?}", p.status()),
        })
        .collect();
    processes.sort_by(|a, b| b.cpu_percent.partial_cmp(&a.cpu_percent).unwrap_or(std::cmp::Ordering::Equal));
    processes.truncate(50);

    // OS 정보
    let hostname = System::host_name().unwrap_or_default();
    let os_version = System::long_os_version().unwrap_or_default();

    SystemMetrics {
        cpu,
        memory,
        disks,
        processes,
        hostname,
        os_version,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState(Mutex::new(System::new_all())))
        .invoke_handler(tauri::generate_handler![get_metrics])
        .run(tauri::generate_context!())
        .expect("Tauri 앱 실행 중 오류 발생");
}
