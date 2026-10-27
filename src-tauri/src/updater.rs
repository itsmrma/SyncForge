//! Windows installer updates. The standalone CLI and other platforms keep their existing lifecycle.
use serde_json::{json, Value};

#[cfg(windows)]
use tauri_plugin_updater::UpdaterExt;

#[derive(Default)]
pub struct PendingUpdate {
    #[cfg(windows)]
    ready: tauri::async_runtime::Mutex<Option<(tauri_plugin_updater::Update, Vec<u8>)>>,
}

fn installer_supported() -> bool {
    cfg!(windows)
        && !cfg!(debug_assertions)
        && std::env::current_exe()
            .ok()
            .and_then(|exe| {
                exe.parent()
                    .map(|dir| dir.join("syncforge-installed").is_file())
            })
            .unwrap_or(false)
}

#[cfg(any(windows, test))]
struct InstallReservation(crate::ui::backend::Api);

#[cfg(any(windows, test))]
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

#[cfg(any(windows, test))]
impl Drop for InstallReservation {
    fn drop(&mut self) {
        if let Ok(mut busy) = self.0.inner.run_lock.lock() {
            *busy = false;
        }
    }
}

#[tauri::command]
pub fn updater_info() -> Value {
    json!({
        "supported": installer_supported(),
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
    if !installer_supported() {
        return Err("Automatic updates require the Windows installer edition.".into());
    }
    #[cfg(windows)]
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
    #[cfg(not(windows))]
    {
        let _ = (app, pending, on_progress);
        Err("Automatic updates are currently available only on Windows.".into())
    }
}

#[tauri::command]
pub async fn install_update(
    app: tauri::AppHandle,
    api: tauri::State<'_, crate::ui::backend::Api>,
) -> Result<(), String> {
    if !installer_supported() {
        return Err("Automatic updates require the Windows installer edition.".into());
    }
    #[cfg(windows)]
    {
        use tauri::Manager;
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
            // On Windows the plugin exits this process and the NSIS installer relaunches it.
            update.install(bytes).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    {
        let _ = (app, api);
        Err("Automatic updates are currently available only on Windows.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ui::backend::Api;

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
