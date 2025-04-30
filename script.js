const yearSelect = document.getElementById('year-select');
const raceSelect = document.getElementById('race-select');
const visualization = document.getElementById('visualization');
const fullAnalysisLink = document.getElementById('fullAnalysisLink');

/**
 * Build the correct URL for the “Full Race Analysis” link.
 * If both season AND round are chosen we append them as query params.
 * Otherwise we fall back to the bare analysis page so the link is still usable.
 */
function updateAnalysisLink() {
  const season = yearSelect.value;
  const round  = raceSelect.value;

  fullAnalysisLink.href = (season && round)
    ? `full_race_analysis.html?season=${season}&round=${round}`
    : 'full_race_analysis.html';
}

// Initialise the link once on page load
updateAnalysisLink();

// Fetch list of races for a given year
async function fetchRaces(year) {
  const API_URL = `/api/f1/${year}.json`;
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    populateRaceDropdown(data);
  } catch (error) {
    console.error('Error fetching races:', error);
    raceSelect.innerHTML = `<option value="">Error loading races</option>`;
  }
}

// Populate race dropdown
function populateRaceDropdown(data) {
  const races = data.MRData.RaceTable.Races;

  if (!races.length) {
    raceSelect.innerHTML = `<option value="">No races available</option>`;
    raceSelect.disabled = true;
    return;
  }

  raceSelect.innerHTML = `<option value="">Select a race</option>`; // Default option
  races.forEach((race, index) => {
    const option = document.createElement('option');
    option.value = race.round;
    option.textContent = `${index + 1}. ${race.raceName}`;
    raceSelect.appendChild(option);
  });

  raceSelect.disabled = false;
}

// Function to fetch and display race results
async function fetchRaceResults(year, round) {
  const raceResultsURL = `/api/f1/${year}/${round}/results.json`;

  try {
    const response = await fetch(raceResultsURL);
    const data = await response.json();
    console.log("DEBUG: API Response:", data);
    const raceResults = data.MRData.RaceTable.Races[0];
    displayRaceResults(raceResults);
  } catch (error) {
    console.error('Error fetching race results:', error);
    visualization.innerHTML = `<h2>Error loading race results. Please try again later.</h2>`;
  }
}

// Function to display race results
function displayRaceResults(race) {
  const results = race?.Results || [];
  if (results.length === 0) {
    visualization.innerHTML = `<h2>No race results found for this round.</h2>`;
    return;
  }

  let table = `
    <h2>${race.raceName} (${race.season}, Round ${race.round})</h2>
    <table>
      <thead>
        <tr>
          <th>Position</th>
          <th>Driver</th>
          <th>Constructor</th>
          <th>Status</th>
          <th>Points</th>
        </tr>
      </thead>
      <tbody>
  `;

  results.forEach((result) => {
    const { position, points, status, Driver, Constructor } = result;
    const driverName = `${Driver.givenName} ${Driver.familyName}`;

    table += `
      <tr>
        <td>${position || 'N/A'}</td>
        <td>${driverName}</td>
        <td>${Constructor.name}</td>
        <td>${status}</td>
        <td>${points}</td>
      </tr>
    `;
  });

  table += `</tbody></table>`;
  visualization.innerHTML = table;
}

// Function to populate year dropdown
function populateYearDropdown() {
  const currentYear = new Date().getFullYear();
  const earliestYear = 1950;

  for (let year = currentYear; year >= earliestYear; year--) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  }

  // set the default year
  yearSelect.value = 2024;
  fetchRaces(2024); // optionally auto-load
}

// Event Listeners
yearSelect.addEventListener('change', async (event) => {
  const selectedYear = event.target.value;
  visualization.innerHTML = `<h2>Loading...</h2>`;
  await fetchRaces(selectedYear);
  raceSelect.value = "";          
  updateAnalysisLink();           
});

raceSelect.addEventListener('change', async (event) => {
  const selectedRound = event.target.value;
  const selectedYear = yearSelect.value;

  if (selectedRound) {
    visualization.innerHTML = `<h2>Loading...</h2>`;
    await fetchRaceResults(selectedYear, selectedRound);
  }
  updateAnalysisLink();
});

// Initialize the page
populateYearDropdown();