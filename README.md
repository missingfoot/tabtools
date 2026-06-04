# Tab Tools

A powerful browser extension for advanced tab management and organization,
available for both **Chrome** and **Firefox**.

This repository contains both builds:

| Folder | Browser | Notes |
|--------|---------|-------|
| [`tab_tools_chrome/`](tab_tools_chrome/) | Chrome (and Chromium) | Manifest V3, service-worker background |
| [`tab_tools_firefox/`](tab_tools_firefox/) | Firefox 140+ | Manifest V3, event-page background |

The two builds share the same popup UI and logic (`popup.html`, `popup.js`,
`popup.css`). They differ only in `manifest.json` and `background.js` to suit
each browser's extension platform.

## Features

- **Group all tabs** — collect tabs into real browser tab groups, one titled,
  colored, collapsed group per domain
- **Group selected** — put the currently selected tabs into a single group
- **Order tabs** — reorder tabs by domain and subdomain (no groups)
- **Randomize tabs** — shuffle tab order in the current window
- **Close duplicates** — close duplicate tabs (all or selected), keeping the active one
- **Copy URLs** — copy all/selected tab URLs, optionally with a custom prefix
- **Sessions** — save, restore, import, and export named tab sessions
- **Export/Import** — back up all tabs and windows to JSON
- **Copy page links** — extract every link from the current page
- **Configurable UI** — show/hide feature rows from Settings

### Keyboard Shortcuts

| Key | Action | Key | Action |
|-----|--------|-----|--------|
| `G` | Group all tabs | `A` | Copy all tab URLs |
| `C` | Group selected tabs | `Q` | Copy all URLs with prefix |
| `U` | Order tabs by domain | `S` | Copy selected tab URLs |
| `R` | Randomize tabs | `X` | Copy selected URLs with prefix |
| `D` | Close duplicates | `E` | Export tabs to JSON |
| `F` | Close selected duplicates | `L` | Copy page links |
| `V` | Save session | `O` | Open URLs |
| `B` | Show sessions | `N` | Open URLs in new window |
| `I` | Import tabs | `P` | Show settings |

---

## Chrome

The Chrome build lives in [`tab_tools_chrome/`](tab_tools_chrome/). It uses a
Manifest V3 service-worker background and the `chrome.tabGroups` API for grouping.

### Install (unpacked, for development)

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `tab_tools_chrome/` folder

### Publish

Zip the **contents** of `tab_tools_chrome/` and upload to the
[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

## Firefox

The Firefox build lives in [`tab_tools_firefox/`](tab_tools_firefox/). It uses a
Manifest V3 event-page background, a Blob-based download (Firefox doesn't allow
`URL.createObjectURL` in Chrome-style service workers), and the same WebExtensions
tab-groups API. Requires **Firefox 140+**.

### Install (temporary, for development)

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `tab_tools_firefox/manifest.json`

Temporary add-ons are removed when Firefox restarts. For auto-reload during
development, install [`web-ext`](https://github.com/mozilla/web-ext) and run
`web-ext run` inside `tab_tools_firefox/`.

### Publish

Build a package and submit it to [addons.mozilla.org](https://addons.mozilla.org/developers/):

```sh
cd tab_tools_firefox
web-ext lint     # validate
web-ext build    # produces web-ext-artifacts/tab_tools-<version>.zip
```

---

## Privacy

Tab Tools works entirely locally and collects no data. See the `PRIVACY.md`
file in each build folder for details.
