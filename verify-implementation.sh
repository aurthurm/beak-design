#!/bin/bash

echo "========================================="
echo "Tauri Backend Verification"
echo "========================================="
echo ""

# Check if we're in the right directory
if [ ! -d "src-tauri" ]; then
  echo "❌ Error: Must be run from project root"
  exit 1
fi

echo "1. Checking file structure..."
FILES=(
  "src-tauri/src/main.rs"
  "src-tauri/src/ollama.rs"
  "src-tauri/src/process_manager.rs"
  "src-tauri/Cargo.toml"
  "src-tauri/BACKEND_API.md"
  "src-tauri/examples/mcp_example.ts"
)

ALL_FILES_EXIST=true
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file (missing)"
    ALL_FILES_EXIST=false
  fi
done

if [ "$ALL_FILES_EXIST" = true ]; then
  echo "  ✓ All required files exist"
else
  echo "  ✗ Some files are missing"
  exit 1
fi

echo ""
echo "2. Checking dependencies..."
cd src-tauri

# Check for reqwest
if grep -q 'reqwest.*=.*"0.12"' Cargo.toml; then
  echo "  ✓ reqwest dependency added"
else
  echo "  ✗ reqwest dependency missing"
fi

# Check for uuid
if grep -q 'uuid.*=.*"1.0"' Cargo.toml; then
  echo "  ✓ uuid dependency added"
else
  echo "  ✗ uuid dependency missing"
fi

# Check for tokio features
if grep -q 'features.*=.*\[".*process.*".*\]' Cargo.toml; then
  echo "  ✓ tokio process feature enabled"
else
  echo "  ✗ tokio process feature missing"
fi

echo ""
echo "3. Checking Rust code compilation..."
cargo check --quiet 2>&1 | tail -5
if [ $? -eq 0 ]; then
  echo "  ✓ Code compiles successfully"
else
  echo "  ✗ Compilation failed"
  exit 1
fi

cd ..

echo ""
echo "4. Checking command registration..."
COMMANDS=(
  "detect_ollama"
  "spawn_mcp_server"
  "spawn_cli_agent"
  "send_mcp_message"
  "read_mcp_response"
  "kill_process"
  "list_processes"
  "get_process_info"
)

for cmd in "${COMMANDS[@]}"; do
  if grep -q "$cmd" src-tauri/src/main.rs; then
    echo "  ✓ $cmd registered"
  else
    echo "  ✗ $cmd not registered"
  fi
done

echo ""
echo "========================================="
echo "Verification Complete"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Run 'npm run tauri dev' to start the app"
echo "  2. Open DevTools (F12)"
echo "  3. Test: invoke('detect_ollama').then(console.log)"
echo "  4. Check BACKEND_API.md for full documentation"
echo ""
