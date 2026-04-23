use rayon::prelude::*;
use serde::Serialize;
use std::sync::Mutex;
use sysinfo::{Disks, System, Users};
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
    pub exe_path: String,
    pub cmd: String,
    pub user: String,
    pub parent_pid: Option<u32>,
    pub start_time: u64,
    pub run_time: u64,
}

// 디렉토리 엔트리 정보
#[derive(Serialize, Clone)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: u64,       // 파일: 실제 크기, 디렉토리: 0
    pub child_count: Option<u32>, // 디렉토리만: 직접 자식 수 (읽기 실패 시 None)
    pub is_hidden: bool,
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

pub struct AppState(pub Mutex<System>, pub Mutex<Users>);

#[tauri::command]
fn get_metrics(state: State<AppState>) -> SystemMetrics {
    let mut sys = state.0.lock().unwrap();
    let users = state.1.lock().unwrap();
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

    // 프로세스 (상위 100개)
    let mut processes: Vec<ProcessInfo> = sys
        .processes()
        .iter()
        .map(|(pid, p)| {
            let user = p
                .user_id()
                .and_then(|uid| users.iter().find(|u| u.id() == uid))
                .map(|u| u.name().to_string())
                .unwrap_or_default();

            let exe_path = p
                .exe()
                .map(|e| e.to_string_lossy().to_string())
                .unwrap_or_default();

            let cmd = p
                .cmd()
                .iter()
                .map(|s| s.to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join(" ");

            ProcessInfo {
                pid: pid.as_u32(),
                name: p.name().to_string_lossy().to_string(),
                cpu_percent: p.cpu_usage(),
                memory_mb: p.memory() as f64 / 1024.0 / 1024.0,
                status: format!("{:?}", p.status()),
                exe_path,
                cmd,
                user,
                parent_pid: p.parent().map(|p| p.as_u32()),
                start_time: p.start_time(),
                run_time: p.run_time(),
            }
        })
        .collect();
    processes.sort_by(|a, b| b.cpu_percent.partial_cmp(&a.cpu_percent).unwrap_or(std::cmp::Ordering::Equal));
    processes.truncate(100);

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

// 디렉토리 재귀 크기 계산 (심링크 제외)
fn dir_size(path: &std::path::Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(path) else {
        return 0;
    };
    entries
        .flatten()
        .map(|e| {
            let Ok(ft) = e.file_type() else { return 0 };
            if ft.is_symlink() {
                return 0;
            }
            if ft.is_dir() {
                dir_size(&e.path())
            } else {
                e.metadata().map(|m| m.len()).unwrap_or(0)
            }
        })
        .sum()
}

#[tauri::command]
fn read_dir_entries(path: String) -> Result<Vec<DirEntry>, String> {
    // 먼저 목록을 수집한 뒤 Rayon으로 병렬 크기 계산
    let raw: Vec<_> = std::fs::read_dir(&path)
        .map_err(|e| e.to_string())?
        .flatten()
        .collect();

    let mut result: Vec<DirEntry> = raw
        .par_iter()
        .map(|entry| {
            let ft = entry.file_type().ok();
            let is_dir = ft.as_ref().map(|f| f.is_dir()).unwrap_or(false);
            let is_symlink = ft.as_ref().map(|f| f.is_symlink()).unwrap_or(false);

            let size_bytes = if is_symlink {
                0
            } else if is_dir {
                dir_size(&entry.path())
            } else {
                entry.metadata().map(|m| m.len()).unwrap_or(0)
            };

            let child_count = if is_dir {
                std::fs::read_dir(entry.path()).ok().map(|d| d.count() as u32)
            } else {
                None
            };

            let name = entry.file_name().to_string_lossy().to_string();
            let is_hidden = name.starts_with('.');
            DirEntry {
                name,
                path: entry.path().to_string_lossy().to_string(),
                is_dir,
                size_bytes,
                child_count,
                is_hidden,
            }
        })
        .collect();

    // 디렉토리·파일 모두 크기 내림차순 (디렉토리 먼저)
    result.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => b.size_bytes.cmp(&a.size_bytes),
    });
    Ok(result)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState(
            Mutex::new(System::new_all()),
            Mutex::new(Users::new_with_refreshed_list()),
        ))
        .invoke_handler(tauri::generate_handler![get_metrics, read_dir_entries])
        .run(tauri::generate_context!())
        .expect("Tauri 앱 실행 중 오류 발생");
}
