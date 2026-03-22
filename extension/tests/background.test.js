// Feature: tab-timers, Property 1: Ogiltig varaktighet avvisas alltid
// Validates: Requirements 1.3, 1.4

"use strict";

const fc = require("fast-check");

// --- Mock Chrome APIs before requiring background.js ---
const mockAlarmsCreate = jest.fn();
const mockAlarmsClear = jest.fn().mockResolvedValue(true);
const mockAlarmsGet = jest.fn().mockResolvedValue(null);
const mockStorageSet = jest.fn().mockResolvedValue(undefined);
const mockStorageRemove = jest.fn().mockResolvedValue(undefined);
const mockStorageGet = jest.fn().mockResolvedValue({});

global.chrome = {
  alarms: {
    create: mockAlarmsCreate,
    clear: mockAlarmsClear,
    get: mockAlarmsGet,
    onAlarm: { addListener: jest.fn() },
  },
  storage: {
    local: {
      set: mockStorageSet,
      remove: mockStorageRemove,
      get: mockStorageGet,
    },
  },
  runtime: {
    onMessage: { addListener: jest.fn() },
    lastError: null,
  },
  tabs: {
    onActivated: { addListener: jest.fn() },
    onUpdated: { addListener: jest.fn() },
  },
  notifications: {
    create: jest.fn(),
  },
};

