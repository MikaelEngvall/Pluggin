// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const statsList = document.getElementById('statsList');
  const resetBtn = document.getElementById('resetApp');

  // Send delete request
  function deleteData(payload) {
    return fetch('http://localhost:8000/delete.php', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(res => {
       if(!res.ok) throw new Error("Delete failed");
       
       // Inform background script to reset active tracking if we delete
       chrome.runtime.sendMessage({ action: "resetTrackingData", domain: payload.domain || "ALL" });
       
       // Reload popup data
       location.reload();
    }).catch(err => {
      console.error(err);
      alert("Något gick fel vid raderingen.");
    });
  }

  // Format seconds to a readable string (e.g. "1h 23m" or "45s")
  function formatTime(totalSeconds) {
    if (totalSeconds < 60) return `${totalSeconds}s`;
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let timeString = [];
    if (hours > 0) timeString.push(`${hours}h`);
    if (minutes > 0) timeString.push(`${minutes}m`);
    if (seconds > 0 && hours === 0) timeString.push(`${seconds}s`);
    
    return timeString.join(' ');
  }

  // Live domain tracking for real-time counter
  let liveDomain = null;
  let liveBaseSeconds = 0;
  let liveStartTime = null; // Date.now() when background started tracking
  let statsInterval = null;

  // Fetch data from PHP backend and live stats from background script
  Promise.all([
    fetch('http://localhost:8000/stats.php').then(res => {
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    }),
    new Promise(resolve => {
      chrome.runtime.sendMessage({ action: "getCurrentTrackingData" }, response => resolve(response));
    })
  ])
    .then(([result, liveData]) => {
      loadingEl.classList.add('hidden');
      if (result.data && result.data.length > 0 || liveData) {
        if (result.data.length > 0 || liveData) {
            statsList.classList.remove('hidden');
            resetBtn.classList.remove('hidden');
        }
        
        let domainsData = [...result.data];

        // Combine live data with backend data
        if (liveData) {
          const existingDomain = domainsData.find(d => d.domain === liveData.domain);
          const backendSeconds = existingDomain ? parseInt(existingDomain.total_seconds, 10) : 0;

          // Store live tracking info for real-time updates
          liveDomain = liveData.domain;
          liveBaseSeconds = backendSeconds + liveData.duration_seconds;
          liveStartTime = Date.now() - liveData.duration_seconds * 1000;

          if (existingDomain) {
            existingDomain.total_seconds = liveBaseSeconds;
          } else {
            domainsData.push({ domain: liveData.domain, total_seconds: liveBaseSeconds });
          }
          
          // Re-sort array
          domainsData.sort((a, b) => parseInt(b.total_seconds, 10) - parseInt(a.total_seconds, 10));
        }
        
        domainsData.forEach(item => {
          const li = document.createElement('li');
          
          const domainSpan = document.createElement('span');
          domainSpan.className = 'domain';
          domainSpan.textContent = item.domain;
          domainSpan.title = item.domain; // tooltip
          
          const timeSpan = document.createElement('span');
          timeSpan.className = 'time';
          if (item.domain === liveDomain) {
            timeSpan.dataset.live = 'true'; // mark for live updates
          }
          timeSpan.textContent = formatTime(parseInt(item.total_seconds, 10));
          
          const delBtn = document.createElement('button');
          delBtn.className = 'delete-btn';
          delBtn.innerHTML = '&times;';
          delBtn.title = `Radera data för ${item.domain}`;
          delBtn.onclick = () => {
             if(confirm(`Vill du verkligen radera all statistisk för ${item.domain}?`)) {
                 deleteData({ domain: item.domain });
             }
          };
          
          li.appendChild(domainSpan);
          li.appendChild(timeSpan);
          li.appendChild(delBtn);
          statsList.appendChild(li);
        });

        // Start real-time counter for active domain
        if (liveDomain && liveStartTime) {
          statsInterval = setInterval(() => {
            const liveEl = statsList.querySelector('span.time[data-live="true"]');
            if (!liveEl) return;
            // liveBaseSeconds was set at liveStartTime, so current total = base + elapsed since then
            const currentTotal = liveBaseSeconds + Math.round((Date.now() - liveStartTime) / 1000);
            liveEl.textContent = formatTime(currentTotal);
          }, 1000);
        }
      } else {
        errorEl.textContent = "Ingen data samlad ännu. Surfa runt lite!";
        errorEl.classList.remove('hidden');
      }
    })
    .catch(err => {
      console.error('Fetch error:', err);
      loadingEl.classList.add('hidden');
      errorEl.classList.remove('hidden');
    });

  resetBtn.addEventListener('click', () => {
      if(confirm('Är du helt säker på att du vill radera ALL din insamlade surf-data?')) {
          deleteData({ clear_all: true });
      }
  });

  // --- Timer UI ---

  let timerInterval = null;

  function loadTimers() {
    chrome.runtime.sendMessage({ action: "getTimers" }, (response) => {
      const timers = (response && response.timers) ? response.timers : [];
      const timerList = document.getElementById('timer-list');
      const noTimers = document.getElementById('no-timers');
      const timerForm = document.getElementById('timer-form');

      // Clear interval before creating a new one
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }

      // Clear list and hide no-timers
      timerList.innerHTML = '';
      noTimers.classList.add('hidden');

      if (timers.length === 0) {
        noTimers.classList.remove('hidden');
        timerForm.classList.remove('hidden');
        return;
      }

      // Render each timer
      timers.forEach(timer => {
        const li = document.createElement('li');
        li.dataset.domain = timer.domain;

        const domainSpan = document.createElement('span');
        domainSpan.className = 'domain';
        domainSpan.textContent = timer.domain;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'timer-remaining';
        const remaining = Math.max(0, Math.round((timer.endTime - Date.now()) / 1000));
        timeSpan.textContent = formatTime(remaining);

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-timer-btn';
        cancelBtn.textContent = 'Avbryt';
        cancelBtn.onclick = () => cancelTimerForDomain(timer.domain);

        li.appendChild(domainSpan);
        li.appendChild(timeSpan);
        li.appendChild(cancelBtn);
        timerList.appendChild(li);
      });

      // Show/hide form based on whether active tab already has a timer
      chrome.runtime.sendMessage({ action: "getCurrentTrackingData" }, (liveData) => {
        const activeDomain = liveData && liveData.domain ? liveData.domain : null;
        const hasTimer = activeDomain && timers.some(t => t.domain === activeDomain);
        if (hasTimer) {
          timerForm.classList.add('hidden');
        } else {
          timerForm.classList.remove('hidden');
        }
      });

      // Start countdown interval
      timerInterval = setInterval(() => {
        const items = timerList.querySelectorAll('li[data-domain]');
        items.forEach(li => {
          const domain = li.dataset.domain;
          const timer = timers.find(t => t.domain === domain);
          if (!timer) return;
          const remaining = Math.max(0, Math.round((timer.endTime - Date.now()) / 1000));
          const span = li.querySelector('.timer-remaining');
          if (span) span.textContent = formatTime(remaining);
        });
      }, 1000);
    });
  }

  function startTimer() {
    const input = document.getElementById('timer-minutes');
    const errorEl = document.getElementById('timer-error');
    const minutes = parseInt(input.value, 10);

    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    if (!input.value || isNaN(minutes) || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      errorEl.textContent = 'Ange ett heltal mellan 1 och 1440 minuter.';
      errorEl.classList.remove('hidden');
      return;
    }

    // Ask background for the currently tracked domain instead of querying tabs
    // (tabs.query returns the popup itself as active tab)
    chrome.runtime.sendMessage({ action: "getCurrentTrackingData" }, (liveData) => {
      const domain = liveData && liveData.domain ? liveData.domain : null;
      if (!domain) {
        errorEl.textContent = 'Kunde inte hämta aktiv domän. Surfa till en sida först.';
        errorEl.classList.remove('hidden');
        return;
      }
      chrome.runtime.sendMessage(
        { action: "createTimer", domain, durationSeconds: minutes * 60 },
        () => { loadTimers(); }
      );
    });
  }

  function cancelTimerForDomain(domain) {
    chrome.runtime.sendMessage({ action: "cancelTimer", domain }, () => {
      loadTimers();
    });
  }

  document.getElementById('timer-start').addEventListener('click', startTimer);

  loadTimers();
});
