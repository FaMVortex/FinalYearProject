// DOM Elements
const yearSelect = document.getElementById('year-select');
const raceSelect = document.getElementById('race-select');
const visualization = document.getElementById('visualization');

// Function to fetch and display driver standings
async function fetchDriverStandings(year) {
  const API_URL = `https://ergast.com/api/f1/${year}/driverStandings.json`;
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    return data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings;
  } catch (error) {
    console.error('Error fetching driver standings:', error);
    return [];
  }
}

// Function to fetch and populate races for a selected year
async function fetchRaces(year) {
  const API_URL = `https://ergast.com/api/f1/${year}.json`;
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

  raceSelect.disabled = false; // Enable the dropdown
}

// Function to fetch and display race results
async function fetchRaceResults(year, round) {
  const raceResultsURL = `https://ergast.com/api/f1/${year}/${round}/results.json`;

  try {
    const response = await fetch(raceResultsURL);
    const data = await response.json();
    const raceResults = data.MRData.RaceTable.Races[0];
    displayRaceResults(raceResults);
  } catch (error) {
    visualization.innerHTML = `<h2>Error loading race results. Please try again later.</h2>`;
    console.error('Error fetching race results:', error);
  }
}

// Function to display race results with points calculation
function displayRaceResults(race) {
  const results = race?.Results;

  if (!results) {
    visualization.innerHTML = `<h2>No results available for this race.</h2>`;
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
          <th>Time</th>
          <th>Status</th>
          <th>Points Awarded</th>
        </tr>
      </thead>
      <tbody>
  `;

  results.forEach((result) => {
    const { position, points, status, Driver, Constructor, Time } = result;

    const time = Time ? Time.time : 'N/A';
    const driverName = `${Driver.givenName} ${Driver.familyName}`;
    const constructorName = Constructor.name;

    // Points awarded in the race
    const pointsAwarded = parseFloat(points || 0);

    table += `
      <tr>
        <td>${position || 'N/A'}</td>
        <td>${driverName}</td>
        <td>${constructorName}</td>
        <td>${time}</td>
        <td>${status}</td>
        <td>${pointsAwarded}</td>
      </tr>
    `;
  });

  table += `</tbody></table>`;
  visualization.innerHTML = table;
}

// Function to populate year dropdown
function populateYearDropdown() {
  const currentYear = new Date().getFullYear();
  const earliestYear = 1950; // Start of F1

  for (let year = currentYear; year >= earliestYear; year--) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  }

  // Set the default year to the current year
  yearSelect.value = currentYear;

  // Fetch data for the default year
  fetchDriverStandings(currentYear);
  fetchRaces(currentYear);
}

// Event Listeners
yearSelect.addEventListener('change', (event) => {
  const selectedYear = event.target.value;
  visualization.innerHTML = `<h2>Loading...</h2>`;
  fetchDriverStandings(selectedYear);
  fetchRaces(selectedYear);
});

raceSelect.addEventListener('change', (event) => {
  const selectedRound = event.target.value;
  const selectedYear = yearSelect.value;

  if (selectedRound) {
    visualization.innerHTML = `<h2>Loading...</h2>`;
    fetchRaceResults(selectedYear, selectedRound);
  }
});

// Initialize the page
populateYearDropdown();