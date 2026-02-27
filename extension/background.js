let activeTabId = null;
let activeDomain = null;
let startTime = null;

function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return null;
  }
}

function stopTrackingAndSend() {
  if (activeDomain && startTime) {
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

    // Only track if spent more than 1 second
    if (elapsedSeconds > 1) {
      console.log(
        `Sending data: ${activeDomain} for ${elapsedSeconds} seconds`,
      );

      fetch("http://localhost:8000/track.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain: activeDomain,
          duration_seconds: elapsedSeconds,
        }),
      }).catch((err) => console.error("Error tracking time:", err));
    }
  }
}

function handleTabChange(tabId, tabUrl) {
  const domain = getDomain(tabUrl);

  if (domain !== activeDomain) {
    // We switched domains (or tab)
    stopTrackingAndSend();

    // Start tracking new domain
    if (
      domain &&
      !domain.startsWith("chrome://") &&
      !domain.startsWith("chrome-extension://")
    ) {
      activeDomain = domain;
      startTime = Date.now();
    } else {
      activeDomain = null;
      startTime = null;
    }
  }
}

// Listener to return current tracked time to popup for live updating
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getCurrentTrackingData") {
    if (activeDomain && startTime) {
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
      sendResponse({
        domain: activeDomain,
        duration_seconds: elapsedSeconds
      });
    } else {
      sendResponse(null);
    }
  } else if (request.action === "resetTrackingData") {
     if (request.domain === "ALL" || request.domain === activeDomain) {
        // Reset the start timer so the zombie time doesn't get saved again
        startTime = Date.now();
     }
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) {
      return;
    }
    if (tab && tab.url) {
      handleTabChange(tab.id, tab.url);
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    handleTabChange(tabId, changeInfo.url);
  }
});
