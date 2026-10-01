"""Desktop notifications without depending on a browser's Notification API."""
import platform
import shutil
import subprocess
import threading

from syncforge.core.process_env import external_tool_environment


def send_notification(title, message):
    system = platform.system()
    if system == "Darwin":
        # Use the system interpreter on both Intel and Apple Silicon. Pass text
        # as arguments so it cannot be interpreted as AppleScript or shell code.
        script = ('on run argv\n'
                  'display notification (item 2 of argv) with title (item 1 of argv)\n'
                  'end run')
        subprocess.run(
            ["/usr/bin/osascript", "-e", script, title, message],
            check=True, capture_output=True, timeout=15,
        )
    elif system == 'Linux' and shutil.which('notify-send'):
        subprocess.run(['notify-send', '--app-name=SyncForge', title, message],
                       check=True, capture_output=True, timeout=15,
                       env=external_tool_environment())
    else:
        if system == "Windows":
            import winreg
            # Register an identity for the portable app under the current user.
            with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, r"SOFTWARE\Classes\AppUserModelId\SyncForge") as key:
                winreg.SetValueEx(key, "DisplayName", 0, winreg.REG_SZ, "SyncForge")
        from notifypy import Notify

        notification = Notify(default_notification_application_name="SyncForge")
        notification.title = title
        notification.message = message
        # Call directly in our worker so notification failures can be caught.
        delivered = notification.send_notification(
            supplied_title=title,
            supplied_message=message,
            supplied_application_name="SyncForge",
            supplied_urgency="normal",
            supplied_icon_path=notification.icon,
            supplied_audio_path=None,
        )
        if not delivered:
            raise RuntimeError("The desktop notification service rejected the notification")


def notify_task_finished(module_label, status):
    titles = {
        "ok": "SyncForge — Task completed",
        "warning": "SyncForge — Task completed with warnings",
        "error": "SyncForge — Task failed",
    }
    if status not in titles:
        return

    def deliver():
        try:
            send_notification(titles[status], f"{module_label}. Check SyncForge for details.")
        except Exception as exc:
            print(f"[Notification] Could not send desktop notification: {exc}")

    threading.Thread(target=deliver, name="syncforge-notification", daemon=True).start()
