#!/bin/zsh
set -euo pipefail

script_dir=${0:A:h}
repo_root=${script_dir:h}
native_root="$repo_root/packages/cli/native"
output_app="$native_root/MineCodex.app"
build_root=$(mktemp -d /tmp/minecodex-service-build.XXXXXX)
trap 'rm -rf "$build_root"' EXIT

mkdir -p "$build_root/arm64" "$build_root/x86_64"
for arch in arm64 x86_64; do
  xcrun clang -Os -fobjc-arc -arch "$arch" -mmacosx-version-min=13.0 \
    "$native_root/src/service-manager.m" \
    -framework Foundation -framework ServiceManagement \
    -o "$build_root/$arch/MineCodexServiceManager"
  xcrun clang -Os -fobjc-arc -arch "$arch" -mmacosx-version-min=13.0 \
    "$native_root/src/service-host.m" \
    -framework Foundation \
    -o "$build_root/$arch/MineCodexServiceHost"
done

rm -rf "$output_app"
ditto "$native_root/app-template" "$output_app"
mkdir -p "$output_app/Contents/MacOS" "$output_app/Contents/Resources"
lipo -create \
  "$build_root/arm64/MineCodexServiceManager" \
  "$build_root/x86_64/MineCodexServiceManager" \
  -output "$output_app/Contents/MacOS/MineCodexServiceManager"
lipo -create \
  "$build_root/arm64/MineCodexServiceHost" \
  "$build_root/x86_64/MineCodexServiceHost" \
  -output "$output_app/Contents/Resources/MineCodexServiceHost"
strip -x "$output_app/Contents/MacOS/MineCodexServiceManager"
strip -x "$output_app/Contents/Resources/MineCodexServiceHost"
xattr -cr "$output_app"
codesign --force --sign - "$output_app/Contents/Resources/MineCodexServiceHost"
codesign --force --deep --sign - "$output_app"
codesign --verify --deep --strict --verbose=2 "$output_app"
plutil -lint \
  "$output_app/Contents/Info.plist" \
  "$output_app/Contents/Library/LaunchAgents/com.vontean.minecodex.background.plist"
lipo -archs "$output_app/Contents/MacOS/MineCodexServiceManager"
lipo -archs "$output_app/Contents/Resources/MineCodexServiceHost"
