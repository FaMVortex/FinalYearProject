const yearSelect = document.getElementById('yearSelect');
const roundSelect = document.getElementById('roundSelect');
const sessionSelect = document.getElementById('sessionSelect');
const fetchSessionDataBtn = document.getElementById('fetchSessionDataBtn');

const compareModeCheckbox = document.getElementById('compareModeCheckbox');
const driverComparisonSection = document.getElementById('driverComparisonSection');
const driverSelect = document.getElementById('driverSelect');
const compareDriversBtn = document.getElementById('compareDriversBtn');
const resultsContainer = document.getElementById('resultsContainer');

// 1. On page load, fetch all available seasons
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/f1/seasons.json');
    const data = await res.json();
    const seasons = data.MRData.SeasonTable.Seasons;

    // Populate yearSelect
    yearSelect.innerHTML = '<option value="" selected>Select a year</option>';
    seasons.forEach(seasonObj => {
      const opt = document.createElement('option');
      opt.value = seasonObj.season;
      opt.textContent = seasonObj.season;
      yearSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Error fetching seasons:', err);
  }
});

// 2. When user selects a year, fetch all rounds for that year
yearSelect.addEventListener('change', async () => {
  const chosenYear = yearSelect.value;
  if (!chosenYear) return;

  roundSelect.disabled = true;
  roundSelect.innerHTML = '<option value="">Loading rounds...</option>';

  try {
    // e.g. /api/f1/2022.json
    const res = await fetch(`/api/f1/${chosenYear}.json`);
    const data = await res.json();
    const races = data.MRData.RaceTable.Races || [];

    roundSelect.innerHTML = '';
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

// 3. Fetch session data (Race, Qualifying, Sprint)
fetchSessionDataBtn.addEventListener('click', async () => {
  const chosenYear = yearSelect.value;
  const chosenRound = roundSelect.value;
  const sessionType = sessionSelect.value;

  if (!chosenYear || !chosenRound) {
    alert('Please select a valid year and round first.');
    return;
  }

  // Show a loading message
  resultsContainer.innerHTML = `<p>Loading ${sessionType} data for ${chosenYear}, round ${chosenRound}...</p>`;

  try {
    let fetchUrl = '';

    // Decide which endpoint to call based on sessionType
    if (sessionType === 'race') {
      fetchUrl = `/api/f1/${chosenYear}/${chosenRound}/results.json`;
    } else if (sessionType === 'qualifying') {
      fetchUrl = `/api/f1/${chosenYear}/${chosenRound}/qualifying.json`;
    } else if (sessionType === 'sprint') {
      // The new sprint endpoint that queries 'sprintresults' in your DB
      fetchUrl = `/api/f1/${chosenYear}/${chosenRound}/sprint.json`;
    } else {
      resultsContainer.innerHTML = `<p class="error">Unknown session type selected.</p>`;
      return;
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      // e.g. 404 or 500
      resultsContainer.innerHTML = `<p class="error">No data found for ${sessionType} (HTTP ${response.status}).</p>`;
      return;
    }

    const data = await response.json();

    // Render data based on session type
    switch (sessionType) {
      case 'race':
        displayRaceResults(data);
        break;
      case 'qualifying':
        displayQualifyingResults(data);
        break;
      case 'sprint':
        displaySprintResults(data);
        break;
      default:
        resultsContainer.innerHTML = `<p class="error">Unknown session type.</p>`;
        break;
    }
  } catch (err) {
    console.error('Error fetching session data:', err);
    resultsContainer.innerHTML = `<p class="error">Error loading ${sessionType} results.</p>`;
  }
});

// 4. Toggle comparison mode
compareModeCheckbox.addEventListener('change', async () => {
  if (compareModeCheckbox.checked) {
    driverComparisonSection.classList.remove('hidden');
    await loadDriversForSeason();
  } else {
    driverComparisonSection.classList.add('hidden');
  }
});

async function loadDriversForSeason() {
  const chosenYear = yearSelect.value;
  if (!chosenYear) {
    alert('Please select a season first to load drivers.');
    compareModeCheckbox.checked = false;
    driverComparisonSection.classList.add('hidden');
    return;
  }

  try {
    // e.g. /api/f1/2022/drivers.json
    const res = await fetch(`/api/f1/${chosenYear}/drivers.json`);
    const data = await res.json();
    const drivers = data.MRData.DriverTable.Drivers || [];

    driverSelect.innerHTML = '';
    drivers.forEach(d => {
      const option = document.createElement('option');
      option.value = d.driverId;
      option.textContent = `${d.givenName} ${d.familyName}`;
      driverSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading drivers for comparison:', err);
  }
}

// 5. Compare drivers (UPDATED)
compareDriversBtn.addEventListener('click', async () => {
  // Which drivers were selected?
  const selectedOptions = Array.from(driverSelect.selectedOptions).map(opt => opt.value);
  if (selectedOptions.length < 2 || selectedOptions.length > 4) {
    alert('Please select between 2 and 4 drivers for comparison.');
    return;
  }

  const chosenYear = yearSelect.value;
  const chosenRound = roundSelect.value;
  const sessionType = sessionSelect.value;

  if (!chosenYear || !chosenRound) {
    alert('Please select a valid year and round first.');
    return;
  }

  try {
    // Example of a single-round driver-results endpoint that you would create
    // This endpoint should return data for ONLY the chosenRound + session
    // e.g. "DriverResults": [{ Driver, position, points, status, etc. }, ...]
    const res = await fetch(`/api/f1/${chosenYear}/${chosenRound}/driverResults.json?session=${sessionType}`);
    if (!res.ok) {
      resultsContainer.innerHTML = `<p class="error">No driver comparison data found (HTTP ${res.status}).</p>`;
      return;
    }

    const data = await res.json();
    const allDriverResults = data.MRData?.DriverResults || [];

    // Now filter to only the selected drivers
    const filteredResults = allDriverResults.filter(d =>
      selectedOptions.includes(d.Driver.driverId)
    );

    // Display the comparison for just this single round/session
    displayDriverComparison(filteredResults);
  } catch (err) {
    console.error('Error comparing drivers:', err);
    resultsContainer.innerHTML = `<p class="error">Error loading driver comparison.</p>`;
  }
});

/* -------------------------------------------------
   Display Functions for Race, Qualifying, Sprint
   --------------------------------------------------*/

// Race
function displayRaceResults(apiData) {
  const raceTable = apiData?.MRData?.RaceTable;
  if (!raceTable || !raceTable.Races || !raceTable.Races.length) {
    resultsContainer.innerHTML = "<p>No race data found for this round.</p>";
    return;
  }

  const raceName = raceTable.raceName;
  const resultArray = raceTable.Races[0].Results || [];
  if (!resultArray.length) {
    resultsContainer.innerHTML = "<p>No race results available for this round.</p>";
    return;
  }

  let html = `<h2>${raceName} - Race Results</h2>`;
  html += `
    <table class="results-table">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Driver</th>
          <th>Constructor</th>
          <th>Points</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
  `;
  resultArray.forEach(res => {
    const driverName = `${res.Driver.givenName} ${res.Driver.familyName}`;
    html += `
      <tr>
        <td>${res.position}</td>
        <td>${driverName}</td>
        <td>${res.Constructor.name}</td>
        <td>${res.points}</td>
        <td>${res.status}</td>
      </tr>`;
  });
  html += `</tbody></table>`;
  resultsContainer.innerHTML = html;
}

// Qualifying
function displayQualifyingResults(apiData) {
  const qualTable = apiData?.MRData?.QualifyingTable;
  if (!qualTable || !qualTable.Races || !qualTable.Races.length) {
    resultsContainer.innerHTML = "<p>No qualifying data found for this round.</p>";
    return;
  }

  const raceName = qualTable.raceName;
  const resultArray = qualTable.Races[0].QualifyingResults || [];
  if (!resultArray.length) {
    resultsContainer.innerHTML = "<p>No qualifying results available for this round.</p>";
    return;
  }

  let html = `<h2>${raceName} - Qualifying Results</h2>`;
  html += `
    <table class="results-table">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Driver</th>
          <th>Constructor</th>
          <th>Q1</th>
          <th>Q2</th>
          <th>Q3</th>
        </tr>
      </thead>
      <tbody>
  `;
  resultArray.forEach(res => {
    const driverName = `${res.Driver.givenName} ${res.Driver.familyName}`;
    html += `
      <tr>
        <td>${res.position}</td>
        <td>${driverName}</td>
        <td>${res.Constructor.name}</td>
        <td>${res.q1 || '—'}</td>
        <td>${res.q2 || '—'}</td>
        <td>${res.q3 || '—'}</td>
      </tr>`;
  });
  html += `</tbody></table>`;
  resultsContainer.innerHTML = html;
}

// Sprint
function displaySprintResults(apiData) {
  const sprintTable = apiData?.MRData?.SprintTable;
  if (!sprintTable || !sprintTable.Races || !sprintTable.Races.length) {
    resultsContainer.innerHTML = "<p>No sprint data found for this round.</p>";
    return;
  }

  const raceName = sprintTable.raceName;
  const resultArray = sprintTable.Races[0].SprintResults || [];
  if (!resultArray.length) {
    resultsContainer.innerHTML = "<p>No sprint results available for this round.</p>";
    return;
  }

  let html = `<h2>${raceName} - Sprint Results</h2>`;
  html += `
    <table class="results-table">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Driver</th>
          <th>Constructor</th>
          <th>Points</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
  `;
  resultArray.forEach(res => {
    const driverName = `${res.Driver.givenName} ${res.Driver.familyName}`;
    html += `
      <tr>
        <td>${res.position}</td>
        <td>${driverName}</td>
        <td>${res.Constructor.name}</td>
        <td>${res.points}</td>
        <td>${res.status}</td>
      </tr>`;
  });
  html += `</tbody></table>`;
  resultsContainer.innerHTML = html;
}

/* -------------------------------------------------
   Updated Display for Driver Comparison
   --------------------------------------------------*/
function displayDriverComparison(driverData) {
  if (!driverData || !driverData.length) {
    resultsContainer.innerHTML = "<p>No driver comparison data found for this round.</p>";
    return;
  }

  let html = `<h2>Driver Comparison (Selected Round)</h2>`;
  html += `<table class="comparison-table">
    <thead>
      <tr>
        <th>Driver</th>
        <th>Position</th>
        <th>Points</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>`;

  driverData.forEach(d => {
    const driverName = `${d.Driver.givenName} ${d.Driver.familyName}`;
    html += `
      <tr>
        <td>${driverName}</td>
        <td>${d.position || 'N/A'}</td>
        <td>${d.points || '0'}</td>
        <td>${d.status || 'N/A'}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  resultsContainer.innerHTML = html;
}