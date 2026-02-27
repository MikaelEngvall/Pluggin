// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const statsList = document.getElementById('statsList');

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
      if (result.data && result.data.length > 0) {
        statsList.classList.remove('hidden');
        
        let domainsData = [...result.data];

        // Combine live data with backend data
        if (liveData) {
          const existingDomain = domainsData.find(d => d.domain === liveData.domain);
          if (existingDomain) {
            existingDomain.total_seconds = parseInt(existingDomain.total_seconds, 10) + liveData.duration_seconds;
          } else {
            domainsData.push({ domain: liveData.domain, total_seconds: liveData.duration_seconds });
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
          timeSpan.textContent = formatTime(parseInt(item.total_seconds, 10));
          
          li.appendChild(domainSpan);
          li.appendChild(timeSpan);
          statsList.appendChild(li);
        });
      } else if (liveData) {
         // Show only live data if backend is empty
         statsList.classList.remove('hidden');
         const li = document.createElement('li');
         const domainSpan = document.createElement('span');
         domainSpan.className = 'domain';
         domainSpan.textContent = liveData.domain;
         const timeSpan = document.createElement('span');
         timeSpan.className = 'time';
         timeSpan.textContent = formatTime(liveData.duration_seconds);
         
         li.appendChild(domainSpan);
         li.appendChild(timeSpan);
         statsList.appendChild(li);
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
});
