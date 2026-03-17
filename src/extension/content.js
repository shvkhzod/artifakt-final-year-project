// Aina — Content Script
// Extracts page metadata and selection data when requested by background or popup.

// ---------------------------------------------------------------------------
// Message Listener
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extract_page_data') {
    sendResponse(extractPageData());
    return;
  }

  if (message.action === 'get_selection') {
    sendResponse({
      selectedText: window.getSelection()?.toString() || null
    });
    return;
  }
});

// ---------------------------------------------------------------------------
// Page Data Extraction
// ---------------------------------------------------------------------------

function extractPageData() {
  return {
    url: window.location.href,
    title: document.title,
    content: getMetaDescription() || getFirstParagraph() || '',
    type: detectContentType(),
    thumbnailUrl: getOgImage() || getFirstImage() || '',
    selectedText: window.getSelection()?.toString() || null
  };
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Extracts the meta description from og:description or standard description tags.
 */
function getMetaDescription() {
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) return ogDesc.getAttribute('content');

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) return metaDesc.getAttribute('content');

  return null;
}

/**
 * Extracts the Open Graph image URL.
 */
function getOgImage() {
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    const url = ogImage.getAttribute('content');
    if (url) {
      // Handle relative URLs
      try {
        return new URL(url, window.location.href).href;
      } catch {
        return url;
      }
    }
  }
  return null;
}

/**
 * Finds the first meaningful image on the page (natural width > 200px).
 */
function getFirstImage() {
  const images = document.querySelectorAll('img');
  for (const img of images) {
    if (img.naturalWidth > 200 && img.src && !img.src.startsWith('data:')) {
      return img.src;
    }
  }
  return null;
}

/**
 * Finds the first paragraph with more than 50 characters of text.
 */
function getFirstParagraph() {
  const paragraphs = document.querySelectorAll('p');
  for (const p of paragraphs) {
    const text = p.textContent?.trim();
    if (text && text.length > 50) {
      return text;
    }
  }
  return null;
}

/**
 * Detects whether the page is primarily an image or an article.
 */
function detectContentType() {
  const url = window.location.href.toLowerCase();
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'];

  // Check if URL points directly to an image file
  for (const ext of imageExtensions) {
    if (url.endsWith(ext) || url.includes(ext + '?')) {
      return 'image';
    }
  }

  // Check if the page has very little text relative to images
  const bodyText = document.body?.innerText?.trim() || '';
  const images = document.querySelectorAll('img');
  if (bodyText.length < 200 && images.length > 0) {
    return 'image';
  }

  return 'article';
}
