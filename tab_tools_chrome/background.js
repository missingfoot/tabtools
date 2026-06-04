/**
 * Update toolbar icon based on color scheme
 */
function setIconTheme(isDark) {
  const folder = isDark ? 'dark' : 'light';
  chrome.action.setIcon({
    path: {
      16: `images/${folder}/icon16.png`,
      48: `images/${folder}/icon48.png`,
      128: `images/${folder}/icon128.png`
    }
  });
}

// Load saved theme preference on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['isDarkMode'], (result) => {
    if (result.isDarkMode !== undefined) {
      setIconTheme(result.isDarkMode);
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['isDarkMode'], (result) => {
    if (result.isDarkMode !== undefined) {
      setIconTheme(result.isDarkMode);
    }
  });
});

/**
 * Helper function to download data as a file
 * @param {string} data - The content to be downloaded
 * @param {string} filename - The name of the file to be created
 */
function downloadAsFile(data, filename) {
  // Create a data URL containing the text
  const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(data);
  
  chrome.downloads.download({
    url: dataUrl,
    filename: filename
  });
}

/**
 * Main message listener for handling extension actions
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateTheme') {
    setIconTheme(request.isDark);
    chrome.storage.local.set({ isDarkMode: request.isDark });
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'generateURLList') {
    // Get all windows and their tabs
    chrome.windows.getAll({ populate: true }, (windows) => {
      const windowsData = windows.map(win => ({
        focused: win.focused,
        state: win.state,
        tabs: win.tabs.map(tab => ({
          url: tab.url,
          active: tab.active,
          pinned: tab.pinned,
          title: tab.title
        }))
      }));

      const exportData = {
        version: 1,
        timestamp: new Date().toISOString(),
        windows: windowsData
      };

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadAsFile(JSON.stringify(exportData, null, 2), `tabs-backup-${timestamp}.json`);
      sendResponse({ success: true });
    });
    return true; // Will respond asynchronously
  }

  if (request.action === 'importTabs') {
    const file = request.fileContent;
    try {
      const data = JSON.parse(file);
      if (!data.version || !data.windows) {
        throw new Error('Invalid file format');
      }

      // Create windows sequentially to ensure proper order
      async function createWindows() {
        for (const windowData of data.windows) {
          try {
            const urls = windowData.tabs.map(tab => tab.url);
            
            // Create window first without state
            const createData = {
              url: urls,
              focused: windowData.focused
            };

            console.log('Creating window with data:', JSON.stringify(createData));
            const window = await chrome.windows.create(createData);
            
            // Set window state after creation
            const state = String(windowData.state).toLowerCase();
            if (['minimized', 'maximized', 'normal'].includes(state)) {
              console.log('Setting window state:', state);
              await chrome.windows.update(window.id, { state: state });
            }
            
            // Handle pinned tabs after window is created
            for (let i = 0; i < windowData.tabs.length; i++) {
              if (windowData.tabs[i].pinned) {
                await chrome.tabs.update(window.tabs[i].id, { pinned: true });
              }
            }

            // Set active tab after window is created
            const activeTabIndex = windowData.tabs.findIndex(tab => tab.active);
            if (activeTabIndex !== -1) {
              await chrome.tabs.update(window.tabs[activeTabIndex].id, { active: true });
            }
          } catch (error) {
            console.error('Error creating window:', error, windowData);
          }
        }
      }

      // Start the sequential window creation
      createWindows().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error in window creation:', error);
        sendResponse({ success: false, error: error.message });
      });
    } catch (error) {
      console.error('Error importing tabs:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  if (request.action === 'copyUrls' && request.urls && Array.isArray(request.urls)) {
    chrome.runtime.sendMessage({
      action: "copyUrls",
      urls: request.urls
    });
    sendResponse({ success: true });
    return false;
  }
});

// Listen for clicks on the extension icon
chrome.action.onClicked.addListener((tab) => {
  // This listener is kept empty as we use the popup
});