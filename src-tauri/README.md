# Tauri Backend

This directory contains the Rust backend for the Beak Design desktop application.

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (latest stable version)
- System dependencies for your platform:
  - **Linux**: `libwebkit2gtk-4.0-dev`, `build-essential`, `curl`, `wget`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Microsoft C++ Build Tools

## Development

Run the app in development mode:

```bash
pnpm tauri:dev
```

This will:
1. Start the Vite dev server on port 3000
2. Compile the Rust backend
3. Launch the desktop app

## Building

Build the production app:

```bash
pnpm tauri:build
```

The built application will be in `src-tauri/target/release/` (or `target/debug/` for debug builds).

## File System Commands

The Rust backend provides the following Tauri commands for file system access:

- `open_file_dialog` - Open a file picker dialog
- `save_file_dialog` - Open a save file dialog
- `open_directory_dialog` - Open a directory picker dialog
- `read_file` - Read file contents as text
- `write_file` - Write text content to a file
- `read_directory` - List directory contents
- `file_exists` - Check if a file exists

These commands are automatically available in the frontend via the `@tauri-apps/api` package.

## Configuration

- `Cargo.toml` - Rust dependencies and project metadata
- `tauri.conf.json` - Tauri application configuration
- `src/main.rs` - Rust entry point and command definitions
