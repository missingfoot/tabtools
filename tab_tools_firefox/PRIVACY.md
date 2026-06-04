# Privacy Policy for Tab Tools

**Last updated:** December 4, 2025

## Overview

Tab Tools is a browser extension that helps you manage your Chrome tabs. Your privacy is important to us, and this extension is designed to work entirely locally on your device.

## Data Collection

**Tab Tools does not collect, store, or transmit any personal data.**

All data processed by this extension stays on your local device:

- **Tab information** (URLs, titles) is only accessed to provide the extension's features and is never sent anywhere
- **Saved sessions** are stored locally in your browser using Chrome's storage API
- **User preferences** (settings, prepend string) are stored locally in your browser
- **Exported files** (JSON backups) are saved directly to your device

## Data Sharing

Tab Tools does not share any data with third parties. There are no analytics, tracking, or external services.

## Permissions

The extension requests the following permissions, used only for the stated purposes:

| Permission | Purpose |
|------------|---------|
| `tabs` | Access tab URLs and titles to group, copy, save, and manage tabs |
| `clipboardWrite` | Copy tab URLs to your clipboard |
| `downloads` | Save exported tab/session data as JSON files to your device |
| `storage` | Store your preferences and saved sessions locally |
| `activeTab` | Access the current tab to extract links (Copy all links feature) |
| `scripting` | Run a script to find links on the current page |
| `host_permissions` | Required for the scripting API to work on any webpage |

## Changes to This Policy

If this privacy policy changes, the updated version will be posted here with a new "Last updated" date.

## Contact

If you have questions about this privacy policy, please open an issue at:
https://github.com/missingfoot/tabtools/issues
