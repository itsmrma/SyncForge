use std::process::Command;
use std::sync::{Arc, RwLock};
use std::thread;

use crate::core::processes::external_tool_environment;
use crate::core::utils::log_line;

pub type NotifyHook = Arc<dyn Fn(&str, &str) -> Result<(), String> + Send + Sync>;

static NOTIFY_HOOK: RwLock<Option<NotifyHook>> = RwLock::new(None);

pub fn set_notify_hook(hook: Option<NotifyHook>) {
    *NOTIFY_HOOK.write().unwrap() = hook;
}

pub fn build_macos_notification_command(title: &str, message: &str) -> Vec<String> {
    let script = "on run argv\ndisplay notification (item 2 of argv) with title (item 1 of argv)\nend run";
    vec![
        "/usr/bin/osascript".to_string(),
        "-e".to_string(),
        script.to_string(),
        title.to_string(),
        message.to_string(),
    ]
}

pub fn build_linux_notify_send_command(title: &str, message: &str) -> Vec<String> {
    vec![
        "notify-send".to_string(),
        "--app-name=SyncForge".to_string(),
        title.to_string(),
        message.to_string(),
    ]
}

pub fn send_notification(title: &str, message: &str) -> Result<(), String> {
    if let Some(hook) = NOTIFY_HOOK.read().unwrap().clone() {
        return hook(title, message);
    }

    if cfg!(target_os = "macos") {
        let args = build_macos_notification_command(title, message);
        let status = Command::new(&args[0])
            .args(&args[1..])
            .output()
            .map_err(|e| e.to_string())?;
        if !status.status.success() {
            return Err("osascript notification failed".to_string());
        }
        return Ok(());
    }

    if cfg!(target_os = "linux") {
        let args = build_linux_notify_send_command(title, message);
        let status = Command::new(&args[0])
            .args(&args[1..])
            .envs(external_tool_environment())
            .output()
            .map_err(|e| e.to_string())?;
        if !status.status.success() {
            return Err("notify-send failed".to_string());
        }
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        let ps_script = format!(
            "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; \
             $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); \
             $textNodes = $template.GetElementsByTagName('text'); \
             $textNodes.Item(0).AppendChild($template.CreateTextNode($env:SYNCFORGE_NOTIFY_TITLE)) > $null; \
             $textNodes.Item(1).AppendChild($template.CreateTextNode($env:SYNCFORGE_NOTIFY_MSG)) > $null; \
             $toast = [Windows.UI.Notifications.ToastNotification]::new($template); \
             [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('SyncForge').Show($toast);"
        );
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &ps_script])
            .env("SYNCFORGE_NOTIFY_TITLE", title)
            .env("SYNCFORGE_NOTIFY_MSG", message)
            .output();
    }

    Ok(())
}

pub fn notify_task_finished(module_label: &str, status: &str) {
    let title = match status {
        "ok" => "SyncForge — Task completed",
        "warning" => "SyncForge — Task completed with warnings",
        "error" => "SyncForge — Task failed",
        _ => return,
    };
    let message = format!("{}. Check SyncForge for details.", module_label);
    let title_owned = title.to_string();

    thread::Builder::new()
        .name("syncforge-notification".to_string())
        .spawn(move || {
            if let Err(exc) = send_notification(&title_owned, &message) {
                log_line(&format!(
                    "[Notification] Could not send desktop notification: {}",
                    exc
                ));
            }
        })
        .ok();
}
