#!/usr/bin/env bash
# Build the web bundle in Android mode, sync it into app assets, assemble the APK.
# First run needs the Gradle wrapper jar — generate it with `gradle wrapper` or by
# opening android/ in Android Studio once (Android SDK + JDK 17+ required).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"

# 1. web bundle with relative asset paths
( cd "$root/web" && VITE_TARGET=android npm run build )

# 2. sync dist -> app assets (the WebViewAssetLoader serves /assets/www/)
assets="$here/app/src/main/assets/www"
rm -rf "$assets"; mkdir -p "$assets"
cp -r "$root/web/dist/." "$assets/"

# 3. assemble
if [ ! -x "$here/gradlew" ]; then
  echo "No ./gradlew yet — run 'gradle wrapper' in android/ or open it in Android Studio first." >&2
  exit 1
fi
( cd "$here" && ./gradlew assembleDebug )
echo "APK: $here/app/build/outputs/apk/debug/app-debug.apk"
