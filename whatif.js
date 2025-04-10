const seasonSelect = document.getElementById('seasonSelect');
const raceList = document.getElementById('raceList');
const raceEditor = document.getElementById('raceEditor');
const scenarioStatus = document.getElementById('scenarioStatus');
const pointsSystemSelect = document.getElementById('pointsSystemSelect');

let currentScenarioId = null;
let currentSeason = null;

const pointsSystems = {
  current:  [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], // modern system
  pre2003:  [10,  6,  4,  3,   2, 1], // old top 6 system
  classic:  [9,   6,  4,  3,   2, 1], // early 2000s top 6, or older top 8 with 9 for a win
};

let scenarioData = {
  scenarioId: null,
  scenarioName: null,
  season: null,
  overrides: {}
};

fetch('/api/f1/seasons.json')
  .then(r => r.json())
  .then(data => {
    const seasons = data.MRData.SeasonTable.Seasons;
    seasons.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.season;
      opt.textContent = s.season;
      seasonSelect.appendChild(opt);
    });
  })
  .catch(err => {
    console.error('Error fetching seasons:', err);
  });

document.getElementById('btnCreateScenario').addEventListener('click', () => {
  currentSeason = seasonSelect.value;
  const scenarioName = prompt("Enter a name for your scenario:", `My WhatIf for ${currentSeason}`);
  if (!scenarioName) return;

  fetch('/api/f1/whatif/newScenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioName, season: currentSeason })
  })
    .then(r => r.json())
    .then(result => {
      if (result.scenarioId) {
        currentScenarioId = result.scenarioId;
        scenarioStatus.textContent = `Scenario #${currentScenarioId} created!`;

        scenarioData.scenarioId = currentScenarioId;
        scenarioData.scenarioName = scenarioName;
        scenarioData.season = currentSeason;
        scenarioData.overrides = {};

        loadRacesForSeason(currentSeason);
      } else {
        scenarioStatus.textContent = `Error: ${JSON.stringify(result)}`;
      }
    })
    .catch(err => {
      scenarioStatus.textContent = 'Error creating scenario!';
      console.error(err);
    });
});

function loadRacesForSeason(season) {
  raceList.innerHTML = '';
  fetch(`/api/f1/${season}.json`)
    .then(r => r.json())
    .then(data => {
      const races = data.MRData.RaceTable.Races;
      races.forEach(r => {
        const btn = document.createElement('button');
        btn.textContent = `Round ${r.round}: ${r.raceName}`;
        btn.className = 'analysis-button';
        btn.addEventListener('click', () => loadRaceResults(season, r.round));
        raceList.appendChild(btn);
        raceList.appendChild(document.createElement('br'));
      });
    })
    .catch(err => {
      console.error('Error loading race list:', err);
    });
}

function loadRaceResults(season, round) {
  raceEditor.innerHTML = `Loading results for Round ${round}...`;
  fetch(`/api/f1/${season}/${round}/results.json`)
    .then(r => r.json())
    .then(data => {
      const raceTable = data.MRData.RaceTable;
      const results = raceTable.Races[0].Results;
      const dbRaceId = raceTable.raceId; // numeric raceId
      showRaceEditor(results, raceTable.Races[0].raceName, round, dbRaceId);
    })
    .catch(err => {
      console.error('Error loading race results:', err);
      raceEditor.innerHTML = 'Error loading race results.';
    });
}

