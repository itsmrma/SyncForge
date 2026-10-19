#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
extern "system" {
    fn AttachConsole(dw_process_id: u32) -> i32;
}

fn should_run_headless_cli(args: &[String]) -> bool {
    let Some(first) = args.first() else {
        return false;
    };
    // Ignore macOS LaunchServices process serial number flag
    if first.starts_with("-psn_") {
        return false;
    }
    matches!(
        first.as_str(),
        "run"
            | "script"
            | "inspect"
            | "delay"
            | "preview"
            | "tools"
            | "modules"
            | "config"
            | "help"
            | "-h"
            | "--help"
            | "version"
            | "-V"
            | "--version"
    ) || syncforge_lib::cli::normalize_module_id(first).is_some()
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if should_run_headless_cli(&args) {
        #[cfg(windows)]
        unsafe {
            // Attach to parent terminal console if launched from PowerShell/cmd
            let _ = AttachConsole(u32::MAX);
        }
        let code = syncforge_lib::cli::run_cli_args(&args);
        std::process::exit(code);
    }

    syncforge_lib::run();
}

