#!/usr/bin/env sh
# This script installs CMake into ~/.local/bin (multi-platform, CI-suitable)
set -eu

VERSION_MAJOR=3
VERSION_MINOR=31
VERSION_MICRO=2
VERSION="$VERSION_MAJOR.$VERSION_MINOR.$VERSION_MICRO"
PREFIX="$HOME/.local"

OS_UNAME=$(uname -s)

case "$OS_UNAME" in
  Linux)
    OS="linux"
    FILE="cmake-${VERSION}-linux-x86_64.tar.gz"
    SHA256="f8cbec2abc433938bd9378b129d1d288bb33b8b5a277afe19644683af6e32a59"
    ;;
  Darwin)
    OS="macos-universal"
    FILE="cmake-${VERSION}-macos-universal.tar.gz"
    SHA256="9496d48cda44d48e671a99e9f57f46d70592e9ac605d26525176eb0be7028962"
    ;;
  MINGW* | MSYS* | CYGWIN* | Windows_NT)
    # GitHub CI runners on windows label as MINGW64 or similar, or set $OS to Windows_NT
    OS="windows"
    FILE="cmake-${VERSION}-windows-x86_64.zip"
    SHA256="109c29a744d648863d3637b4963c90088045c8d92799c68c9b9d8713407776c8"
    ;;
  *)
    echo "Unsupported OS: $OS_UNAME"
    exit 1
    ;;
esac

BIN="${PREFIX}/bin"
PATH="${BIN}:${PATH}"

# Check for existing installation
if [ -f "${BIN}/cmake" ] && ("${BIN}/cmake" --version | grep -q "${VERSION}"); then
  echo "CMake ${VERSION} already installed in ${BIN}"
  exit 0
fi

URL="https://cmake.org/files/v${VERSION_MAJOR}.${VERSION_MINOR}/${FILE}"
TMPFILE=$(mktemp --tmpdir "cmake-${VERSION}-${OS}-XXXXXXXX.${FILE##*.}")

echo "Downloading CMake (${URL})..."
if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$URL" -o "$TMPFILE"
elif command -v wget >/dev/null 2>&1; then
    wget "$URL" -O "$TMPFILE" -nv
else
    echo "Error: Neither curl nor wget is installed!" >&2
    exit 1
fi

# Check checksum
if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL_SHA256=$(sha256sum "$TMPFILE" | awk '{print $1}')
elif command -v shasum >/dev/null 2>&1; then
  ACTUAL_SHA256=$(shasum -a 256 "$TMPFILE" | awk '{print $1}')
else
  echo "No SHA256 tool found, skipping checksum!"
  ACTUAL_SHA256=""
fi

if [ -n "$ACTUAL_SHA256" ] && [ "$ACTUAL_SHA256" != "$SHA256" ]; then
  echo "SHA256 mismatch for $TMPFILE"
  echo "Expected: $SHA256"
  echo "Actual:   $ACTUAL_SHA256"
  exit 1
fi

mkdir -p "$BIN"

case "$OS" in
  linux | macos-universal)
    tar xzf "$TMPFILE" -C "$PREFIX" --strip-components=1
    ;;
  windows)
    UNZIP_TMP="$(mktemp -d)"
    unzip -q "$TMPFILE" -d "$UNZIP_TMP"
    CMAKE_ROOT_DIR=$(find "$UNZIP_TMP" -mindepth 1 -maxdepth 1 -type d | head -n 1)
    mkdir -p "$PREFIX"
    cp -R "$CMAKE_ROOT_DIR"/* "$PREFIX/"
    rm -rf "$UNZIP_TMP"
    ;;
esac

rm "$TMPFILE"

echo "CMake ${VERSION} installed in ${BIN}"

# Reminder for PATH
case "$OS" in
  windows)
    echo "If using a new shell, ensure $BIN is in your PATH (add 'export PATH=\"\$HOME/.local/bin:\$PATH\"' to your profile for bash)"
    ;;
esac
