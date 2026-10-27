//! Signed updates for Windows NSIS, macOS app bundles, and Linux AppImages.
use serde_json::{json, Value};
use std::path::Path;

use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

#[derive(Default)]
pub struct PendingUpdate {
    ready: tauri::async_runtime::Mutex<Option<(tauri_plugin_updater::Update, Vec<u8>)>>,
}

fn supports_updates(
    platform: &str,
    development: bool,
    exe: Option<&Path>,
    appimage: Option<&Path>,
) -> bool {
    if development {
        return false;
    }
    match platform {
        "windows" => exe
            .and_then(Path::parent)
            .is_some_and(|dir| dir.join("syncforge-installed").is_file()),
        "macos" => exe
            .and_then(Path::parent)
            .filter(|dir| dir.file_name().is_some_and(|name| name == "MacOS"))
            .and_then(Path::parent)
            .filter(|dir| dir.file_name().is_some_and(|name| name == "Contents"))
            .and_then(Path::parent)
            .is_some_and(|dir| dir.extension().is_some_and(|ext| ext == "app")),
        "linux" => appimage.is_some_and(Path::is_file),
        _ => false,
    }
}

fn update_supported(app: &tauri::AppHandle) -> bool {
    let exe = std::env::current_exe().ok();
    #[cfg(target_os = "linux")]
    let appimage = app.env().appimage.map(std::path::PathBuf::from);
    #[cfg(not(target_os = "linux"))]
    let appimage: Option<std::path::PathBuf> = {
        let _ = app;
        None
    };
    supports_updates(
        std::env::consts::OS,
        cfg!(debug_assertions),
        exe.as_deref(),
        appimage.as_deref(),
    )
}

struct InstallReservation(crate::ui::backend::Api);

impl InstallReservation {
    fn acquire(api: crate::ui::backend::Api) -> Result<Self, String> {
        {
            let mut busy = api.inner.run_lock.lock().map_err(|e| e.to_string())?;
            if *busy {
                return Err("Wait for the current media task to finish before restarting.".into());
            }
            *busy = true;
        }
        Ok(Self(api))
    }
}

impl Drop for InstallReservation {
    fn drop(&mut self) {
        if let Ok(mut busy) = self.0.inner.run_lock.lock() {
            *busy = false;
        }
    }
}

#[tauri::command]
pub fn updater_info(app: tauri::AppHandle) -> Value {
    json!({
        "supported": update_supported(&app),
        "version": env!("CARGO_PKG_VERSION"),
        "platform": std::env::consts::OS,
    })
}

#[tauri::command]
pub async fn download_update(
    app: tauri::AppHandle,
    pending: tauri::State<'_, PendingUpdate>,
    on_progress: tauri::ipc::Channel<Value>,
) -> Result<Value, String> {
    if !update_supported(&app) {
        return Err("Automatic updates require a release build of the Windows installer, macOS app bundle, or Linux AppImage.".into());
    }
    {
        let mut ready = pending
            .ready
            .try_lock()
            .map_err(|_| "An update operation is already running.")?;
        if let Some((update, _)) = ready.as_ref() {
            return Ok(json!({ "version": update.version, "notes": update.body }));
        }
        let update = app
            .updater_builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|e| e.to_string())?
            .check()
            .await
            .map_err(|e| e.to_string())?;
        let Some(update) = update else {
            return Ok(Value::Null);
        };
        // Keep all network URLs on HTTPS, including the artifact URL from the release manifest.
        if update.download_url.scheme() != "https" {
            return Err("The update download URL must use HTTPS.".into());
        }
        let mut downloaded = 0_u64;
        let bytes = update
            .download(
                |chunk, total| {
                    downloaded += chunk as u64;
                    let _ = on_progress.send(json!({ "downloaded": downloaded, "total": total }));
                },
                || {},
            )
            .await
            .map_err(|e| e.to_string())?;
        // download() verifies the signature before an update can become ready.
        let result = json!({ "version": update.version, "notes": update.body });
        *ready = Some((update, bytes));
        Ok(result)
    }
}

#[tauri::command]
pub async fn install_update(
    app: tauri::AppHandle,
    api: tauri::State<'_, crate::ui::backend::Api>,
) -> Result<(), String> {
    if !update_supported(&app) {
        return Err("Automatic updates require a release build of the Windows installer, macOS app bundle, or Linux AppImage.".into());
    }
    {
        let app_handle = app.clone();
        let api = api.inner().clone();
        // Installation can extract files and starts a process: keep it off the UI/runtime thread.
        tauri::async_runtime::spawn_blocking(move || {
            let pending = app_handle.state::<PendingUpdate>();
            let ready = pending
                .ready
                .try_lock()
                .map_err(|_| "An update operation is already running.")?;
            let (update, bytes) = ready
                .as_ref()
                .ok_or("Download an update before installing it.")?;
            // Share the media task admission lock to prevent races with a new task starting.
            let _reservation = InstallReservation::acquire(api)?;
            // Windows exits through NSIS. macOS/Linux replace the bundle and need an explicit restart.
            update.install(bytes).map_err(|e| e.to_string())?;
            #[cfg(not(windows))]
            app_handle.restart();
            #[cfg(windows)]
            Ok(())
        })
        .await
        .map_err(|e| e.to_string())?
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ui::backend::Api;

    #[test]
    fn only_release_packages_enable_updates() {
        let dir = tempfile::tempdir().unwrap();
        let exe = dir.path().join("SyncForge.exe");
        assert!(!supports_updates("windows", false, Some(&exe), None));
        std::fs::write(dir.path().join("syncforge-installed"), "installed").unwrap();
        assert!(supports_updates("windows", false, Some(&exe), None));
        assert!(!supports_updates("windows", true, Some(&exe), None));
        let mac = dir.path().join("SyncForge.app/Contents/MacOS/SyncForge");
        assert!(supports_updates("macos", false, Some(&mac), None));
        assert!(!supports_updates("macos", true, Some(&mac), None));
        assert!(!supports_updates("macos", false, Some(&exe), None));
        assert!(!supports_updates("linux", false, Some(&exe), None));
        let appimage = dir.path().join("SyncForge.AppImage");
        assert!(!supports_updates(
            "linux",
            false,
            Some(&exe),
            Some(&appimage)
        ));
        std::fs::write(&appimage, "appimage").unwrap();
        assert!(supports_updates(
            "linux",
            false,
            Some(&exe),
            Some(&appimage)
        ));
        assert!(!supports_updates(
            "linux",
            true,
            Some(&exe),
            Some(&appimage)
        ));
    }

    #[test]
    fn installation_rejects_active_tasks_without_releasing_their_lock() {
        let api = Api::new();
        *api.inner.run_lock.lock().unwrap() = true;
        assert!(InstallReservation::acquire(api.clone()).is_err());
        assert!(*api.inner.run_lock.lock().unwrap());
    }

    #[test]
    fn installation_blocks_new_tasks_and_releases_lock_on_failure() {
        let api = Api::new();
        let reservation = InstallReservation::acquire(api.clone()).unwrap();
        let result = api.run_module("stream_manager", &json!({}), None, false);
        assert_eq!(result.status, "busy");
        assert!(InstallReservation::acquire(api.clone()).is_err());
        drop(reservation);
        assert!(!*api.inner.run_lock.lock().unwrap());
        assert!(InstallReservation::acquire(api).is_ok());
    }
}
