// Constants for feedback display durations
const FEEDBACK_TIMEOUT = 1500;
const ERROR_FEEDBACK_TIMEOUT = 3000;
// Regular expression for basic URL validation
const URL_REGEX = /^(https?|ftp):\/\/([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/;

/**
 * Shows temporary feedback on a button after an action
 * @param {string} buttonId - The ID of the button to show feedback on
 * @param {string} feedbackText - The text to display (optional for icon-only buttons)
 * @param {boolean} isError - Whether this is an error state
 * 
 * The function handles two types of buttons:
 * 1. Icon-only buttons: Shows only a check/error icon
 * 2. Regular buttons: Shows icon, text, and preserves keyboard shortcut
 */
async function showButtonFeedback(buttonId, feedbackText, isError = false) {
  const button = document.getElementById(buttonId);
  const originalContent = button.innerHTML;
  const isIconOnly = button.classList.contains('icon-only');
  const shortcutKey = !isIconOnly ? button.querySelector('.keyboard-shortcut')?.textContent : null;
  
  if (isIconOnly) {
    // For icon-only buttons, just show the check/error icon
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        ${isError ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' : '<polyline points="20 6 9 17 4 12"/>'}
      </svg>
    `;
  } else {
    // For regular buttons, use the wrapper and include keyboard shortcut
    if (!button.querySelector('.button-content-wrapper')) {
      button.innerHTML = `<div class="button-content-wrapper">${button.innerHTML}</div>`;
    }
    
    const wrapper = button.querySelector('.button-content-wrapper');
    wrapper.innerHTML = `
      <div>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          ${isError ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' : '<polyline points="20 6 9 17 4 12"/>'}
        </svg>
        <span>${feedbackText || ''}</span>
      </div>
      ${shortcutKey ? `<span class="keyboard-shortcut">${shortcutKey}</span>` : ''}
    `;
  }

  // Add appropriate feedback classes
  button.classList.toggle('error', isError);
  if (!isError && feedbackText) {
    button.classList.add('success');
  }

  // Wait for animation/timeout
  await new Promise(resolve => setTimeout(resolve, isError ? ERROR_FEEDBACK_TIMEOUT : FEEDBACK_TIMEOUT));

  // Cleanup: remove feedback classes and restore original content
  button.classList.remove('error', 'success');
  button.innerHTML = originalContent;
  
  // Ensure button is fully reset to original state
  button.style.removeProperty('background-color');
  button.style.removeProperty('color');
}

/**
 * Validates a URL with strict security rules
 * @param {string} url - The URL to validate
 * @returns {boolean} - Whether the URL is valid and safe
 * 
 * Performs multiple checks:
 * 1. Valid URL format
 * 2. Allowed protocols (http, https, ftp)
 * 3. Valid hostname structure
 * 4. No suspicious characters in path
 */
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    // Verify protocol is in allowed list
    if (!['http:', 'https:', 'ftp:'].includes(urlObj.protocol)) {
      return false;
    }
    // Verify hostname format (requires at least one dot, valid characters)
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(urlObj.hostname)) {
      return false;
    }
    // Check for potentially malicious characters in path
    if (/[<>'"()]/.test(urlObj.pathname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes a URL for safe display and clipboard operations
 * @param {string} url - The URL to sanitize
 * @returns {string} - The sanitized URL or empty string if invalid
 * 
 * Security measures:
 * 1. Validates URL format
 * 2. Removes HTML tags
 * 3. Removes potentially dangerous characters
 * 4. Ensures protocol is allowed
 */
function sanitizeUrl(url) {
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:', 'ftp:'].includes(urlObj.protocol)) {
      return '';
    }
    return urlObj.toString()
      .replace(/<[^>]*>/g, '')  // Remove HTML tags
      .replace(/[<>'"()]/g, ''); // Remove suspicious characters
  } catch {
    return '';
  }
}

/**
 * Extracts and validates URLs from text content
 * @param {string} text - The text to extract URLs from
 * @returns {string[]} - Array of valid, sanitized URLs
 * 
 * Process:
 * 1. Uses regex to find URL-like patterns
 * 2. Validates each URL
 * 3. Sanitizes valid URLs
 * 4. Filters out empty results
 */
function extractUrls(text) {
  const urls = [];
  const urlRegex = /((https?|ftp):\/\/[^\s/$.?#].[^\s]*)/gi;
  let match;
  
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    if (isValidUrl(url)) {
      urls.push(sanitizeUrl(url));
    }
  }
  return urls.filter(Boolean);
}

/**
 * Handles errors uniformly across the extension
 * @param {Error} error - The error object
 * @param {string} buttonId - ID of the button to show feedback on
 * @param {string} operation - Description of the operation that failed
 */
async function handleError(error, buttonId, operation) {
  console.error(`Error ${operation}:`, error);
  await showButtonFeedback(buttonId, operation, true);
}

/**
 * Groups tabs by domain and subdomain
 * Maintains order within groups for better user experience
 * 
 * Process:
 * 1. Groups by base domain (e.g., example.com)
 * 2. Subgroups by subdomain (e.g., blog.example.com)
 * 3. Maintains original order within groups
 */
async function groupTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    let groupedTabs = {};

    // First pass: group tabs by domain and subdomain
    tabs.forEach(function (tab) {
      let url = new URL(tab.url);
      let parts = url.hostname.split('.');
      let baseDomain = parts.slice(-2).join('.');
      let subdomain = parts.slice(0, -2).join('.');

      // Create nested structure if it doesn't exist
      if (!groupedTabs[baseDomain]) {
        groupedTabs[baseDomain] = {};
      }
      if (!groupedTabs[baseDomain][subdomain]) {
        groupedTabs[baseDomain][subdomain] = [];
      }
      groupedTabs[baseDomain][subdomain].push(tab);
    });

    // Second pass: create ordered list while maintaining group structure
    let newOrder = [];
    Object.keys(groupedTabs).sort().forEach(function (baseDomain) {
      Object.keys(groupedTabs[baseDomain]).sort().forEach(function (subdomain) {
        newOrder = newOrder.concat(groupedTabs[baseDomain][subdomain]);
      });
    });

    // Final pass: reorder tabs
    for (let i = 0; i < newOrder.length; i++) {
      await chrome.tabs.move(newOrder[i].id, { index: i });
    }

    await showButtonFeedback('groupTabs', 'Grouped!');
  } catch (error) {
    console.error('Error grouping tabs:', error);
  }
}

/**
 * Closes duplicate tabs while keeping the current tab if it's a duplicate
 * and maintaining focus on the current tab.
 * 
 * Process:
 * 1. Identifies all duplicate URLs
 * 2. Preserves the current tab if it's a duplicate
 * 3. Removes other duplicates
 * 4. Maintains focus on current tab
 */
async function closeDuplicates() {
  try {
    // Get all tabs and the current active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    
    // Track unique URLs and tabs to close
    let uniqueURLs = new Map(); // URL -> Tab
    let tabsToClose = new Set();
    let activeTabURL = activeTab.url.toLowerCase();
    
    // First pass: identify duplicates while preserving active tab
    for (const tab of allTabs) {
      const url = tab.url.toLowerCase();
      
      if (uniqueURLs.has(url)) {
        // If this is the active tab, mark the previous tab as duplicate
        if (tab.id === activeTab.id) {
          tabsToClose.add(uniqueURLs.get(url).id);
          uniqueURLs.set(url, tab); // Keep the active tab
        } else {
          // Otherwise, mark this tab as duplicate
          tabsToClose.add(tab.id);
        }
      } else {
        uniqueURLs.set(url, tab);
      }
    }

    // Remove duplicates
    if (tabsToClose.size > 0) {
      await chrome.tabs.remove([...tabsToClose]);
      
      // If active tab wasn't closed, ensure it stays focused
      if (!tabsToClose.has(activeTab.id)) {
        await chrome.tabs.update(activeTab.id, { active: true });
      }
    }

    await showButtonFeedback('closeDuplicates', `${tabsToClose.size} closed`);
  } catch (error) {
    console.error('Error closing duplicate tabs:', error);
    await handleError(error, 'closeDuplicates', 'Failed to close duplicates');
  }
}

/**
 * Randomizes tab order using Fisher-Yates shuffle
 * Provides visual feedback on completion
 */
async function randomizeTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const shuffledTabs = [...tabs];
    
    // Fisher-Yates shuffle algorithm
    for (let i = shuffledTabs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledTabs[i], shuffledTabs[j]] = [shuffledTabs[j], shuffledTabs[i]];
    }
    
    // Apply new order
    for (let i = 0; i < shuffledTabs.length; i++) {
      await chrome.tabs.move(shuffledTabs[i].id, { index: i });
    }

    await showButtonFeedback('randomizeTabs', 'Shuffled!');
  } catch (error) {
    console.error('Error randomizing tabs:', error);
    await handleError(error, 'randomizeTabs', 'Failed to shuffle tabs');
  }
}

/**
 * Closes all selected tabs while maintaining focus if the active tab isn't closed.
 */
async function closeSelectedDuplicates() {
  try {
    // Get all selected tabs and the current active tab
    const selectedTabs = await chrome.tabs.query({ highlighted: true, currentWindow: true });
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // If no tabs are selected (besides active), use only the active tab
    const tabsToClose = selectedTabs.length > 1 ? selectedTabs : [activeTab];
    
    // Get IDs of tabs to close
    const tabIds = tabsToClose.map(tab => tab.id);
    
    // Close the tabs
    await chrome.tabs.remove(tabIds);

    await showButtonFeedback('closeSelectedDuplicates', `${tabIds.length} closed`);
  } catch (error) {
    console.error('Error closing selected tabs:', error);
    await handleError(error, 'closeSelectedDuplicates', 'Failed to close tabs');
  }
}

// Listen for messages from the content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "copyUrls") {
    // Copy URLs to clipboard
    navigator.clipboard.writeText(request.urls.join('\n'))
      .then(() => {
        showButtonFeedback('copyUrls', 'Copied!');
      })
      .catch((error) => {
        console.error('Error copying URLs:', error);
        handleError(error, 'copyUrls', 'Failed to copy');
      });
  }
  // Return false since we're not using sendResponse
  return false;
});

/**
 * Saves the current window's tabs as a session
 */
async function saveSession() {
  try {
    // Get all tabs in current window
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    // Create session object
    const session = {
      timestamp: Date.now(),
      tabCount: tabs.length,
      urls: tabs.map(tab => tab.url),
      customName: null // Add support for custom names
    };

    // Get existing sessions
    const result = await chrome.storage.local.get('sessions');
    const sessions = result.sessions || [];
    
    // Add new session
    sessions.unshift(session);
    
    // Save updated sessions
    await chrome.storage.local.set({ sessions });
    
    await showButtonFeedback('saveSession', 'Saved!');
  } catch (error) {
    console.error('Error saving session:', error);
    await handleError(error, 'saveSession', 'Failed to save');
  }
}

/**
 * Formats a timestamp into a concise relative time string if recent, or date if older
 * @param {number} timestamp - The timestamp to format
 * @returns {string} - Formatted date string
 */
function formatSessionDate(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  // Show relative time for anything less than 7 days old
  if (weeks < 1) {
    if (minutes < 1) return 'Now';
    if (hours < 1) return `${minutes}m`;
    if (days < 1) return `${hours}h`;
    return `${days}d`;
  }
  
  if (weeks < 4) {
    return `${weeks}w`;
  }

  // Fall back to date format for older sessions
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-');
}

/**
 * Extracts and formats the most common domains from a list of URLs
 * @param {string[]} urls - List of URLs to analyze
 * @returns {string} - Formatted string of top domains
 */
function getTopDomains(urls) {
  const CHAR_LIMIT = 48; // Adjusted to match visual space
  
  // Count domain occurrences
  const domainCounts = {};
  urls.forEach(url => {
    try {
      const hostname = new URL(url).hostname;
      // Remove 'www.' if present
      let parts = hostname.replace(/^www\./, '').split('.');
      
      // Handle special cases like .co.uk, .com.au, etc.
      let domain;
      if (parts.length > 2 && parts[parts.length - 2] === 'co') {
        // For cases like domain.co.uk, take last 3 parts
        domain = parts.slice(-3).join('.');
      } else {
        // For normal cases, take last 2 parts
        domain = parts.slice(-2).join('.');
      }
      
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    } catch {
      // Skip invalid URLs
    }
  });

  // Convert to array and sort by count
  const sortedDomains = Object.entries(domainCounts)
    .sort(([,a], [,b]) => b - a)  // Sort by count descending
    .map(([domain]) => domain);    // Take just the domain names

  // Build the domain list with intelligent truncation
  const domains = [];
  let totalLength = 0;

  for (const domain of sortedDomains) {
    // Calculate length including the comma and space that would be added
    const addedLength = domains.length === 0 ? domain.length : domain.length + 2;
    
    // Check if adding this domain would exceed the limit
    if (totalLength + addedLength > CHAR_LIMIT) {
      break;
    }
    
    domains.push(domain);
    totalLength += addedLength;
  }

  // Join domains with proper separators
  if (domains.length === 0) {
    return 'No domains';
  }

  // If we couldn't fit all domains, add ellipsis
  const result = domains.length < sortedDomains.length ? domains.join(', ') + '...' : domains.join(', ');
  return result;
}

/**
 * Shows the sessions overlay and loads saved sessions
 */
async function showSessions() {
  const overlay = document.getElementById('sessionsOverlay');
  const sessionsList = document.getElementById('sessionsList');
  const sessionManagement = document.getElementById('sessionManagement');
  const exportButton = document.getElementById('exportSessions');
  const clearButton = document.getElementById('clearSessions');
  
  try {
    // Get saved sessions
    const result = await chrome.storage.local.get('sessions');
    const sessions = result.sessions || [];
    
    // Update session count in header
    const countText = sessions.length === 1 ? '1 session' : `${sessions.length} sessions`;
    document.querySelector('.session-count-header').textContent = countText;
    
    // Clear existing list
    sessionsList.innerHTML = '';
    
    // Add sessions to list
    sessions.forEach((session, index) => {
      const formattedDate = formatSessionDate(session.timestamp);
      const topDomains = getTopDomains(session.urls);
      
      const sessionItem = document.createElement('div');
      sessionItem.className = 'session-item';
      sessionItem.innerHTML = `
        <div class="session-info">
          <div class="session-header">
            <div class="session-date" contenteditable="false" spellcheck="false">
              ${session.customName ? 
                `${session.customName} <span class="session-tab-count">${session.tabCount} tabs</span>` : 
                `${session.tabCount} tabs`}
            </div>
            <div class="session-timestamp">${formattedDate}</div>
          </div>
          <div class="session-count">${topDomains || 'No domains'}</div>
          <div class="session-actions">
            <div class="session-actions-left">
              <a class="restore-session">Restore</a>
              <a class="rename-session">Rename</a>
              <a class="copy-session">Copy URLs</a>
            </div>
            <div class="session-actions-right">
              <a class="remove-session">Remove</a>
            </div>
          </div>
        </div>
      `;
      
      // Store original content for reuse
      const originalContent = sessionItem.querySelector('.session-actions').innerHTML;
      const sessionDateEl = sessionItem.querySelector('.session-date');
      let isRenaming = false;
      
      // Add mouseleave handler to reset confirmation state
      sessionItem.addEventListener('mouseleave', () => {
        const actionsDiv = sessionItem.querySelector('.session-actions');
        // Only reset if showing confirmation dialog and NOT in rename mode
        if (actionsDiv.querySelector('.confirm-text') && !isRenaming) {
          actionsDiv.innerHTML = originalContent;
          // Reattach original event listeners
          attachSessionItemListeners(sessionItem, session, index);
        }
      });

      // Function to handle rename mode
      function enterRenameMode() {
        isRenaming = true;
        const actionsDiv = sessionItem.querySelector('.session-actions');
        const originalText = sessionDateEl.textContent;
        
        // Store the original HTML before entering edit mode
        const originalHtml = sessionDateEl.innerHTML;
        
        // Change action buttons
        actionsDiv.innerHTML = `
          <div class="session-actions-left">
            <a class="accept-rename">Accept</a>
            <a class="cancel-rename">Cancel</a>
          </div>
        `;
        
        // Make text editable and set just the name part
        sessionDateEl.contentEditable = true;
        sessionDateEl.textContent = session.customName || `${session.tabCount} tabs`;
        sessionDateEl.focus();
        
        // Select all text
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(sessionDateEl);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Add placeholder if empty
        if (!sessionDateEl.textContent.trim()) {
          sessionDateEl.textContent = 'Rename session...';
          sessionDateEl.classList.add('placeholder');
        }
        
        // Handle accept rename
        actionsDiv.querySelector('.accept-rename').addEventListener('click', () => {
          confirmRename();
        });
        
        // Handle cancel rename
        actionsDiv.querySelector('.cancel-rename').addEventListener('click', () => {
          cancelRename();
        });
        
        // Handle keyboard events
        function handleKeyDown(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            confirmRename();
          } else if (e.key === 'Escape') {
            cancelRename();
          }
        }
        
        sessionDateEl.addEventListener('keydown', handleKeyDown);
        
        // Handle rename confirmation
        async function confirmRename() {
          if (sessionDateEl.classList.contains('placeholder')) {
            cancelRename();
            return;
          }
          
          let newName = sessionDateEl.textContent.trim();
          // Truncate name if it's too long (28 chars)
          if (newName.length > 28) {
            newName = newName.substring(0, 25) + '...';
          }

          if (newName && newName !== `${session.tabCount} tabs`) {
            // Update session object
            session.customName = newName;
            
            // Get current sessions
            const result = await chrome.storage.local.get('sessions');
            const sessions = result.sessions || [];
            
            // Update session at index
            sessions[index] = session;
            
            // Save updated sessions
            await chrome.storage.local.set({ sessions });
            
            // Update the display with the new name and tab count
            sessionDateEl.innerHTML = `${newName} <span class="session-tab-count">${session.tabCount} tabs</span>`;
          } else {
            // If name was cleared or unchanged, revert to default
            session.customName = null;
            sessionDateEl.textContent = `${session.tabCount} tabs`;
          }
          
          exitRenameMode();
        }
        
        // Handle rename cancellation
        function cancelRename() {
          sessionDateEl.innerHTML = originalHtml;
          exitRenameMode();
        }
        
        // Exit rename mode
        function exitRenameMode() {
          isRenaming = false;
          sessionDateEl.contentEditable = false;
          sessionDateEl.classList.remove('placeholder');
          sessionDateEl.removeEventListener('keydown', handleKeyDown);
          actionsDiv.innerHTML = originalContent;
          attachSessionItemListeners(sessionItem, session, index);
        }
      }

      // Add click handlers for actions
      sessionItem.querySelector('.restore-session').addEventListener('click', (e) => {
        e.stopPropagation();
        restoreSession(session);
      });
      
      sessionItem.querySelector('.rename-session').addEventListener('click', (e) => {
        e.stopPropagation();
        enterRenameMode();
      });
      
      sessionItem.querySelector('.copy-session').addEventListener('click', async (e) => {
        e.stopPropagation();
        const copyLink = e.target;
        const originalText = copyLink.textContent;
        
        try {
          await navigator.clipboard.writeText(session.urls.join('\n'));
          copyLink.textContent = 'Copied!';
          copyLink.classList.add('feedback-text');
          setTimeout(() => {
            copyLink.textContent = originalText;
            copyLink.classList.remove('feedback-text');
          }, 1500);
        } catch (error) {
          console.error('Error copying session URLs:', error);
        }
      });
      
      sessionItem.querySelector('.remove-session').addEventListener('click', (e) => {
        e.stopPropagation();
        const actionsDiv = sessionItem.querySelector('.session-actions');
        
        if (!actionsDiv.querySelector('.confirm-text')) {
          // Show confirmation
          actionsDiv.innerHTML = `
            <span class="confirm-text">Are you sure?</span>
            <div class="session-actions-right">
              <a class="remove-session">Remove</a>
              <a class="cancel-remove">Cancel</a>
            </div>
          `;
          
          // Add new event listeners
          actionsDiv.querySelector('.remove-session').addEventListener('click', () => {
            deleteSession(index);
          });
          
          actionsDiv.querySelector('.cancel-remove').addEventListener('click', () => {
            actionsDiv.innerHTML = originalContent;
            // Reattach original event listeners
            attachSessionItemListeners(sessionItem, session, index);
          });
        }
      });
      
      sessionsList.appendChild(sessionItem);
    });

    // Show/hide management buttons based on session count
    if (sessions.length === 0) {
      exportButton.style.display = 'none';
      clearButton.style.display = 'none';
    } else {
      exportButton.style.display = 'flex';
      clearButton.style.display = 'flex';
    }

    // Add session management buttons back to the list
    sessionsList.appendChild(sessionManagement);
    
    // Show overlay with animation
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });
  } catch (error) {
    console.error('Error showing sessions:', error);
  }
}

/**
 * Reattaches event listeners to session item actions
 */
function attachSessionItemListeners(sessionItem, session, index) {
  const sessionDateEl = sessionItem.querySelector('.session-date');
  const originalContent = sessionItem.querySelector('.session-actions').innerHTML;

  function enterRenameMode() {
    isRenaming = true;
    const actionsDiv = sessionItem.querySelector('.session-actions');
    const originalText = sessionDateEl.textContent;
    
    // Store the original HTML before entering edit mode
    const originalHtml = sessionDateEl.innerHTML;
    
    // Change action buttons
    actionsDiv.innerHTML = `
      <div class="session-actions-left">
        <a class="accept-rename">Accept</a>
        <a class="cancel-rename">Cancel</a>
      </div>
    `;
    
    // Make text editable and set just the name part
    sessionDateEl.contentEditable = true;
    sessionDateEl.textContent = session.customName || `${session.tabCount} tabs`;
    sessionDateEl.focus();
    
    // Select all text
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(sessionDateEl);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Add placeholder if empty
    if (!sessionDateEl.textContent.trim()) {
      sessionDateEl.textContent = 'Rename session...';
      sessionDateEl.classList.add('placeholder');
    }
    
    // Handle accept rename
    actionsDiv.querySelector('.accept-rename').addEventListener('click', () => {
      confirmRename();
    });
    
    // Handle cancel rename
    actionsDiv.querySelector('.cancel-rename').addEventListener('click', () => {
      cancelRename();
    });
    
    // Handle keyboard events
    function handleKeyDown(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmRename();
      } else if (e.key === 'Escape') {
        cancelRename();
      }
    }
    
    sessionDateEl.addEventListener('keydown', handleKeyDown);
    
    // Handle rename confirmation
    async function confirmRename() {
      if (sessionDateEl.classList.contains('placeholder')) {
        cancelRename();
        return;
      }
      
      let newName = sessionDateEl.textContent.trim();
      // Truncate name if it's too long (28 chars)
      if (newName.length > 28) {
        newName = newName.substring(0, 25) + '...';
      }

      if (newName && newName !== `${session.tabCount} tabs`) {
        // Update session object
        session.customName = newName;
        
        // Get current sessions
        const result = await chrome.storage.local.get('sessions');
        const sessions = result.sessions || [];
        
        // Update session at index
        sessions[index] = session;
        
        // Save updated sessions
        await chrome.storage.local.set({ sessions });
        
        // Update the display with the new name and tab count
        sessionDateEl.innerHTML = `${newName} <span class="session-tab-count">${session.tabCount} tabs</span>`;
      } else {
        // If name was cleared or unchanged, revert to default
        session.customName = null;
        sessionDateEl.textContent = `${session.tabCount} tabs`;
      }
      
      exitRenameMode();
    }
    
    // Handle rename cancellation
    function cancelRename() {
      sessionDateEl.innerHTML = originalHtml;
      exitRenameMode();
    }
    
    // Exit rename mode
    function exitRenameMode() {
      isRenaming = false;
      sessionDateEl.contentEditable = false;
      sessionDateEl.classList.remove('placeholder');
      sessionDateEl.removeEventListener('keydown', handleKeyDown);
      actionsDiv.innerHTML = originalContent;
      attachSessionItemListeners(sessionItem, session, index);
    }
  }

  sessionItem.querySelector('.restore-session').addEventListener('click', (e) => {
    e.stopPropagation();
    restoreSession(session);
  });
  
  sessionItem.querySelector('.rename-session').addEventListener('click', (e) => {
    e.stopPropagation();
    enterRenameMode();
  });
  
  sessionItem.querySelector('.copy-session').addEventListener('click', async (e) => {
    e.stopPropagation();
    const copyLink = e.target;
    const originalText = copyLink.textContent;
    
    try {
      await navigator.clipboard.writeText(session.urls.join('\n'));
      copyLink.textContent = 'Copied!';
      copyLink.classList.add('feedback-text');
      setTimeout(() => {
        copyLink.textContent = originalText;
        copyLink.classList.remove('feedback-text');
      }, 1500);
    } catch (error) {
      console.error('Error copying session URLs:', error);
    }
  });
  
  sessionItem.querySelector('.remove-session').addEventListener('click', (e) => {
    e.stopPropagation();
    const actionsDiv = sessionItem.querySelector('.session-actions');
    
    if (!actionsDiv.querySelector('.confirm-text')) {
      // Show confirmation
      const originalContent = actionsDiv.innerHTML;
      actionsDiv.innerHTML = `
        <span class="confirm-text">Are you sure?</span>
        <div class="session-actions-right">
          <a class="remove-session">Remove</a>
          <a class="cancel-remove">Cancel</a>
        </div>
      `;
      
      // Add new event listeners
      actionsDiv.querySelector('.remove-session').addEventListener('click', () => {
        deleteSession(index);
      });
      
      actionsDiv.querySelector('.cancel-remove').addEventListener('click', () => {
        actionsDiv.innerHTML = originalContent;
        // Reattach original event listeners
        attachSessionItemListeners(sessionItem, session, index);
      });
    }
  });
}

/**
 * Restores a saved session in a new window
 */
async function restoreSession(session) {
  try {
    await chrome.windows.create({ url: session.urls });
    hideSessionsOverlay();
  } catch (error) {
    console.error('Error restoring session:', error);
  }
}

/**
 * Deletes a saved session
 */
async function deleteSession(index) {
  try {
    // Get current sessions
    const result = await chrome.storage.local.get('sessions');
    const sessions = result.sessions || [];
    
    // Remove session at index
    sessions.splice(index, 1);
    
    // Save updated sessions
    await chrome.storage.local.set({ sessions });
    
    // Refresh the list
    showSessions();
  } catch (error) {
    console.error('Error deleting session:', error);
  }
}

/**
 * Hides the sessions overlay
 */
function hideSessionsOverlay() {
  const overlay = document.getElementById('sessionsOverlay');
  overlay.classList.remove('visible');
}

// Initialize settings with default values
const defaultSettings = {
  rows: {
    prepend: {
      enabled: false,
      settings: {
        prependString: ''
      }
    },
    urlInput: {
      enabled: false
    },
    copyLinks: {
      enabled: false
    }
  }
};

let settings = { ...defaultSettings };

/**
 * Loads settings from storage
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get('settings');
    if (result.settings) {
      // Merge with defaults to ensure all properties exist
      settings = {
        rows: {
          prepend: {
            enabled: result.settings.rows?.prepend?.enabled ?? defaultSettings.rows.prepend.enabled,
            settings: {
              prependString: result.settings.rows?.prepend?.settings?.prependString ?? defaultSettings.rows.prepend.settings.prependString
            }
          },
          urlInput: {
            enabled: result.settings.rows?.urlInput?.enabled ?? defaultSettings.rows.urlInput.enabled
          },
          copyLinks: {
            enabled: result.settings.rows?.copyLinks?.enabled ?? defaultSettings.rows.copyLinks.enabled
          }
        }
      };
    }
    
    // Apply loaded settings to UI
    document.getElementById('prependRowEnabled').checked = settings.rows.prepend.enabled;
    document.getElementById('urlInputEnabled').checked = settings.rows.urlInput.enabled;
    document.getElementById('copyLinksEnabled').checked = settings.rows.copyLinks.enabled;
    document.getElementById('prependString').value = settings.rows.prepend.settings.prependString;
    
    // Update UI based on settings
    updateRowVisibility();
  } catch (error) {
    console.error('Error loading settings:', error);
    // On error, use default settings
    settings = { ...defaultSettings };
    updateRowVisibility();
  }
}

/**
 * Saves settings to storage
 */
async function saveSettings() {
  try {
    await chrome.storage.local.set({ settings });
    updateRowVisibility();
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

/**
 * Updates visibility of button rows based on settings
 */
function updateRowVisibility() {
  try {
    // Update prepend row visibility
    const prependRow = document.querySelector('[role="toolbar"][aria-label="Copy tabs + prepend"]');
    if (prependRow) {
      prependRow.style.display = settings.rows.prepend.enabled ? 'flex' : 'none';
    }
    
    // Update prepend settings visibility
    const prependSettings = document.getElementById('prependSettings');
    if (prependSettings) {
      prependSettings.style.display = settings.rows.prepend.enabled ? 'block' : 'none';
    }

    // Update URL input section visibility
    const urlInputSection = document.getElementById('urlInputSection');
    if (urlInputSection) {
      urlInputSection.style.display = settings.rows.urlInput.enabled ? 'flex' : 'none';
    }

    // Update Copy Links button visibility
    const copyLinksButton = document.getElementById('copyUrls');
    if (copyLinksButton) {
      copyLinksButton.style.display = settings.rows.copyLinks.enabled ? 'flex' : 'none';
    }
  } catch (error) {
    console.error('Error updating row visibility:', error);
  }
}

/**
 * Shows the settings overlay
 */
function showSettings() {
  const overlay = document.getElementById('settingsOverlay');
  if (!overlay) return;
  
  // Ensure settings UI is up to date
  document.getElementById('prependRowEnabled').checked = settings.rows.prepend.enabled;
  document.getElementById('urlInputEnabled').checked = settings.rows.urlInput.enabled;
  document.getElementById('copyLinksEnabled').checked = settings.rows.copyLinks.enabled;
  document.getElementById('prependString').value = settings.rows.prepend.settings.prependString;
  
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
  });
}

/**
 * Hides the settings overlay
 */
function hideSettings() {
  const overlay = document.getElementById('settingsOverlay');
  if (!overlay) return;
  overlay.classList.remove('visible');
}

/**
 * Exports all sessions to a JSON file
 */
async function exportSessions() {
  try {
    const result = await chrome.storage.local.get('sessions');
    const sessions = result.sessions || [];
    
    if (sessions.length === 0) {
      await showButtonFeedback('exportSessions', 'No sessions', true);
      return;
    }

    const exportData = {
      version: 1,
      timestamp: Date.now(),
      sessions: sessions
    };

    // Create and download the file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `tab-sessions-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    await showButtonFeedback('exportSessions', 'Exported!');
  } catch (error) {
    console.error('Error exporting sessions:', error);
    await handleError(error, 'exportSessions', 'Failed to export');
  }
}

/**
 * Imports sessions from a JSON file
 */
async function importSessions() {
  try {
    const input = document.getElementById('sessionImportInput');
    input.click();

    input.onchange = async function(e) {
      try {
        const file = e.target.files[0];
        if (!file) return;

        const text = await file.text();
        const data = JSON.parse(text);

        // Validate the import data
        if (!data.version || !Array.isArray(data.sessions)) {
          throw new Error('Invalid file format');
        }

        // Get current sessions
        const result = await chrome.storage.local.get('sessions');
        const currentSessions = result.sessions || [];
        
        // Create a Set of existing session identifiers (timestamp + first URL)
        const existingSessionIds = new Set(
          currentSessions.map(session => `${session.timestamp}_${session.urls[0]}`)
        );
        
        // Filter out duplicates from imported sessions
        const newSessions = data.sessions.filter(session => {
          const sessionId = `${session.timestamp}_${session.urls[0]}`;
          return !existingSessionIds.has(sessionId);
        });
        
        // Add new sessions to the start of the list
        const updatedSessions = [...newSessions, ...currentSessions];
        
        // Save updated sessions
        await chrome.storage.local.set({ sessions: updatedSessions });

        // Store current scroll position
        const sessionsList = document.getElementById('sessionsList');
        const scrollTop = sessionsList.scrollTop;
        
        // Calculate additional scroll needed for new sessions
        // Each session is 62px high with 8px gap
        const additionalScroll = newSessions.length * (62 + 8);
        
        // Refresh the list
        await showSessions();
        
        // Restore scroll position plus the height of new sessions
        sessionsList.scrollTop = scrollTop + additionalScroll;
        
        const importedCount = newSessions.length;
        const skippedCount = data.sessions.length - newSessions.length;
        const feedbackMessage = skippedCount > 0 ? 
          `Imported ${importedCount}, skipped ${skippedCount}` : 
          'Imported!';
        
        await showButtonFeedback('importSessions', feedbackMessage);
      } catch (error) {
        console.error('Error importing sessions:', error);
        await handleError(error, 'importSessions', 'Invalid file');
      }
      // Clear the input
      input.value = '';
    };
  } catch (error) {
    console.error('Error importing sessions:', error);
    await handleError(error, 'importSessions', 'Failed to import');
  }
}

/**
 * Creates a multi-stage button with confirmation
 * @param {Object} config - Configuration object
 * @param {string} config.buttonId - ID of the button element
 * @param {string} config.message - Message to show in confirmation stage
 * @param {string} config.confirmText - Text for confirm action
 * @param {string} config.cancelText - Text for cancel action
 * @param {string} config.icon - SVG string for the icon
 * @param {Function} config.onConfirm - Callback function when confirmed
 * @param {Function} config.onCancel - Optional callback function when cancelled
 */
function createMultiStageButton(config) {
  const button = document.getElementById(config.buttonId);
  if (!button) return;

  const originalContent = button.innerHTML;
  const originalClasses = [...button.classList];
  button.classList.add('multi-stage-button');

  // Handler for clicks outside the button
  function handleClickOutside(e) {
    if (!button.contains(e.target) && button.classList.contains('confirming')) {
      resetButton();
      document.removeEventListener('click', handleClickOutside);
    }
  }

  function showConfirmationStage() {
    if (button.classList.contains('confirming')) return;

    button.classList.add('confirming');
    button.innerHTML = `
      <div class="button-content-wrapper">
        <div class="stage-message">
          ${config.icon}
          <span class="stage-message-text">${config.message}</span>
        </div>
        <div class="stage-actions">
          <a class="stage-action cancel">${config.cancelText}</a>
          <a class="stage-action confirm">${config.confirmText}</a>
        </div>
      </div>
    `;

    const confirmBtn = button.querySelector('.stage-action.confirm');
    const cancelBtn = button.querySelector('.stage-action.cancel');

    // Add click-outside listener
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    confirmBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await config.onConfirm();
      } finally {
        resetButton();
        document.removeEventListener('click', handleClickOutside);
      }
    });

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (config.onCancel) config.onCancel();
      resetButton();
      document.removeEventListener('click', handleClickOutside);
    });
  }

  function resetButton() {
    // Reset to original classes
    button.className = originalClasses.join(' ');
    button.innerHTML = originalContent;
  }

  button.addEventListener('click', (e) => {
    if (!button.classList.contains('confirming')) {
      e.stopPropagation();
      showConfirmationStage();
    }
  });

  return {
    reset: resetButton
  };
}

