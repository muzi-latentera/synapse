use std::fs;
use std::io::{BufRead, BufReader};
use std::os::unix::process::CommandExt;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use libc;
use rand::Rng;
use std::net::TcpListener;
use tauri::Manager;

fn app_data_dir() -> std::path::PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("com.claudex.app")
}

fn ensure_secret_key() -> String {
    let data_dir = app_data_dir();
    fs::create_dir_all(&data_dir).ok();
    let key_path = data_dir.join(".secret_key");
    if let Ok(key) = fs::read_to_string(&key_path) {
        let key = key.trim().to_string();
        if key.len() >= 32 {
            return key;
        }
    }
    let mut rng = rand::rng();
    let key: String = (0..64)
        .map(|_| {
            let idx = rng.random_range(0..36);
            if idx < 10 {
                (b'0' + idx) as char
            } else {
                (b'a' + idx - 10) as char
            }
        })
        .collect();
    fs::write(&key_path, &key).ok();
    key
}

fn launcher_name() -> &'static str {
    "claudex-backend"
}

fn resolve_backend_binary(app_handle: &tauri::AppHandle) -> std::path::PathBuf {
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .expect("failed to resolve resource dir");

    let name = launcher_name();

    let binary = resource_dir
        .join("_up_")
        .join("backend-sidecar")
        .join(name);
    if binary.exists() {
        return binary;
    }

    let direct = resource_dir.join("backend-sidecar").join(name);
    if direct.exists() {
        return direct;
    }

    let dev_binary = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("backend-sidecar")
        .join(name);
    if dev_binary.exists() {
        return dev_binary;
    }

    panic!(
        "Backend binary not found at {:?} or {:?}",
        binary, dev_binary
    );
}

const BACKEND_PORT: u16 = 8081;

fn show_error_and_exit(message: &str) -> ! {
    eprintln!("{}", message);
    let _ = Command::new("osascript")
        .arg("-e")
        .arg(format!(
            "display dialog \"{}\" with title \"Claudex\" buttons {{\"OK\"}} default button \"OK\" with icon stop",
            message
        ))
        .output();
    std::process::exit(1);
}

fn check_port_available() {
    if TcpListener::bind(("127.0.0.1", BACKEND_PORT)).is_err() {
        show_error_and_exit(&format!(
            "Port {} is already in use. Another Claudex instance may be running.",
            BACKEND_PORT
        ));
    }
}

fn terminate_backend_process(backend: &Arc<Mutex<Option<Child>>>) {
    if let Ok(mut guard) = backend.lock() {
        if let Some(ref mut child) = *guard {
            let pid = child.id() as libc::pid_t;

            unsafe {
                libc::kill(-pid, libc::SIGTERM);
            }

            let deadline = std::time::Instant::now() + Duration::from_secs(5);
            loop {
                match child.try_wait() {
                    Ok(Some(_)) => break,
                    Ok(None) if std::time::Instant::now() < deadline => {
                        std::thread::sleep(Duration::from_millis(100));
                    }
                    _ => {
                        unsafe {
                            libc::kill(-pid, libc::SIGKILL);
                        }
                        let _ = child.kill();
                        let _ = child.wait();
                        break;
                    }
                }
            }
        }
        *guard = None;
    }
}

fn main() {
    let secret_key = ensure_secret_key();
    let data_dir = app_data_dir();
    check_port_available();
    let backend_process: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
    let backend_for_exit = backend_process.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let backend_bin = resolve_backend_binary(&app_handle);

            let db_path = data_dir
                .join("claudex.db")
                .to_string_lossy()
                .replace('\\', "/");

            let mut command = Command::new(&backend_bin);
            command
                .env("DESKTOP_MODE", "true")
                .env("SECRET_KEY", &secret_key)
                .env("BASE_URL", format!("http://127.0.0.1:{BACKEND_PORT}"))
                .env("DATABASE_URL", format!("sqlite+aiosqlite:///{db_path}"))
                .env(
                    "STORAGE_PATH",
                    data_dir.join("storage").to_string_lossy().to_string(),
                )
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());
            unsafe {
                command.pre_exec(|| {
                    if libc::setpgid(0, 0) != 0 {
                        return Err(std::io::Error::last_os_error());
                    }
                    Ok(())
                });
            }
            let mut child = command
                .spawn()
                .expect("failed to spawn backend process");

            if let Some(stdout) = child.stdout.take() {
                std::thread::spawn(move || {
                    let reader = BufReader::new(stdout);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            println!("[backend] {}", line);
                        }
                    }
                });
            }

            if let Some(stderr) = child.stderr.take() {
                std::thread::spawn(move || {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            eprintln!("[backend] {}", line);
                        }
                    }
                });
            }

            *backend_process.lock().unwrap() = Some(child);

            let readyz_url = format!("http://127.0.0.1:{BACKEND_PORT}/api/v1/readyz");
            tauri::async_runtime::spawn(async move {
                let client = reqwest::Client::new();
                for _ in 0..60 {
                    tokio::time::sleep(Duration::from_millis(500)).await;
                    if let Ok(resp) = client.get(&readyz_url).send().await {
                        if resp.status().is_success() {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                            }
                            return;
                        }
                    }
                }
                eprintln!("[backend] readyz timeout — showing window anyway");
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(move |_app, event| {
            if matches!(
                event,
                tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
            ) {
                terminate_backend_process(&backend_for_exit);
            }
        });
}
