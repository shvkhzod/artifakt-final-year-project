// Aina — Background Service Worker
// Handles context menus, keyboard shortcuts, saving, offline queue, and duplicate detection.

const API_BASE = 'http://localhost:5173';
const MAX_SAVED_URLS = 10000;
const QUEUE_ALARM_NAME = 'process-offline-queue';

// ---------------------------------------------------------------------------
// Context Menu Setup
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-page',
    title: 'Save page to Aina',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'save-image',
    title: 'Save image to Aina',
    contexts: ['image']
  });

  chrome.contextMenus.create({
    id: 'save-link',
    title: 'Save link to Aina',
    contexts: ['link']
  });

  chrome.contextMenus.create({
    id: 'save-selection',
    title: 'Save selection to Aina',
    contexts: ['selection']
  });

  // Set up periodic alarm to process offline queue
  chrome.alarms.create(QUEUE_ALARM_NAME, { periodInMinutes: 5 });
});

// ---------------------------------------------------------------------------
// Keyboard Shortcut
// ---------------------------------------------------------------------------

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-to-Aina') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await saveCurrentPage(tab);
    }
  }
});

// ---------------------------------------------------------------------------
// Context Menu Click Handler
// ---------------------------------------------------------------------------

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'save-page':
      await saveCurrentPage(tab);
      break;

    case 'save-image':
      await saveToAina({
        url: info.srcUrl,
        title: tab?.title || '',
        content: '',
        type: 'image',
        thumbnailUrl: info.srcUrl,
        note: ''
      });
      break;

    case 'save-link':
      await saveToAina({
        url: info.linkUrl,
        title: info.linkUrl,
        content: '',
        type: 'article',
        thumbnailUrl: '',
        note: ''
      });
      break;

    case 'save-selection':
      await saveToAina({
        url: tab?.url || '',
        title: tab?.title || '',
        content: info.selectionText || '',
        type: 'quote',
        thumbnailUrl: '',
        note: ''
      });
      break;
  }
});

// ---------------------------------------------------------------------------
// Message Listener (from popup / content scripts)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'save_current_page') {
    handleSaveFromPopup(message.tabId).then(sendResponse);
    return true; // keep channel open for async response
  }
});

async function handleSaveFromPopup(tabId) {
  try {
    const pageData = await chrome.tabs.sendMessage(tabId, { action: 'extract_page_data' });
    if (!pageData) {
      return { status: 'save_error' };
    }
    const result = await saveToAina({
      url: pageData.url,
      title: pageData.title,
      content: pageData.selectedText || pageData.content || '',
      type: pageData.selectedText ? 'quote' : pageData.type,
      thumbnailUrl: pageData.thumbnailUrl || '',
      note: ''
    });
    return result;
  } catch (err) {
    console.error('[Aina] Error saving from popup:', err);
    return { status: 'save_error' };
  }
}

// ---------------------------------------------------------------------------
// Save Current Page (via content script extraction)
// ---------------------------------------------------------------------------

async function saveCurrentPage(tab) {
  try {
    const pageData = await chrome.tabs.sendMessage(tab.id, { action: 'extract_page_data' });
    await saveToAina({
      url: pageData.url,
      title: pageData.title,
      content: pageData.content || '',
      type: pageData.type,
      thumbnailUrl: pageData.thumbnailUrl || '',
      note: ''
    });
  } catch (err) {
    console.error('[Aina] Failed to extract page data:', err);
    // Fallback: save with basic tab info
    await saveToAina({
      url: tab.url,
      title: tab.title,
      content: '',
      type: 'article',
      thumbnailUrl: '',
      note: ''
    });
  }
}

// ---------------------------------------------------------------------------
// Core Save Function
// ---------------------------------------------------------------------------

async function saveToAina(itemData) {
  // 1. Duplicate check
  if (itemData.url) {
    const isDuplicate = await checkDuplicate(itemData.url);
    if (isDuplicate) {
      showBadge('dup');
      return { status: 'already_saved' };
    }
  }

  // 2. POST to API
  try {
    const response = await fetch(`${API_BASE}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    // 3. Record in local index
    if (itemData.url) {
      await addToSavedUrls(itemData.url);
    }

    showBadge('ok');
    return { status: 'save_success', item: result };
  } catch (err) {
    console.error('[Aina] Network error, queuing:', err);

    // 4. Offline queue
    await addToQueue(itemData);
    showBadge('q');
    return { status: 'save_error', queued: true };
  }
}

// ---------------------------------------------------------------------------
// Badge Indicator
// ---------------------------------------------------------------------------

function showBadge(type) {
  const config = {
    ok: { text: '\u2713', color: '#009E73' },
    dup: { text: '\u2022', color: '#E69F00' },
    q: { text: '!', color: '#D55E00' }
  };
  const { text, color } = config[type] || config.ok;

  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });

  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 2500);
}

// ---------------------------------------------------------------------------
// Duplicate Detection
// ---------------------------------------------------------------------------

async function checkDuplicate(url) {
  const { savedUrls = [] } = await chrome.storage.local.get('savedUrls');
  return savedUrls.includes(url);
}

async function addToSavedUrls(url) {
  const { savedUrls = [] } = await chrome.storage.local.get('savedUrls');
  if (savedUrls.includes(url)) return;

  savedUrls.push(url);

  // FIFO eviction if over limit
  while (savedUrls.length > MAX_SAVED_URLS) {
    savedUrls.shift();
  }

  await chrome.storage.local.set({ savedUrls });
}

// ---------------------------------------------------------------------------
// Offline Queue Management
// ---------------------------------------------------------------------------

async function addToQueue(itemData) {
  const { offlineQueue = [] } = await chrome.storage.local.get('offlineQueue');
  offlineQueue.push({
    ...itemData,
    queuedAt: Date.now()
  });
  await chrome.storage.local.set({ offlineQueue });
}

async function processQueue() {
  const { offlineQueue = [] } = await chrome.storage.local.get('offlineQueue');
  if (offlineQueue.length === 0) return;

  const remaining = [];

  for (const item of offlineQueue) {
    try {
      const response = await fetch(`${API_BASE}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });

      if (response.ok) {
        // Successfully sent — record URL
        if (item.url) {
          await addToSavedUrls(item.url);
        }
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  await chrome.storage.local.set({ offlineQueue: remaining });
}

// Process queue on startup
chrome.runtime.onStartup.addListener(() => {
  processQueue();
});

// Process queue on alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === QUEUE_ALARM_NAME) {
    processQueue();
  }
});
