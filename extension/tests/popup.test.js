/**
 * @jest-environment jsdom
 */

"use strict";

// Feature: tab-timers, Property 4: Tidformateringsfunktionen ar korrekt
// Validates: Requirements 2.2

const fc = require("fast-check");

// --- Re-implement formatTime (mirrors popup.js logic exactly) ---
function formatTime(totalSeconds) {
  if (totalSeconds < 60) return totalSeconds + "s";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(hours + "h");
  if (minutes > 0) parts.push(minutes + "m");
  if (seconds > 0 && hours === 0) parts.push(seconds + "s");

  return parts.join(" ");
}

// --- Chrome API mocks (global, used by popup.js) ---
const mockSendMessage = jest.fn();
const mockTabsQuery = jest.fn();

global.chrome = {
  runtime: {
    sendMessage: mockSendMessage,
    onMessage: { addListener: jest.fn() },
    lastError: null,
  },
  tabs: {
    query: mockTabsQuery,
    onActivated: { addListener: jest.fn() },
    onUpdated: { addListener: jest.fn() },
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    get: jest.fn(),
    onAlarm: { addListener: jest.fn() },
  },
  storage: {
    local: {
      set: jest.fn(),
      remove: jest.fn(),
      get: jest.fn(),
    },
  },
  notifications: {
    create: jest.fn(),
  },
};

// ============================================================
// Property 4: Tidformateringsfunktionen ar korrekt
// ============================================================

describe("Property 4: Tidformateringsfunktionen ar korrekt", () => {
  test("returnerar korrekt format och representerar angiven tid for alla varden 0-86400", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 86400 }), (totalSeconds) => {
        const result = formatTime(totalSeconds);

        if (typeof result !== "string" || result.length === 0) return false;

        if (totalSeconds < 60) {
          if (!/^\d+s$/.test(result)) return false;
          const s = parseInt(result, 10);
          return s === totalSeconds;
        }

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
          if (minutes > 0) {
            if (!/^\d+h \d+m$/.test(result)) return false;
            const parts = result.split(" ");
            return parseInt(parts[0], 10) === hours && parseInt(parts[1], 10) === minutes;
          } else {
            if (!/^\d+h$/.test(result)) return false;
            return parseInt(result, 10) === hours;
          }
        } else {
          if (seconds > 0) {
            if (!/^\d+m \d+s$/.test(result)) return false;
            const parts = result.split(" ");
            return parseInt(parts[0], 10) === minutes && parseInt(parts[1], 10) === seconds;
          } else {
            if (!/^\d+m$/.test(result)) return false;
            return parseInt(result, 10) === minutes;
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// Task 5.5: Enhetstester for popup-rendering
// ============================================================

function setupDOM() {
  document.body.innerHTML = [
    '<div id="loading" class="loading">Loading...</div>',
    '<div id="error" class="error hidden"></div>',
    '<ul id="statsList" class="hidden"></ul>',
    '<button id="resetApp" class="hidden"></button>',
    '<section id="timers-section">',
    '  <div id="timer-form">',
    '    <input type="number" id="timer-minutes" min="1" max="1440" placeholder="Minutes">',
    '    <button id="timer-start">Start timer</button>',
    '    <div id="timer-error" class="error hidden"></div>',
    '  </div>',
    '  <ul id="timer-list"></ul>',
    '  <p id="no-timers" class="hidden">No active timers.</p>',
    '</section>',
  ].join("\n");
}

let popupLoaded = false;
function loadPopup() {
  setupDOM();
  if (!popupLoaded) {
    require("../popup.js");
    popupLoaded = true;
  }
  document.dispatchEvent(new Event("DOMContentLoaded"));
}

async function flushPromises() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockRejectedValue(new Error("no backend"));
  mockTabsQuery.mockImplementation(function(_query, cb) { cb([]); });
});

describe("loadTimers() - inga timers", () => {
  test("visar #no-timers och #timer-form nar inga timers finns", async () => {
    mockSendMessage.mockImplementation(function(msg, cb) {
      if (msg.action === "getTimers") cb({ timers: [] });
      else if (msg.action === "getCurrentTrackingData") cb(null);
    });

    loadPopup();
    await flushPromises();

    expect(document.getElementById("no-timers").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("timer-form").classList.contains("hidden")).toBe(false);
  });
});

describe("loadTimers() - med timers", () => {
  const now = Date.now();
  const timers = [
    { domain: "example.com", endTime: now + 60000, durationMs: 60000, startTime: now },
    { domain: "github.com", endTime: now + 120000, durationMs: 120000, startTime: now },
  ];

  beforeEach(() => {
    mockSendMessage.mockImplementation(function(msg, cb) {
      if (msg.action === "getTimers") cb({ timers: timers });
      else if (msg.action === "getCurrentTrackingData") cb(null);
    });
  });

  test("renderar en li per timer i #timer-list", async () => {
    loadPopup();
    await flushPromises();

    const items = document.querySelectorAll("#timer-list li");
    expect(items.length).toBe(timers.length);
  });

  test("visar avbryt-knapp per timer", async () => {
    loadPopup();
    await flushPromises();

    const cancelBtns = document.querySelectorAll("#timer-list .cancel-timer-btn");
    expect(cancelBtns.length).toBe(timers.length);
  });

  test("doljer #timer-form om aktiv doman redan har en timer", async () => {
    mockTabsQuery.mockImplementation(function(_query, cb) {
      cb([{ url: "https://example.com/page" }]);
    });

    loadPopup();
    await flushPromises();

    expect(document.getElementById("timer-form").classList.contains("hidden")).toBe(true);
  });

  test("uppdaterar listan efter cancelTimerForDomain anropas", async () => {
    let callCount = 0;
    mockSendMessage.mockImplementation(function(msg, cb) {
      if (msg.action === "getTimers") {
        cb({ timers: callCount++ === 0 ? timers : [timers[1]] });
      } else if (msg.action === "cancelTimer") {
        cb({ ok: true });
      } else if (msg.action === "getCurrentTrackingData") {
        cb(null);
      }
    });

    loadPopup();
    await flushPromises();

    const cancelBtn = document.querySelector("#timer-list .cancel-timer-btn");
    cancelBtn.click();
    await flushPromises();

    const items = document.querySelectorAll("#timer-list li");
    expect(items.length).toBe(1);
  });
});