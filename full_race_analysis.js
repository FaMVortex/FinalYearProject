let lapTimeChart = null;
let driverVisibility = {};  // { driverName: booleanHidden }

const seasonSelect = document.getElementById("analysisSeason");
const roundSelect = document.getElementById("analysisRound");
const loadAnalysisBtn = document.getElementById("loadAnalysisBtn");

const analysisResultsTable = document.getElementById("analysisResultsTable");
const driverTogglesDiv = document.getElementById("driverToggles");
const lapTimeChartCanvas = document.getElementById("lapTimesChart");
const startFinishTableDiv = document.getElementById("startFinishTable");

window.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const urlSeason = params.get("season");
  const urlRound = params.get("round");

  // 1) Load the list of seasons
  try {
    const resp = await fetch("/api/f1/seasons.json");
    const data = await resp.json();
    const seasons = data?.MRData?.SeasonTable?.Seasons || [];

    seasonSelect.innerHTML = '<option value="" selected>Select a Year</option>';
    seasons.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.season;
      opt.textContent = s.season;
      seasonSelect.appendChild(opt);
    });

    // If ?season= is valid, auto-select it
    if (urlSeason && seasons.some(se => se.season === urlSeason)) {
      seasonSelect.value = urlSeason;
      await loadRounds(urlSeason);

      // If ?round= is also present, auto-select it
      if (urlRound) {
        roundSelect.value = urlRound;
      }

      // If both are valid, auto-load results
      if (roundSelect.value) {
        await loadRaceResults(urlSeason, urlRound);
        await loadLapTimes(urlSeason, urlRound);
        await loadStartFinish(urlSeason, urlRound);
      }
    }
  } catch (error) {
    console.error("Error loading seasons on DOMContentLoaded:", error);
    seasonSelect.innerHTML = "<option>Error loading seasons</option>";
  }
});

async function loadRounds(chosenYear) {
  roundSelect.disabled = true;
  roundSelect.innerHTML = "<option>Loading rounds...</option>";
  try {
    const resp = await fetch(`/api/f1/${chosenYear}.json`);
    const data = await resp.json();
    const races = data?.MRData?.RaceTable?.Races || [];

    roundSelect.innerHTML = '<option value="" selected>Select a Round</option>';
    races.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.round;
      opt.textContent = `Round ${r.round} - ${r.raceName}`;
      roundSelect.appendChild(opt);
    });
    roundSelect.disabled = false;
  } catch (error) {
    console.error("Error loading rounds:", error);
    roundSelect.innerHTML = "<option>Error loading rounds</option>";
  }
}

seasonSelect.addEventListener("change", async () => {
  const chosenYear = seasonSelect.value;
  if (!chosenYear) return;
  await loadRounds(chosenYear);
});

loadAnalysisBtn.addEventListener("click", async () => {
  const chosenYear = seasonSelect.value;
  const chosenRound = roundSelect.value;
  if (!chosenYear || !chosenRound) {
    alert("Please select a valid year and round first.");
    return;
  }

  // 1) Race Results
  await loadRaceResults(chosenYear, chosenRound);

  // 2) Lap Times
  await loadLapTimes(chosenYear, chosenRound);

  // 3) Start vs Finish
  await loadStartFinish(chosenYear, chosenRound);
});

