#!/usr/bin/env bash
# Sign the Firefox build with Mozilla (AMO) so it installs *permanently* in
# normal Firefox — no "temporary add-on" that vanishes on restart.
#
# 1. Create a free account at https://addons.mozilla.org
# 2. Generate API credentials at:
#       https://addons.mozilla.org/en-US/developers/addon/api/key/
# 3. Export them (web-ext reads these env vars automatically):
#       export WEB_EXT_API_KEY="user:1234567:89"
#       export WEB_EXT_API_SECRET="your-long-secret"
# 4. Run: ./sign-firefox.sh
#
# Output: a signed .xpi in dist/. Install it via
#   about:addons → gear icon → "Install Add-on From File…" → pick the .xpi
set -euo pipefail
cd "$(dirname "$0")"

if [[ -z "${WEB_EXT_API_KEY:-}" || -z "${WEB_EXT_API_SECRET:-}" ]]; then
  echo "error: WEB_EXT_API_KEY and WEB_EXT_API_SECRET must be set." >&2
  echo "Get them at https://addons.mozilla.org/en-US/developers/addon/api/key/" >&2
  exit 1
fi

mkdir -p dist
npx --yes web-ext@latest sign \
  --source-dir tab_tools_firefox \
  --artifacts-dir dist \
  --channel unlisted \
  --ignore-files "web-ext-artifacts/**"

echo
echo "Signed .xpi is in dist/. Install permanently in Firefox:"
echo "  about:addons → gear icon → Install Add-on From File… → pick the .xpi"
