#!/usr/bin/env bash
set -e

echo "=== GeminiClaw Environment Initialization ==="

SDK_DIR="./reference/gemini-cli/packages/sdk"

echo "1. Checking local SDK dependency..."
if [ ! -d "$SDK_DIR" ]; then
  echo "SDK directory not found. Attempting to initialize submodules..."
  git submodule update --init --recursive
fi

if [ -d "$SDK_DIR" ]; then
  echo "Found SDK at $SDK_DIR"
  cd "$SDK_DIR"
  npm ci --ignore-scripts || echo "SDK npm ci had issues, continuing..."
  npm run build --if-present || echo "No build script found or build failed, continuing..."
  cd ../../../../
else
  echo "Warning: $SDK_DIR not found. Is the submodule initialized?"
fi

echo "2. Installing Gemini Manager dependencies..."
npm install

echo "3. Enforcing local SDK symlink..."
if [ -d "$SDK_DIR" ]; then
  npm link "$SDK_DIR"
else
  echo "Skipped linking because SDK directory is missing."
fi

echo "=== Initialization Complete! ==="
echo "You can now safely run 'npm run start:cli -- default' and begin development."