async function loadRaceResults(year, round) {
  analysisResultsTable.innerHTML = "Loading race results...";
  try {
    const url = `/api/f1/${year}/${round}/results.json`;
    const resp = await fetch(url);
    if (!resp.ok) {
      analysisResultsTable.innerHTML = `Error loading race results (HTTP ${resp.status})`;
      return;
    }
    const data = await resp.json();
    const raceObj = data?.MRData?.RaceTable?.Races?.[0];
    if (!raceObj) {
      analysisResultsTable.innerHTML = "No race data found.";
      return;
    }

    const results = raceObj.Results || [];
    let html = `<h3>${raceObj.raceName} (${raceObj.season}, Round ${raceObj.round})</h3>
      <table>
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
    results.forEach(r => {
      const driverName = `${r.Driver.givenName} ${r.Driver.familyName}`;
      html += `<tr>
        <td>${r.position}</td>
        <td>${driverName}</td>
        <td>${r.Constructor.name}</td>
        <td>${r.points}</td>
        <td>${r.status}</td>
      </tr>`;
    });
    html += "</tbody></table>";

    analysisResultsTable.innerHTML = html;
  } catch (error) {
    console.error("loadRaceResults error:", error);
    analysisResultsTable.innerHTML = "Error loading race results.";
  }
}

async function loadLapTimes(year, round) {
  driverTogglesDiv.innerHTML = "Loading lap times...";

  // destroy old chart if any
  if (lapTimeChart) {
    lapTimeChart.destroy();
    lapTimeChart = null;
  }

  try {
    const url = `/api/f1/${year}/${round}/laptimes.json`;
    const resp = await fetch(url);
    if (!resp.ok) {
      driverTogglesDiv.innerHTML = `Error loading lap times (HTTP ${resp.status})`;
      return;
    }
    const data = await resp.json();
    const lapData = data?.lapData || [];

    if (!lapData.length) {
      driverTogglesDiv.innerHTML = "No lap time data available.";
      return;
    }

    const driverDatasets = [];
    let labels = [];

    // parseTimeToSeconds helps convert "1:23.456" to numeric seconds
    function parseTimeToSeconds(timeStr) {
      if (timeStr.includes(":")) {
        const [mins, secs] = timeStr.split(":");
        return parseInt(mins, 10) * 60 + parseFloat(secs);
      } else {
        return parseFloat(timeStr);
      }
    }

    // We define a threshold so we can skip huge outliers, e.g. > 300s
    const OUTLIER_THRESHOLD = 150; // 5 minutes

    lapData.forEach((driverObj, idx) => {
      // Convert times, filtering out big outliers
      const numericLapTimes = driverObj.laps
        .map(l => parseTimeToSeconds(l.time))
        .filter(seconds => seconds > 0 && seconds < OUTLIER_THRESHOLD);

      if (!labels.length && numericLapTimes.length) {
        labels = numericLapTimes.map((_, i) => i + 1);
      }

      // By default, hide everything but top 3
      let hiddenDefault = (idx >= 3);
      if (driverVisibility[driverObj.driverName] !== undefined) {
        hiddenDefault = driverVisibility[driverObj.driverName];
      }

      driverDatasets.push({
        label: driverObj.driverName,
        data: numericLapTimes,
        borderWidth: 2,
        fill: false,
        hidden: hiddenDefault,
        borderColor: getRandomColor()
      });
    });

    // Build toggles for each driver
    driverTogglesDiv.innerHTML = "";
    driverDatasets.forEach((ds, idx) => {
      const isHidden = ds.hidden;
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.id = `driverToggle_${idx}`;
      chk.checked = !isHidden;

      chk.addEventListener("change", () => {
        const newHiddenVal = !chk.checked;
        lapTimeChart.data.datasets[idx].hidden = newHiddenVal;
        lapTimeChart.update();
        driverVisibility[ds.label] = newHiddenVal;
      });

      const label = document.createElement("label");
      label.htmlFor = `driverToggle_${idx}`;
      label.textContent = ds.label;

      driverTogglesDiv.appendChild(chk);
      driverTogglesDiv.appendChild(label);
      driverTogglesDiv.appendChild(document.createElement("br"));
    });

    // Create the chart
    const ctx = lapTimeChartCanvas.getContext("2d");
    lapTimeChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: driverDatasets
      },
      options: {
        responsive: true,
        scales: {
          y: {
            title: { display: true, text: "Lap Time (seconds)" }
          },
          x: {
            title: { display: true, text: "Lap Index" }
          }
        }
      }
    });
  } catch (error) {
    console.error("loadLapTimes error:", error);
    driverTogglesDiv.innerHTML = "Error loading lap times data.";
  }
}

async function loadStartFinish(year, round) {
  startFinishTableDiv.innerHTML = "Loading start vs. finish data...";
  try {
    const url = `/api/f1/${year}/${round}/startFinish.json`;
    const resp = await fetch(url);
    if (!resp.ok) {
      startFinishTableDiv.innerHTML = `Error loading Start/Finish data (HTTP ${resp.status}).`;
      return;
    }
    const data = await resp.json(); // array of {driverName, startPosition, finishPosition, positionChange}

    if (!data.length) {
      startFinishTableDiv.innerHTML = "No start/finish data found.";
      return;
    }

    let html = `<table>
      <thead>
        <tr>
          <th>Driver</th>
          <th>Start</th>
          <th>Finish</th>
          <th>Change</th>
        </tr>
      </thead>
      <tbody>`;

    data.forEach((row) => {
      let posChangeText = row.positionChange;
      if (posChangeText > 0) {
        posChangeText = `+${posChangeText}`;
      }

      html += `<tr>
        <td>${row.driverName}</td>
        <td>${row.startPosition}</td>
        <td>${row.finishPosition}</td>
        <td>${posChangeText}</td>
      </tr>`;
    });

    html += "</tbody></table>";
    startFinishTableDiv.innerHTML = html;
  } catch (error) {
    console.error("loadStartFinish error:", error);
    startFinishTableDiv.innerHTML = "Error loading Start/Finish data.";
  }
}

function getRandomColor() {
  const r = Math.floor(Math.random() * 200);
  const g = Math.floor(Math.random() * 200);
  const b = Math.floor(Math.random() * 200);
  return `rgb(${r}, ${g}, ${b})`;
}