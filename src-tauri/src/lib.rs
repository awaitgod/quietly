pub mod commands;
pub mod db;
pub mod tray;

use db::Database;
use std::fs;
use tauri::Manager;

#[cfg(target_os = "windows")]
use window_vibrancy::apply_mica;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 1. Initialize SQLite Database path
            let app_data = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::current_dir().unwrap());
            fs::create_dir_all(&app_data).ok();
            let db_path = app_data.join("quietly_local.db");

            let database = Database::new(db_path)
                .map_err(|e| Box::<dyn std::error::Error>::from(e.to_string()))?;
            app.manage(database);

            // 2. Setup System Tray
            tray::create_tray(app.handle())?;

            // 3. Setup Window Vibrancy (Mica on Windows 11)
            #[cfg(target_os = "windows")]
            if let Some(window) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon() {
                    window.set_icon(icon.clone())?;
                }
                let _ = apply_mica(&window, None);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::chat::save_local_message,
            commands::chat::get_local_messages,
            commands::chat::clear_local_chat,
            commands::chat::delete_local_message,
            commands::search::search_local_messages,
            commands::auth::save_session_token,
            commands::auth::get_session_token,
            commands::auth::clear_session_token,
            commands::auth::save_secure_pref,
            commands::auth::get_secure_pref,
        ])
        .run(tauri::generate_context!())
        .expect("error while building quietly tauri application");
}
