#!/usr/bin/env bash
# Convenience wrapper around build.py — builds installable zips into dist/.
# Usage: ./build.sh [chrome|firefox]
set -euo pipefail
cd "$(dirname "$0")"
exec python3 build.py "$@"
