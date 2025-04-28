// DOM references for session selection
const yearSelect        = document.getElementById('yearSelect');
const roundSelect       = document.getElementById('roundSelect');
const sessionSelect     = document.getElementById('sessionSelect');
const fetchSessionDataBtn = document.getElementById('fetchSessionDataBtn');
const resultsContainer  = document.getElementById('resultsContainer');

// DOM references for the new filter UI
const driverFilterSection   = document.getElementById('driverFilterSection');
const enableDriverFilter    = document.getElementById('enableDriverFilter');
const filterControls        = document.getElementById('filterControls');
const driverMultiCheckboxes = document.getElementById('driverMultiCheckboxes'); // NEW
const applyFilterBtn        = document.getElementById('applyFilterBtn');

const aiButton     = document.getElementById('ai-button');
const aiModal      = document.getElementById('ai-modal');
const closeAIModal = document.getElementById('close-ai-modal');
const presetQueries= document.getElementById('preset-queries');
const aiQueryInput = document.getElementById('ai-query');
const sendAIQuery  = document.getElementById('send-ai-query');
const aiResponseDiv= document.getElementById('ai-response');

// Keep track of the last session type and full results
let lastSessionType = null;
let lastResultsData = null;
let lastYear = null, lastRound = null;

/* ---------- 1. Load seasons on page load ---------- */
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/f1/seasons.json');
    const data = await res.json();
    const seasons = data.MRData.SeasonTable.Seasons || [];

    yearSelect.innerHTML = '<option value="" selected>Select a year</option>';
    seasons.forEach(seasonObj => {
      const opt = document.createElement('option');
      opt.value = seasonObj.season;
      opt.textContent = seasonObj.season;
      yearSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Error fetching seasons:', err);
    resultsContainer.innerHTML = '<p class="error">Failed to load seasons.</p>';
  }
});

/* ---------- 2. Load rounds when a year is picked ---------- */
yearSelect.addEventListener('change', async () => {
  const chosenYear = yearSelect.value;
  if (!chosenYear) return;

  roundSelect.disabled = true;
  roundSelect.innerHTML = '<option value="">Loading rounds...</option>';

  try {
    const res = await fetch(`/api/f1/${chosenYear}.json`);
    const data = await res.json();
    const races = data.MRData.RaceTable.Races || [];

    roundSelect.innerHTML = '<option value="" selected>Select a round</option>';
    races.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.round;
      opt.textContent = `Round ${r.round} - ${r.raceName}`;
      roundSelect.appendChild(opt);
    });
    roundSelect.disabled = false;
  } catch (err) {
    console.error('Error fetching rounds:', err);
    roundSelect.innerHTML = '<option value="">Error loading rounds</option>';
  }
});

/* ---------- 3. Fetch chosen session data ---------- */
fetchSessionDataBtn.addEventListener('click', async () => {
  const chosenYear   = yearSelect.value;
  const chosenRound  = roundSelect.value;
  const sessionType  = sessionSelect.value;

  if (!chosenYear || !chosenRound) {
    alert('Please select a valid year and round first.');
    return;
  }

  lastYear  = chosenYear;
  lastRound = chosenRound;

  aiButton.style.display = 'none';
  driverFilterSection.classList.add('hidden');
  resultsContainer.innerHTML = `<p>Loading ${sessionType} data for ${chosenYear}, round ${chosenRound}…</p>`;

  let fetchUrl = '';
  if (sessionType === 'race')        fetchUrl = `/api/f1/${chosenYear}/${chosenRound}/results.json`;
  else if (sessionType === 'qualifying') fetchUrl = `/api/f1/${chosenYear}/${chosenRound}/qualifying.json`;
  else if (sessionType === 'sprint')     fetchUrl = `/api/f1/${chosenYear}/${chosenRound}/sprint.json`;
  else {
    resultsContainer.innerHTML = '<p class="error">Unknown session type selected.</p>';
    return;
  }

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      resultsContainer.innerHTML = `<p class="error">No data found (HTTP ${response.status}).</p>`;
      return;
    }

    const data = await response.json();
    if (sessionType === 'race')        displayRaceResults(data);
    else if (sessionType === 'qualifying') displayQualifyingResults(data);
    else if (sessionType === 'sprint')     displaySprintResults(data);

    driverFilterSection.classList.remove('hidden');
    enableDriverFilter.checked = false;
    filterControls.classList.add('hidden');
  } catch (err) {
    console.error('Error fetching session data:', err);
    resultsContainer.innerHTML = `<p class="error">Error loading ${sessionType} results.</p>`;
  }
});

function onResultsRendered() {
  driverFilterSection.classList.remove('hidden');
  aiButton.style.display = 'block';
}

/* ---------- 4. Display helpers (unchanged except populate) ---------- */
function displayRaceResults(apiData) {
  const raceTable = apiData?.MRData?.RaceTable;
  if (!raceTable || !raceTable.Races.length) {
    resultsContainer.innerHTML = '<p>No race data found for this round.</p>';
    return;
  }
  const resultArray = raceTable.Races[0]?.Results || [];
  lastResultsData = resultArray;
  lastSessionType = 'race';
  renderResultsTable(resultArray, 'race');
  populateDriverMultiSelect(resultArray);
  onResultsRendered();
}

