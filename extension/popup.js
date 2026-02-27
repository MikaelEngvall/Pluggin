// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const statsList = document.getElementById('statsList');

  // Format seconds to a readable string (e.g. "1h 23m" or "45s")
  function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let timeString = [];
    if (hours > 0) timeString.push(`${hours}h`);
    if (minutes > 0) timeString.push(`${minutes}m`);
    if (hours === 0 && minutes === 0) timeString.push(`${seconds}s`);
    
    return timeString.join(' ');
  }

  // Fetch data from PHP backend
  fetch('http://localhost:8000/stats.php')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(result => {
      loadingEl.classList.add('hidden');
      if (result.data && result.data.length > 0) {
        statsList.classList.remove('hidden');
        
        result.data.forEach(item => {
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