const { createTimer, handleAlarm, cancelTimer, initTimers } = require("../background.js");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Property 1: Ogiltig varaktighet avvisas alltid", () => {
  // Generator for invalid durations:
  // - 0, negative integers, strings
  // - integers > 86400
  // - floats (non-integers) between 0.1 and 1439.9
  const invalidDurationArb = fc.oneof(
    fc.constant(0),
    fc.integer({ max: -1 }),
    fc.string(),
    fc.integer({ min: 86401 }),
    fc.float({ min: Math.fround(0.1), max: Math.fround(1439.9), noNaN: true })
  );

  test("returnerar { ok: false, error: 'invalid_duration' } för alla ogiltiga värden", async () => {
    await fc.assert(
      fc.asyncProperty(invalidDurationArb, async (invalidDuration) => {
        const result = await createTimer("example.com", invalidDuration);
        return result.ok === false && result.error === "invalid_duration";
      }),
      { numRuns: 100 }
    );
  });

  test("anropar INTE chrome.storage.local.set för ogiltiga värden", async () => {
    await fc.assert(
      fc.asyncProperty(invalidDurationArb, async (invalidDuration) => {
        mockStorageSet.mockClear();
        await createTimer("example.com", invalidDuration);
        return mockStorageSet.mock.calls.length === 0;
      }),
      { numRuns: 100 }
    );
  });

  test("anropar INTE chrome.alarms.create för ogiltiga värden", async () => {
    await fc.assert(
      fc.asyncProperty(invalidDurationArb, async (invalidDuration) => {
        mockAlarmsCreate.mockClear();
        await createTimer("example.com", invalidDuration);
        return mockAlarmsCreate.mock.calls.length === 0;
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: tab-timers, Property 2: createTimer sparar korrekt TimerRecord
// Validates: Requirements 1.5

describe("Property 2: createTimer sparar korrekt TimerRecord", () => {
  test("sparar TimerRecord med rätt domain, durationMs och endTime", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 1, max: 86400 }),
        async (domain, durationSeconds) => {
          mockStorageSet.mockClear();

          const before = Date.now();
          await createTimer(domain, durationSeconds);
          const after = Date.now();

          // Verify chrome.storage.local.set was called
          if (mockStorageSet.mock.calls.length !== 1) return false;

          const [storedObj] = mockStorageSet.mock.calls[0];
          const key = "tab-timer::" + domain;

          // Verify the key is correct
          if (!(key in storedObj)) return false;

          const record = storedObj[key];

          // Verify domain
          if (record.domain !== domain) return false;

          // Verify durationMs
          if (record.durationMs !== durationSeconds * 1000) return false;

          // Verify endTime is approximately Date.now() + durationSeconds * 1000 (±1000ms)
          const expectedEndTime = before + durationSeconds * 1000;
          const tolerance = 1000;
          if (
            record.endTime < expectedEndTime - tolerance ||
            record.endTime > after + durationSeconds * 1000 + tolerance
          ) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: tab-timers, Property 3: Alarm schemaläggs med korrekt tid
// Validates: Requirements 1.6, 6.3

describe("Property 3: Alarm schemaläggs med korrekt tid", () => {
  test("chrome.alarms.create anropas med rätt alarmnamn och when-värde lika med endTime", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 1, max: 86400 }),
        async (domain, durationSeconds) => {
          mockAlarmsCreate.mockClear();
          mockStorageSet.mockClear();

          await createTimer(domain, durationSeconds);

          // Verify chrome.alarms.create was called exactly once
          if (mockAlarmsCreate.mock.calls.length !== 1) return false;

          const [calledAlarmName, alarmOptions] = mockAlarmsCreate.mock.calls[0];

          // Verify alarm name
          if (calledAlarmName !== "tab-timer::" + domain) return false;

          // Verify chrome.storage.local.set was called to get the saved endTime
          if (mockStorageSet.mock.calls.length !== 1) return false;

          const [storedObj] = mockStorageSet.mock.calls[0];
          const key = "tab-timer::" + domain;
          if (!(key in storedObj)) return false;

          const record = storedObj[key];

          // Verify that the when value matches the endTime in the saved TimerRecord
          if (alarmOptions.when !== record.endTime) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: tab-timers, Property 7: En domän kan bara ha en aktiv timer
// Validates: Requirements 5.2

describe("Property 7: En domän kan bara ha en aktiv timer", () => {
  test("storage.set anropas 2 gånger totalt, alarms.clear anropas för domänen, och senaste anropet innehåller ny varaktighet", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 1, max: 86400 }),
        fc.integer({ min: 1, max: 86400 }),
        async (domain, duration1, duration2) => {
          mockStorageSet.mockClear();
          mockAlarmsClear.mockClear();

          await createTimer(domain, duration1);
          await createTimer(domain, duration2);

          // storage.local.set ska ha anropats totalt 2 gånger (en per createTimer)
          if (mockStorageSet.mock.calls.length !== 2) return false;

          // alarms.clear ska ha anropats för domänens alarmnamn (minst en gång)
          const expectedAlarmName = "tab-timer::" + domain;
          const clearedForDomain = mockAlarmsClear.mock.calls.some(
            ([name]) => name === expectedAlarmName
          );
          if (!clearedForDomain) return false;

          // Det senaste anropet till storage.set ska innehålla den nya varaktigheten
          const lastCall = mockStorageSet.mock.calls[mockStorageSet.mock.calls.length - 1];
          const [storedObj] = lastCall;
          const key = expectedAlarmName;
          if (!(key in storedObj)) return false;

          const record = storedObj[key];
          if (record.durationMs !== duration2 * 1000) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: tab-timers, Property 8: Uppstart återskapar alarm för timers vars sluttid är i framtiden
// Validates: Requirements 6.2, 6.3

describe("Property 8: Uppstart återskapar alarm för timers vars sluttid är i framtiden", () => {
  test("chrome.alarms.create anropas med korrekt when-värde när alarm saknas och endTime är i framtiden", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 1, max: 86400 }),
        async (domain, secondsRemaining) => {
          mockAlarmsCreate.mockClear();
          mockStorageGet.mockClear();
          mockAlarmsGet.mockClear();

          const now = Date.now();
          const endTime = now + secondsRemaining * 1000;
          const key = "tab-timer::" + domain;
          const record = {
            domain,
            startTime: now - 1000,
            durationMs: (secondsRemaining + 1) * 1000,
            endTime,
          };

          // Storage returns one timer record
          mockStorageGet.mockResolvedValueOnce({ [key]: record });
          // No existing alarm
          mockAlarmsGet.mockResolvedValueOnce(null);

          await initTimers();

          // alarms.create should have been called once with the correct when value
          if (mockAlarmsCreate.mock.calls.length !== 1) return false;

          const [calledName, options] = mockAlarmsCreate.mock.calls[0];
          if (calledName !== key) return false;
          if (options.when !== endTime) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("chrome.alarms.create anropas INTE om alarm redan finns", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 1, max: 86400 }),
        async (domain, secondsRemaining) => {
          mockAlarmsCreate.mockClear();
          mockStorageGet.mockClear();
          mockAlarmsGet.mockClear();

          const now = Date.now();
          const endTime = now + secondsRemaining * 1000;
          const key = "tab-timer::" + domain;
          const record = { domain, startTime: now - 1000, durationMs: (secondsRemaining + 1) * 1000, endTime };

          mockStorageGet.mockResolvedValueOnce({ [key]: record });
          // Alarm already exists
          mockAlarmsGet.mockResolvedValueOnce({ name: key, scheduledTime: endTime });

          await initTimers();

          return mockAlarmsCreate.mock.calls.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("visar notifikation och tar bort post om endTime redan passerat", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 1, max: 3600 }),
        async (domain, secondsAgo) => {
          mockAlarmsCreate.mockClear();
          mockStorageRemove.mockClear();
          jest.clearAllMocks();

          const now = Date.now();
          const endTime = now - secondsAgo * 1000;
          const key = "tab-timer::" + domain;
          const record = { domain, startTime: endTime - 1000, durationMs: 1000, endTime };

          mockStorageGet.mockResolvedValueOnce({ [key]: record });

          await initTimers();

          // Should NOT create a new alarm
          if (mockAlarmsCreate.mock.calls.length !== 0) return false;

          // Should show a notification
          if (chrome.notifications.create.mock.calls.length !== 1) return false;
          const [, notifOptions] = chrome.notifications.create.mock.calls[0];
          if (!notifOptions.message.includes(domain) && !notifOptions.title.includes(domain)) return false;

          // Should remove the storage entry
          if (mockStorageRemove.mock.calls.length !== 1) return false;
          if (mockStorageRemove.mock.calls[0][0] !== key) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: tab-timers, Property 5: Alarm-hanteraren visar notifikation med rätt innehåll och tar bort timern
// Validates: Requirements 3.1, 3.2, 3.3, 3.4

describe("Property 5: Alarm-hanteraren visar notifikation med rätt innehåll och tar bort timern", () => {
  test("notifications.create anropas med domännamnet och storage.remove anropas med rätt nyckel", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (domain) => {
          jest.clearAllMocks();

          const key = "tab-timer::" + domain;
          const record = {
            domain,
            startTime: Date.now() - 5000,
            durationMs: 5000,
            endTime: Date.now(),
          };

          // Mock storage.get to return the TimerRecord for this domain
          mockStorageGet.mockResolvedValueOnce({ [key]: record });

          await handleAlarm({ name: key });

          // Verify notifications.create was called
          if (chrome.notifications.create.mock.calls.length !== 1) return false;

          const [, notifOptions] = chrome.notifications.create.mock.calls[0];
          // Verify domain appears in title or message
          const domainInTitle = notifOptions.title && notifOptions.title.includes(domain);
          const domainInMessage = notifOptions.message && notifOptions.message.includes(domain);
          if (!domainInTitle && !domainInMessage) return false;

          // Verify storage.remove was called with the correct key
          if (mockStorageRemove.mock.calls.length !== 1) return false;
          if (mockStorageRemove.mock.calls[0][0] !== key) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: tab-timers, Property 6: cancelTimer rensar alarm och storage
// Validates: Requirements 4.3, 4.4

describe("Property 6: cancelTimer rensar alarm och storage", () => {
  test("alarms.clear och storage.remove anropas med rätt nyckel", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (domain) => {
          mockAlarmsClear.mockClear();
          mockStorageRemove.mockClear();

          await cancelTimer(domain);

          const key = "tab-timer::" + domain;

          // Verify alarms.clear was called with the correct alarm name
          if (mockAlarmsClear.mock.calls.length !== 1) return false;
          if (mockAlarmsClear.mock.calls[0][0] !== key) return false;

          // Verify storage.remove was called with the correct key
          if (mockStorageRemove.mock.calls.length !== 1) return false;
          if (mockStorageRemove.mock.calls[0][0] !== key) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Enhetstester: Uppstartslogik och manifest ---
// Validates: Requirements 6.2, 6.4, 7.1, 7.2, 7.3

describe("initTimers: läser storage och återskapar saknade alarm (krav 6.2)", () => {
  test("anropar alarms.create när alarm saknas och endTime är i framtiden", async () => {
    const domain = "example.com";
    const key = "tab-timer::" + domain;
    const endTime = Date.now() + 60000;
    const record = { domain, startTime: Date.now(), durationMs: 60000, endTime };

    mockStorageGet.mockResolvedValueOnce({ [key]: record });
    mockAlarmsGet.mockResolvedValueOnce(null);

    await initTimers();

    expect(mockAlarmsCreate).toHaveBeenCalledWith(key, { when: endTime });
  });
});

describe("initTimers: passerad sluttid ger notifikation och borttagning (krav 6.4)", () => {
  test("anropar notifications.create med domännamnet och storage.remove när endTime passerat", async () => {
    const domain = "expired.com";
    const key = "tab-timer::" + domain;
    const endTime = Date.now() - 5000;
    const record = { domain, startTime: endTime - 1000, durationMs: 1000, endTime };

    mockStorageGet.mockResolvedValueOnce({ [key]: record });

    await initTimers();

    expect(chrome.notifications.create).toHaveBeenCalled();
    const [, notifOptions] = chrome.notifications.create.mock.calls[0];
    expect(notifOptions.message).toContain(domain);

    expect(mockStorageRemove).toHaveBeenCalledWith(key);
  });
});

describe("manifest.json: behörigheter och host_permissions (krav 7.1–7.3)", () => {
  const fs = require("fs");
  const path = require("path");
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../extension/manifest.json"), "utf8")
  );

  test('permissions innehåller "alarms"', () => {
    expect(manifest.permissions).toContain("alarms");
  });

  test('permissions innehåller "notifications"', () => {
    expect(manifest.permissions).toContain("notifications");
  });

  test("host_permissions innehåller bara http://localhost:8000/*", () => {
    expect(manifest.host_permissions).toEqual(["http://localhost:8000/*"]);
  });
});