function displayQualifyingResults(apiData) {
  const qualTable = apiData?.MRData?.QualifyingTable;
  if (!qualTable || !qualTable.Races.length) {
    resultsContainer.innerHTML = '<p>No qualifying data found for this round.</p>';
    return;
  }
  const resultArray = qualTable.Races[0]?.QualifyingResults || [];
  lastResultsData = resultArray;
  lastSessionType = 'qualifying';
  renderResultsTable(resultArray, 'qualifying');
  populateDriverMultiSelect(resultArray);
  onResultsRendered();
}

function displaySprintResults(apiData) {
  const sprintTable = apiData?.MRData?.SprintTable;
  if (!sprintTable || !sprintTable.Races.length) {
    resultsContainer.innerHTML = '<p>No sprint data found for this round.</p>';
    return;
  }
  const resultArray = sprintTable.Races[0]?.SprintResults || [];
  lastResultsData = resultArray;
  lastSessionType = 'sprint';
  renderResultsTable(resultArray, 'sprint');
  populateDriverMultiSelect(resultArray);
  onResultsRendered();
}

/* ---------- 5. Render results table (unchanged) ---------- */
function renderResultsTable(dataArray, sessionType) {
  if (!dataArray?.length) {
    resultsContainer.innerHTML = '<p>No results to display.</p>';
    return;
  }
  let html = '';
  if (sessionType === 'race' || sessionType === 'sprint') {
    html = `
      <table class="results-table">
        <thead>
          <tr>
            <th>Pos</th><th>Driver</th><th>Constructor</th><th>Points</th><th>Status</th>
          </tr>
        </thead><tbody>`;
    dataArray.forEach(res => {
      const name = `${res.Driver.givenName} ${res.Driver.familyName}`;
      html += `<tr><td>${res.position}</td><td>${name}</td><td>${res.Constructor.name}</td><td>${res.points}</td><td>${res.status}</td></tr>`;
    });
    html += '</tbody></table>';
  } else if (sessionType === 'qualifying') {
    html = `
      <table class="results-table">
        <thead>
          <tr><th>Pos</th><th>Driver</th><th>Constructor</th><th>Q1</th><th>Q2</th><th>Q3</th></tr>
        </thead><tbody>`;
    dataArray.forEach(res => {
      const name = `${res.Driver.givenName} ${res.Driver.familyName}`;
      html += `<tr><td>${res.position}</td><td>${name}</td><td>${res.Constructor.name}</td><td>${res.q1||'—'}</td><td>${res.q2||'—'}</td><td>${res.q3||'—'}</td></tr>`;
    });
    html += '</tbody></table>';
  }
  resultsContainer.innerHTML = html;
}

/* ---------- 6. Filter-UI logic ---------- */
enableDriverFilter.addEventListener('change', () => {
  if (enableDriverFilter.checked) {
    filterControls.classList.remove('hidden');
  } else {
    filterControls.classList.add('hidden');
    renderResultsTable(lastResultsData, lastSessionType); // reset
  }
});

applyFilterBtn.addEventListener('click', () => {
  if (!enableDriverFilter.checked) return;

  const selectedDrivers = Array
    .from(document.querySelectorAll('#driverMultiCheckboxes input[type="checkbox"]:checked'))
    .map(cb => cb.value);

  if (selectedDrivers.length < 2 || selectedDrivers.length > 4) {
    alert('Please select between 2 and 4 drivers.');
    return;
  }

  const filtered = lastResultsData.filter(res => {
    const name = `${res.Driver.givenName} ${res.Driver.familyName}`;
    return selectedDrivers.includes(name);
  });

  renderResultsTable(filtered, lastSessionType);
});

/* ---------- 7. Populate checkbox list ---------- */
function populateDriverMultiSelect(resultsArray) {
  driverMultiCheckboxes.innerHTML = '';

  const uniqueNames = new Set(
    resultsArray.map(res => `${res.Driver.givenName} ${res.Driver.familyName}`)
  );

  uniqueNames.forEach(name => {
    const label   = document.createElement('label');
    const cb      = document.createElement('input');
    cb.type  = 'checkbox';
    cb.value = name;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(name));
    driverMultiCheckboxes.appendChild(label);
  });

  aiButton.classList.remove('hidden');
}

/* ---------- 8. AI modal (unchanged) ---------- */
aiButton.addEventListener('click', () => {
  aiModal.style.display = 'block';
  presetQueries.value   = '';
  aiQueryInput.value    = '';
  aiResponseDiv.textContent = '';
});

closeAIModal.addEventListener('click', e => {
  e.preventDefault();
  aiModal.style.display = 'none';
});

window.addEventListener('click', e => {
  if (e.target === aiModal) aiModal.style.display = 'none';
});

presetQueries.addEventListener('change', () => {
  aiQueryInput.value = presetQueries.value;
});

sendAIQuery.addEventListener('click', async () => {
  const q = aiQueryInput.value.trim();
  if (!q) return;
  aiResponseDiv.textContent = 'Loading…';
  try {
    const res = await fetch('/api/ai/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        season: `${lastYear} round ${lastRound}`,
        type: lastSessionType,
        query: q,
        data: lastResultsData
      })
    });
    aiResponseDiv.textContent = (await res.json()).response;
  } catch (err) {
    console.error(err);
    aiResponseDiv.textContent = 'Error fetching AI insights.';
  }
});