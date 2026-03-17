// Aina — Popup Script
// Triggers a save on open and transitions between UI states.

// ---------------------------------------------------------------------------
// State Management
// ---------------------------------------------------------------------------

function showState(stateId) {
  document.querySelectorAll('.state').forEach((el) => {
    el.hidden = true;
  });
  document.getElementById(stateId).hidden = false;
}

function autoClose(ms = 2500) {
  setTimeout(() => window.close(), ms);
}

// ---------------------------------------------------------------------------
// Tag Rendering
// ---------------------------------------------------------------------------

const TAG_COLORS = ['amber', 'cyan', 'emerald', 'blue', 'vermillion', 'mauve'];

function renderTags(tags) {
  const container = document.getElementById('detected-tags');
  if (!container || !tags || tags.length === 0) return;

  container.innerHTML = '';
  for (let i = 0; i < tags.length; i++) {
    const pill = document.createElement('span');
    const colorVariant = TAG_COLORS[i % TAG_COLORS.length];
    pill.className = `tag tag--${colorVariant}`;
    pill.textContent = tags[i];
    container.appendChild(pill);
  }
}

// ---------------------------------------------------------------------------
// Handle Response from Background
// ---------------------------------------------------------------------------

function handleResponse(response) {
  if (!response) {
    showState('state-error');
    autoClose(3000);
    return;
  }

  switch (response.status) {
    case 'save_success':
      showState('state-success');
      // Mock detected tags until AI tagging is wired up
      renderTags(['design', 'article', 'minimalism']);
      autoClose(2500);
      break;

    case 'already_saved':
      showState('state-duplicate');
      autoClose(2000);
      break;

    case 'save_error':
      if (!navigator.onLine) {
        showState('state-offline');
      } else {
        showState('state-error');
      }
      autoClose(3000);
      break;

    default:
      showState('state-error');
      autoClose(3000);
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

async function init() {
  showState('state-saving');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      showState('state-error');
      autoClose(3000);
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: 'save_current_page',
      tabId: tab.id
    });

    handleResponse(response);
  } catch (err) {
    console.error('[Aina] Popup error:', err);
    showState('state-error');
    autoClose(3000);
  }
}

document.addEventListener('DOMContentLoaded', init);