// Function to handle clearing all sessions
async function clearSessions() {
  // The button is already initialized in DOMContentLoaded
  // This function is now just a placeholder as the multi-stage button handles everything
}

// Add event listeners when the DOM content is fully loaded
document.addEventListener('DOMContentLoaded', async function () {
  // Attach click event listeners to buttons
  document.getElementById('groupTabs').addEventListener('click', groupTabs);
  document.getElementById('closeDuplicates').addEventListener('click', closeDuplicates);
  document.getElementById('closeSelectedDuplicates').addEventListener('click', closeSelectedDuplicates);
  document.getElementById('copyTabURLs').addEventListener('click', copyTabURLs);
  document.getElementById('copyTabURLsGallery').addEventListener('click', copyTabURLsGallery);
  document.getElementById('randomizeTabs').addEventListener('click', randomizeTabs);
  document.getElementById('copySelectedTabs').addEventListener('click', copySelectedTabs);
  document.getElementById('copySelectedTabsGallery').addEventListener('click', copySelectedTabsGallery);
  document.getElementById('saveSession').addEventListener('click', saveSession);
  document.getElementById('showSessions').addEventListener('click', showSessions);
  document.getElementById('closeOverlay').addEventListener('click', hideSessionsOverlay);
  
  // Handle click on Generate URL List button
  document.getElementById('generate').addEventListener('click', async function() {
    try {
      // Send a message to the background script to generate and download URL list
      await chrome.runtime.sendMessage({ action: 'generateURLList' });
      await showButtonFeedback('generate', 'Exported!');
    } catch (error) {
      console.error('Error generating URL list:', error);
      await handleError(error, 'generate', 'Failed to export');
    }
  });

  // Handle click on Open URLs button
  document.getElementById('openUrls').addEventListener('click', async function() {
    try {
      const text = document.getElementById('urlList').value.trim();
      
      if (!text) {
        await showButtonFeedback('openUrls', 'No URLs', true);
        return;
      }

      const validUrls = extractUrls(text);
      
      if (validUrls.length === 0) {
        await showButtonFeedback('openUrls', 'No URLs', true);
        return;
      }

      // Open each valid URL in a new tab
      const openPromises = validUrls.map(url => chrome.tabs.create({ url }));
      await Promise.all(openPromises);
      
      await showButtonFeedback('openUrls', `Opened ${validUrls.length} tabs`);
    } catch (error) {
      console.error('Error opening URLs:', error);
      await handleError(error, 'openUrls', 'Failed to open URLs');
    }
  });

  // Handle click on Open URLs in New Window button
  document.getElementById('openUrlsInNewWindow').addEventListener('click', async function() {
    try {
      const text = document.getElementById('urlList').value.trim();
      
      if (!text) {
        await showButtonFeedback('openUrlsInNewWindow', 'No URLs', true);
        return;
      }

      const validUrls = extractUrls(text);
      
      if (validUrls.length === 0) {
        await showButtonFeedback('openUrlsInNewWindow', 'No URLs', true);
        return;
      }

      // Create a new window with the valid URLs
      await chrome.windows.create({ url: validUrls });
      await showButtonFeedback('openUrlsInNewWindow', `Opened ${validUrls.length} tabs`);
    } catch (error) {
      console.error('Error opening URLs in new window:', error);
      await handleError(error, 'openUrlsInNewWindow', 'Failed to open URLs');
    }
  });

  // Handle click on Copy URLs button
  document.getElementById('copyUrls').addEventListener('click', async function() {
    try {
      // Get the active tab in the current window
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we can access the tab
      if (!activeTab || !activeTab.url || !activeTab.url.startsWith('http')) {
        // This is an expected limitation, not an error
        await showButtonFeedback('copyUrls', `Can't copy from this page`, true);
        return;
      }

      // Store button content
      const button = document.getElementById('copyUrls');
      const originalContent = button.innerHTML;

      // Execute the content script in the active tab
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          // This function runs in the context of the web page
          const pageUrls = Array.from(document.querySelectorAll('a'))
            .map(a => a.href)
            .filter(url => url && url.startsWith('http'));
          
          return pageUrls;
        }
      }).then(async (results) => {
        const urls = results[0].result;
        await navigator.clipboard.writeText(urls.join('\n'));
        await showButtonFeedback('copyUrls', 'Copied!');
      });

    } catch (error) {
      // Only log actual unexpected errors
      if (!error.message.includes('Cannot access this page')) {
        console.error('Error executing content script:', error);
      }
      await showButtonFeedback('copyUrls', `Can't copy from this page`, true);
    }
  });

  // Add keyboard navigation for URL list
  const urlList = document.getElementById('urlList');
  const openUrlsBtn = document.getElementById('openUrls');
  const openUrlsNewWindowBtn = document.getElementById('openUrlsInNewWindow');

  urlList.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + Enter to open URLs in current window
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      openUrlsBtn.click();
    }
    // Ctrl/Cmd + Shift + Enter to open URLs in new window
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault();
      openUrlsNewWindowBtn.click();
    }
  });

  // Add tooltip for keyboard shortcuts
  urlList.title = 'Keyboard shortcuts:\nCtrl/Cmd + Enter: Open URLs in current window\nCtrl/Cmd + Shift + Enter: Open URLs in new window';

  // Make the textarea tab-accessible
  urlList.tabIndex = 0;

  // Add visual feedback for focus
  urlList.addEventListener('focus', function() {
    this.classList.add('focused');
  });

  urlList.addEventListener('blur', function() {
    this.classList.remove('focused');
  });

  // Add keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    // Skip shortcuts if typing in any text input or contentEditable element
    if (e.target.tagName === 'TEXTAREA' || 
        e.target.tagName === 'INPUT' || 
        e.target.contentEditable === 'true' ||
        e.target.closest('[contenteditable="true"]')) {
      return;
    }

    // Only handle single key presses (no modifiers)
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'v':
        document.getElementById('saveSession').click();
        break;
      case 'b':
        document.getElementById('showSessions').click();
        break;
      case 'g':
        document.getElementById('groupTabs').click();
        break;
      case 'r':
        document.getElementById('randomizeTabs').click();
        break;
      case 'd':
        document.getElementById('closeDuplicates').click();
        break;
      case 'f':
        document.getElementById('closeSelectedDuplicates').click();
        break;
      case 'a':
        document.getElementById('copyTabURLs').click();
        break;
      case 'q':
        document.getElementById('copyTabURLsGallery').click();
        break;
      case 's':
        document.getElementById('copySelectedTabs').click();
        break;
      case 'x':
        document.getElementById('copySelectedTabsGallery').click();
        break;
      case 'e':
        document.getElementById('generate').click();
        break;
      case 'l':
        document.getElementById('copyUrls').click();
        break;
      case 'o':
        document.getElementById('openUrls').click();
        break;
      case 'n':
        document.getElementById('openUrlsInNewWindow').click();
        break;
      case 'i':
        document.getElementById('importTabs').click();
        break;
      case 'p':
        document.getElementById('showSettings').click();
        break;
    }
  });

  // Handle click on Import button
  document.getElementById('importTabs').addEventListener('click', function() {
    document.getElementById('fileInput').click();
  });

  // Handle file selection
  document.getElementById('fileInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async function(event) {
        try {
          await chrome.runtime.sendMessage({
            action: 'importTabs',
            fileContent: event.target.result
          });
          
          await showButtonFeedback('importTabs', 'Imported!');
        } catch (error) {
          console.error('Error importing tabs:', error);
          await handleError(error, 'importTabs', 'Failed to import');
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Error reading file:', error);
      await handleError(error, 'importTabs', 'Failed to read file');
    }
  });

  // Load settings first
  await loadSettings();

  // Settings change handlers
  document.getElementById('prependRowEnabled').addEventListener('change', function(e) {
    settings.rows.prepend.enabled = e.target.checked;
    saveSettings();
  });

  document.getElementById('urlInputEnabled').addEventListener('change', function(e) {
    settings.rows.urlInput.enabled = e.target.checked;
    saveSettings();
  });

  document.getElementById('copyLinksEnabled').addEventListener('change', function(e) {
    settings.rows.copyLinks.enabled = e.target.checked;
    saveSettings();
  });

  document.getElementById('prependString').addEventListener('input', function(e) {
    settings.rows.prepend.settings.prependString = e.target.value;
    saveSettings();
  });

  // Settings button click handler
  document.getElementById('showSettings').addEventListener('click', showSettings);
  document.getElementById('closeSettings').addEventListener('click', hideSettings);

  // Session management buttons
  document.getElementById('exportSessions').addEventListener('click', exportSessions);
  document.getElementById('importSessions').addEventListener('click', importSessions);
  // Remove the click listener for clearSessions since the multi-stage button handles it
  // document.getElementById('clearSessions').addEventListener('click', clearSessions);

  // Initialize the clear sessions multi-stage button
  createMultiStageButton({
    buttonId: 'clearSessions',
    message: 'Are you sure?',
    confirmText: 'Clear',
    cancelText: 'Cancel',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>`,
    onConfirm: async () => {
      await chrome.storage.local.set({ sessions: [] });
      showSessions();
      await showButtonFeedback('clearSessions', 'Cleared!');
    }
  });
});

// Function to copy URLs of all tabs to clipboard
async function copyTabURLs() {
  try {
    // Query all open tabs in the current window
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    // Extract URLs from the tabs
    let tabURLs = tabs.map(tab => tab.url);

    // Copy the URLs to the clipboard
    await navigator.clipboard.writeText(tabURLs.join('\n'));
    
    await showButtonFeedback('copyTabURLs', 'Copied!');
  } catch (error) {
    console.error('Error copying URLs to clipboard:', error);
  }
}

// Function to copy selected tabs URLs to clipboard
async function copySelectedTabs() {
  try {
    // Query highlighted tabs in current window
    const highlightedTabs = await chrome.tabs.query({ highlighted: true, currentWindow: true });
    
    let urls;
    if (highlightedTabs.length > 1) {
      // Multiple tabs selected - copy all highlighted tab URLs
      urls = highlightedTabs.map(tab => tab.url).join('\n');
    } else {
      // Fallback to current active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      urls = activeTab.url;
    }

    // Copy to clipboard
    await navigator.clipboard.writeText(urls);
    
    await showButtonFeedback('copySelectedTabs', 'Copied!');
  } catch (error) {
    console.error('Error copying tabs:', error);
  }
}

// Function to copy selected tabs URLs with prepend string
async function copySelectedTabsGallery() {
  try {
    // Query highlighted tabs in current window
    const highlightedTabs = await chrome.tabs.query({ highlighted: true, currentWindow: true });
    
    let urls;
    if (highlightedTabs.length > 1) {
      // Multiple tabs selected - copy all highlighted tab URLs
      urls = highlightedTabs.map(tab => `${settings.rows.prepend.settings.prependString}${tab.url}`).join('\n');
    } else {
      // Fallback to current active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      urls = `${settings.rows.prepend.settings.prependString}${activeTab.url}`;
    }

    // Copy to clipboard
    await navigator.clipboard.writeText(urls);
    
    await showButtonFeedback('copySelectedTabsGallery', 'Copied!');
  } catch (error) {
    console.error('Error copying tabs:', error);
    await handleError(error, 'copySelectedTabsGallery', 'Failed to copy');
  }
}

// Function to copy all tab URLs with prepend string
async function copyTabURLsGallery() {
  try {
    // Query all open tabs in the current window
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    // Extract URLs from the tabs and add prepend string
    let tabURLs = tabs.map(tab => `${settings.rows.prepend.settings.prependString}${tab.url}`);

    // Copy the URLs to the clipboard
    await navigator.clipboard.writeText(tabURLs.join('\n'));
    
    await showButtonFeedback('copyTabURLsGallery', 'Copied!');
  } catch (error) {
    console.error('Error copying URLs to clipboard:', error);
    await handleError(error, 'copyTabURLsGallery', 'Failed to copy');
  }
}
