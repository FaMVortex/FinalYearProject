const yearSelect = document.getElementById('yearSelect');
const roundSelect = document.getElementById('roundSelect');
const sessionSelect = document.getElementById('sessionSelect');
const fetchSessionDataBtn = document.getElementById('fetchSessionDataBtn');

const compareModeCheckbox = document.getElementById('compareModeCheckbox');
const driverComparisonSection = document.getElementById('driverComparisonSection');
const driverSelect = document.getElementById('driverSelect');
const compareDriversBtn = document.getElementById('compareDriversBtn');
const resultsContainer = document.getElementById('resultsContainer');

window.selectedDriversFilter = [];

// 1. Load available seasons on page load
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/f1/seasons.json');
    const data = await res.json();
    const seasons = data.MRData.SeasonTable.Seasons;

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

// 2. When user selects a year, load the rounds for that year
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

// 3. Fetch session data (race, qualifying, sprint)
fetchSessionDataBtn.addEventListener('click', async () => {
  const chosenYear = yearSelect.value;
  const chosenRound = roundSelect.value;
  const sessionType = sessionSelect.value;

  if (!chosenYear || !chosenRound) {
    alert('Please select a valid year and round first.');
    return;
  }

  const fetchUrl = `/api/f1/${chosenYear}/${chosenRound}/${sessionType}.json`;

  resultsContainer.innerHTML = `<p>Loading ${sessionType} data for ${chosenYear}, round ${chosenRound}...</p>`;

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      resultsContainer.innerHTML = `<p class="error">No data found for ${sessionType} (HTTP ${response.status}).</p>`;
      return;
    }

    const data = await response.json();
    if (sessionType === 'race') displayRaceResults(data);
    else if (sessionType === 'qualifying') displayQualifyingResults(data);
    else if (sessionType === 'sprint') displaySprintResults(data);
    else resultsContainer.innerHTML = `<p class="error">Unknown session type.</p>`;
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
    window.selectedDriversFilter = [];
    fetchSessionDataBtn.click(); // reload full results
  }
});

// Load drivers for the chosen season
async function loadDriversForSeason() {
  const chosenYear = yearSelect.value;
  if (!chosenYear) {
    alert('Please select a season first to load drivers.');
    compareModeCheckbox.checked = false;
    driverComparisonSection.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch(`/api/f1/${chosenYear}/drivers.json`);
    const data = await res.json();
    const drivers = data.MRData.DriverTable.Drivers || [];

    driverSelect.innerHTML = '';
    drivers.forEach(d => {
      const option = document.createElement('option');
      option.value = d.driverId.toLowerCase(); // normalize to lowercase
      option.textContent = `${d.givenName} ${d.familyName}`;
      driverSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading drivers for comparison:', err);
  }
}

// 5. Apply the driver filter when "Apply Filter" is clicked
compareDriversBtn.addEventListener('click', () => {
  const selectedOptions = Array.from(driverSelect.selectedOptions).map(opt => opt.value.toLowerCase());
  if (selectedOptions.length < 2 || selectedOptions.length > 4) {
    alert('Please select between 2 and 4 drivers for comparison.');
    return;
  }

  window.selectedDriversFilter = selectedOptions;
  fetchSessionDataBtn.click();
});

// Display race results with filter
function displayRaceResults(apiData) {
  let resultArray = apiData?.MRData?.RaceTable?.Races[0]?.Results || [];

  console.log("Returned driverIds:", resultArray.map(r => r.Driver.driverId));
  console.log("Selected filter:", window.selectedDriversFilter);

  if (compareModeCheckbox.checked && window.selectedDriversFilter.length > 0) {
    resultArray = resultArray.filter(res =>
      window.selectedDriversFilter.includes(res.Driver.driverId.toLowerCase())
    );
  }
  renderTable(resultArray, "Race Results");
}

// Display qualifying results with filter
function displayQualifyingResults(apiData) {
  let resultArray = apiData?.MRData?.QualifyingTable?.Races[0]?.QualifyingResults || [];

  if (compareModeCheckbox.checked && window.selectedDriversFilter.length > 0) {
    resultArray = resultArray.filter(res =>
      window.selectedDriversFilter.includes(res.Driver.driverId.toLowerCase())
    );
  }
  renderTable(resultArray, "Qualifying Results");
}

// Display sprint results with filter
function displaySprintResults(apiData) {
  let resultArray = apiData?.MRData?.SprintTable?.Races[0]?.SprintResults || [];

  if (compareModeCheckbox.checked && window.selectedDriversFilter.length > 0) {
    resultArray = resultArray.filter(res =>
      window.selectedDriversFilter.includes(res.Driver.driverId.toLowerCase())
    );
  }
  renderTable(resultArray, "Sprint Results");
}

// Re-usable function that renders a simple table
function renderTable(results, title) {
  if (!results.length) {
    resultsContainer.innerHTML = `<p>No results available.</p>`;
    return;
  }

  let html = `<h2>${title}</h2>
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
      <tbody>`;

  results.forEach(res => {
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