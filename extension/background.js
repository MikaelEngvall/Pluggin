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

  // Ignore chrome:// and chrome-extension:// URLs (e.g. popup, extensions page)
  // so that opening the popup doesn't reset the active domain tracking
  if (
    !domain ||
    domain.startsWith("chrome://") ||
    domain.startsWith("chrome-extension://")
  ) {
    return;
  }

  if (domain !== activeDomain) {
    // We switched to a real domain
    stopTrackingAndSend();
    activeDomain = domain;
    startTime = Date.now();
  }
}

// --- Tab Timers helpers ---

function alarmName(domain) {
  return "tab-timer::" + domain;
}

async function createTimer(domain, durationSeconds) {
  if (
    !Number.isInteger(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds > 86400
  ) {
    return { ok: false, error: "invalid_duration" };
  }

  // Replace existing timer for this domain
  await chrome.alarms.clear(alarmName(domain));
  await chrome.storage.local.remove(alarmName(domain));

  const now = Date.now();
  const endTime = now + durationSeconds * 1000;
  const record = {
    domain,
    startTime: now,
    durationMs: durationSeconds * 1000,
    endTime,
  };

  await chrome.storage.local.set({ [alarmName(domain)]: record });
  chrome.alarms.create(alarmName(domain), { when: endTime });

  return { ok: true };
}

async function cancelTimer(domain) {
  await chrome.alarms.clear(alarmName(domain));
  await chrome.storage.local.remove(alarmName(domain));
  return { ok: true };
}

// --- End Tab Timers helpers ---

// --- Alarm handler ---

async function handleAlarm(alarm) {
  if (!alarm.name.startsWith("tab-timer::")) return;

  const result = await chrome.storage.local.get(alarm.name);
  const record = result[alarm.name];
  if (!record) return;

  const domain = record.domain;
  chrome.notifications.create("tab-timer-notif::" + domain, {
    type: "basic",
    iconUrl: "icon.png",
    title: "Timer klar!",
    message: "Din timer för " + domain + " har löpt ut.",
  });

  await chrome.storage.local.remove(alarm.name);
}

chrome.alarms.onAlarm.addListener(handleAlarm);

// --- End Alarm handler ---

// --- Startup logic ---

async function initTimers() {
  const allItems = await chrome.storage.local.get(null);
  const timerEntries = Object.entries(allItems).filter(([key]) =>
    key.startsWith("tab-timer::")
  );

  const now = Date.now();

  for (const [key, record] of timerEntries) {
    const name = key; // same as alarmName(record.domain)

    if (record.endTime > now) {
      // Check if alarm still exists
      const existingAlarm = await chrome.alarms.get(name);
      if (!existingAlarm) {
        // Recreate the alarm
        chrome.alarms.create(name, { when: record.endTime });
      }
    } else {
      // Timer already expired – show notification and clean up
      chrome.notifications.create("tab-timer-notif::" + record.domain, {
        type: "basic",
        iconUrl: "icon.png",
        title: "Timer klar!",
        message: "Din timer för " + record.domain + " har löpt ut.",
      });
      await chrome.storage.local.remove(key);
    }
  }
}

initTimers();

// --- End Startup logic ---

// Export for testing (no-op in browser environment)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { alarmName, createTimer, cancelTimer, handleAlarm, initTimers };
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
  } else if (request.action === "createTimer") {
    createTimer(request.domain, request.durationSeconds).then(sendResponse);
    return true;
  } else if (request.action === "cancelTimer") {
    cancelTimer(request.domain).then(() => sendResponse({ ok: true }));
    return true;
  } else if (request.action === "getTimers") {
    chrome.storage.local.get(null, (items) => {
      const timers = Object.entries(items)
        .filter(([key]) => key.startsWith("tab-timer::"))
        .map(([, value]) => value);
      sendResponse({ timers });
    });
    return true;
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