function showRaceEditor(results, raceName, round, dbRaceId) {
  raceEditor.innerHTML = `<h4>${raceName} (Round ${round})</h4>`;

  const table = document.createElement('table');
  const header = document.createElement('tr');
  header.innerHTML = `
    <th>Position</th>
    <th>Driver</th>
    <th>Points (Auto + FL?)</th>
    <th>Fastest Lap?</th>
    <th>Move Up/Down</th>
  `;
  table.appendChild(header);

  // Sort by finishing pos
  results.sort((a,b) => parseInt(a.position) - parseInt(b.position));

  // local array
  let localResults = results.map(r => ({
    driverId: r.Driver.driverId,
    driverName: r.Driver.givenName + ' ' + r.Driver.familyName,
    fastestLap: false
  }));

  const rebuild = () => {
    while (table.children.length > 1) {
      table.removeChild(table.lastChild);
    }

    // figure out which points system is selected
    const systemChoice = pointsSystemSelect.value;  
    let pointsMap = pointsSystems[systemChoice];
    if (!pointsMap) {
      pointsMap = pointsSystems.current; // fallback if unknown
    }

    localResults.forEach((row, idx) => {
      const tr = document.createElement('tr');
      // base points for finishing position
      const basePoints = idx < pointsMap.length ? pointsMap[idx] : 0;
      const flBonus = (row.fastestLap && idx < pointsMap.length) ? 1 : 0;
      const totalPoints = basePoints + flBonus;

      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${row.driverName}</td>
        <td>${totalPoints}</td>
        <td>
          <input type="checkbox" class="fastestLapCheck" ${row.fastestLap ? 'checked' : ''}/>
        </td>
        <td>
          <button class="btnUp">&uarr;</button>
          <button class="btnDown">&darr;</button>
        </td>
      `;
      table.appendChild(tr);

      // handle fastest lap check
      const flCheckbox = tr.querySelector('.fastestLapCheck');
      flCheckbox.addEventListener('change', ev => {
        if (ev.target.checked) {
          // uncheck for everyone else
          localResults.forEach(d => d.fastestLap = false);
          row.fastestLap = true;
        } else {
          row.fastestLap = false;
        }
        rebuild();
      });

      // move up/down
      const btnUp = tr.querySelector('.btnUp');
      const btnDown = tr.querySelector('.btnDown');
      btnUp.addEventListener('click', () => {
        if (idx > 0) {
          const temp = localResults[idx-1];
          localResults[idx-1] = localResults[idx];
          localResults[idx] = temp;
          rebuild();
        }
      });
      btnDown.addEventListener('click', () => {
        if (idx < localResults.length - 1) {
          const temp = localResults[idx+1];
          localResults[idx+1] = localResults[idx];
          localResults[idx] = temp;
          rebuild();
        }
      });
    });
  };
  rebuild();
  raceEditor.appendChild(table);

  // Save (override) to server
  const btnSave = document.createElement('button');
  btnSave.className = 'analysis-button';
  btnSave.textContent = 'Save Overridden Results (Server)';
  btnSave.onclick = () => {
    // again, get the points system
    const systemChoice = pointsSystemSelect.value;
    let pointsMap = pointsSystems[systemChoice] || pointsSystems.current;

    const updated = localResults.map((r, idx) => {
      const basePoints = idx < pointsMap.length ? pointsMap[idx] : 0;
      const flBonus = (r.fastestLap && idx < pointsMap.length) ? 1 : 0;
      return {
        driverId: r.driverId,
        position: idx + 1,
        points: basePoints + flBonus
      };
    });
    scenarioData.overrides[dbRaceId] = updated;

    saveOverriddenResultsToServer(updated, dbRaceId);
  };
  raceEditor.appendChild(btnSave);
}

// actual POST to server
function saveOverriddenResultsToServer(newResults, dbRaceId) {
  if (!currentScenarioId) {
    alert('No scenario created yet!');
    return;
  }
  fetch(`/api/f1/whatif/scenario/${currentScenarioId}/updateRaceResults`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      raceId: dbRaceId,
      results: newResults
    })
  })
    .then(r => r.json())
    .then(resp => {
      alert('Overrides saved to server!');
    })
    .catch(err => {
      console.error(err);
      alert('Error saving overrides');
    });
}

document.getElementById('btnGetDriverStandings')
  .addEventListener('click', () => {
    if (!currentScenarioId) {
      alert('No scenario created yet!');
      return;
    }
    fetch(`/api/f1/whatif/scenario/${currentScenarioId}/driverStandings`)
      .then(r => r.json())
      .then(data => {
        const arr = data.driverStandings;
        let html = `<h4>Scenario #${data.scenarioId} - Driver Standings</h4><ol>`;
        arr.forEach(item => {
          html += `<li>${item.driverName} - ${item.points} pts</li>`;
        });
        html += '</ol>';
        document.getElementById('standingsDisplay').innerHTML = html;
      })
      .catch(err => {
        console.error(err);
      });
  });

document.getElementById('btnGetConstructorStandings')
  .addEventListener('click', () => {
    if (!currentScenarioId) {
      alert('No scenario created yet!');
      return;
    }
    fetch(`/api/f1/whatif/scenario/${currentScenarioId}/constructorStandings`)
      .then(r => r.json())
      .then(data => {
        const arr = data.constructorStandings;
        let html = `<h4>Scenario #${data.scenarioId} - Constructor Standings</h4><ol>`;
        arr.forEach(item => {
          html += `<li>${item.constructorName} - ${item.points} pts</li>`;
        });
        html += '</ol>';
        document.getElementById('standingsDisplay').innerHTML = html;
      })
      .catch(err => {
        console.error(err);
      });
  });

document.getElementById('btnSaveLocal').addEventListener('click', () => {
  const dataStr = JSON.stringify(scenarioData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const filename = scenarioData.scenarioName
    ? scenarioData.scenarioName.replace(/\s+/g, '_') + '.json'
    : 'scenario.json';

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

document.getElementById('btnLoadLocal').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', ev => {
    const file = ev.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        scenarioData = JSON.parse(e.target.result);
        currentScenarioId = scenarioData.scenarioId || null;
        currentSeason = scenarioData.season || null;
        scenarioStatus.textContent =
          `Loaded scenario locally: "${scenarioData.scenarioName}" (Server ID: ${currentScenarioId||'None'})`;

        if (currentSeason) {
          loadRacesForSeason(currentSeason);
        }
      } catch (err) {
        console.error(err);
        alert('Error loading scenario JSON');
      }
    };
    reader.readAsText(file);
  });
  input.click();
});