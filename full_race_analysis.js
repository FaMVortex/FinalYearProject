let lapTimeChart = null;
let driverVisibility = {};  // { driverName: booleanHidden }

const seasonSelect    = document.getElementById("analysisSeason");
const roundSelect     = document.getElementById("analysisRound");
const loadAnalysisBtn = document.getElementById("loadAnalysisBtn");

const analysisResultsTable = document.getElementById("analysisResultsTable");
const driverTogglesDiv     = document.getElementById("driverToggles");
const lapTimeChartCanvas   = document.getElementById("lapTimesChart");
const startFinishTableDiv  = document.getElementById("startFinishTable");

const aiInsightsBtn = document.getElementById("aiInsightsBtn");
const aiModal       = document.getElementById("ai-modal");
const closeAIModal  = document.getElementById("close-ai-modal");
const presetSelect  = document.getElementById("preset-queries");
const aiQueryInput  = document.getElementById("ai-query");
const sendAIQuery   = document.getElementById("send-ai-query");
const aiResponseDiv = document.getElementById("ai-response");

let lastRaceResults = null;
let lastLapData     = null;
let lastStartFinish = null;

window.addEventListener("DOMContentLoaded", async () => {
  const params    = new URLSearchParams(window.location.search);
  const urlSeason = params.get("season");
  const urlRound  = params.get("round");

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
      if (urlRound) roundSelect.value = urlRound;

      // If both are valid, auto-load results
      if (roundSelect.value) {
        await loadRaceResults(urlSeason, urlRound);
        await loadLapTimes(urlSeason, urlRound);
        await loadStartFinish(urlSeason, urlRound);
      }
    }
  } catch (error) {
    console.error("Error loading seasons on DOMContentLoaded:", error);
    // Show a placeholder option and disable controls so we never try to fetch with
    // value="Error loading seasons"
    seasonSelect.innerHTML = '<option value="">Error loading seasons</option>';
    seasonSelect.disabled = true;
    roundSelect.disabled  = true;
    loadAnalysisBtn.disabled = true;
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
      opt.value       = r.round;
      opt.textContent = `Round ${r.round} - ${r.raceName}`;
      roundSelect.appendChild(opt);
    });
    roundSelect.disabled = false;
  } catch (error) {
    console.error("Error loading rounds:", error);
    roundSelect.innerHTML = '<option value="">Error loading rounds</option>';
  }
}

seasonSelect.addEventListener("change", async () => {
  const chosenYear = seasonSelect.value;
  if (!chosenYear) return;
  await loadRounds(chosenYear);
});

loadAnalysisBtn.addEventListener("click", async () => {
  const chosenYear  = seasonSelect.value;
  const chosenRound = roundSelect.value;
  if (!chosenYear || !chosenRound) {
    alert("Please select a valid year and round first.");
    return;
  }

  await loadRaceResults(chosenYear, chosenRound);
  await loadLapTimes(chosenYear, chosenRound);
  await loadStartFinish(chosenYear, chosenRound);
});

async function loadRaceResults(year, round) {
  analysisResultsTable.innerHTML = "Loading race results...";
  let results = [];            // declare here so it's scoped to the whole function
  try {
    const url  = `/api/f1/${year}/${round}/results.json`;
    const resp = await fetch(url);
    if (!resp.ok) {
      analysisResultsTable.innerHTML = `Error loading race results (HTTP ${resp.status})`;
      return;
    }
    const data    = await resp.json();
    const raceObj = data?.MRData?.RaceTable?.Races?.[0];
    if (!raceObj) {
      analysisResultsTable.innerHTML = "No race data found.";
      return;
    }

    results = raceObj.Results || [];
    let html = `<h3>${raceObj.raceName} (${raceObj.season}, Round ${raceObj.round})</h3>
      <table>
        <thead>
          <tr>
            <th>Pos</th><th>Driver</th><th>Constructor</th><th>Points</th><th>Status</th>
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

    lastRaceResults = results;  // now it’s in scope
  } catch (error) {
    console.error("loadRaceResults error:", error);
    analysisResultsTable.innerHTML = "Error loading race results.";
  }
}

async function loadLapTimes(year, round) {
  driverTogglesDiv.innerHTML = "Loading lap times...";
  if (lapTimeChart) {
    lapTimeChart.destroy();
    lapTimeChart = null;
  }

  try {
    const url  = `/api/f1/${year}/${round}/laptimes.json`;
    const resp = await fetch(url);
    if (!resp.ok) {
      driverTogglesDiv.innerHTML = `Error loading lap times (HTTP ${resp.status})`;
      return;
    }
    const data    = await resp.json();
    const lapData = data?.lapData || [];

    if (!lapData.length) {
      driverTogglesDiv.innerHTML = "No lap time data available.";
      return;
    }

    const driverDatasets = [];
    let labels = [];

    function parseTimeToSeconds(timeStr) {
      if (timeStr.includes(":")) {
        const [mins, secs] = timeStr.split(":");
        return parseInt(mins, 10) * 60 + parseFloat(secs);
      } else {
        return parseFloat(timeStr);
      }
    }

    const OUTLIER_THRESHOLD = 150;

    lapData.forEach((driverObj, idx) => {
      const numericLapTimes = driverObj.laps
        .map(l => parseTimeToSeconds(l.time))
        .filter(sec => sec > 0 && sec < OUTLIER_THRESHOLD);

      if (!labels.length && numericLapTimes.length) {
        labels = numericLapTimes.map((_, i) => i + 1);
      }

      let hiddenDefault = idx >= 3;
      if (driverVisibility[driverObj.driverName] !== undefined) {
        hiddenDefault = driverVisibility[driverObj.driverName];
      }

      driverDatasets.push({
        label:       driverObj.driverName,
        data:        numericLapTimes,
        borderWidth: 2,
        fill:        false,
        hidden:      hiddenDefault,
        borderColor: getRandomColor()
      });
    });

    driverTogglesDiv.innerHTML = "";
    driverDatasets.forEach((ds, idx) => {
      const chk = document.createElement("input");
      chk.type    = "checkbox";
      chk.id      = `driverToggle_${idx}`;
      chk.checked = !ds.hidden;
      chk.addEventListener("change", () => {
        const newHidden = !chk.checked;
        lapTimeChart.data.datasets[idx].hidden = newHidden;
        lapTimeChart.update();
        driverVisibility[ds.label] = newHidden;
      });

      const label = document.createElement("label");
      label.htmlFor = chk.id;
      label.textContent = ds.label;

      driverTogglesDiv.append(chk, label, document.createElement("br"));
    });

    const ctx = lapTimeChartCanvas.getContext("2d");
    lapTimeChart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets: driverDatasets },
      options: {
        responsive: true,
        scales: {
          y: { title: { display: true, text: "Lap Time (seconds)" } },
          x: { title: { display: true, text: "Lap Index" } }
        }
      }
    });

    lastLapData = lapData;
  } catch (error) {
    console.error("loadLapTimes error:", error);
    driverTogglesDiv.innerHTML = "Error loading lap times data.";
  }
}

async function loadStartFinish(year, round) {
  startFinishTableDiv.innerHTML = "Loading start vs. finish data...";
  try {
    const url  = `/api/f1/${year}/${round}/startFinish.json`;
    const resp = await fetch(url);
    if (!resp.ok) {
      startFinishTableDiv.innerHTML = `Error loading Start/Finish data (HTTP ${resp.status}).`;
      return;
    }
    const data = await resp.json();
    if (!data.length) {
      startFinishTableDiv.innerHTML = "No start/finish data found.";
      return;
    }

    let html = `<table>
      <thead>
        <tr><th>Driver</th><th>Start</th><th>Finish</th><th>Change</th></tr>
      </thead>
      <tbody>`;
    data.forEach(row => {
      let change = row.positionChange;
      if (change > 0) change = `+${change}`;
      html += `<tr>
        <td>${row.driverName}</td>
        <td>${row.startPosition}</td>
        <td>${row.finishPosition}</td>
        <td>${change}</td>
      </tr>`;
    });
    html += "</tbody></table>";
    startFinishTableDiv.innerHTML = html;
    lastStartFinish = data;
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

// **Fixed**: use the correct variable name here
aiInsightsBtn.addEventListener("click", () => {
  aiModal.style.display     = "block";
  aiQueryInput.value        = "";
  aiResponseDiv.textContent = "";
  presetSelect.value        = "";
});

closeAIModal.addEventListener("click", e => {
  e.preventDefault();
  aiModal.style.display = "none";
});
window.addEventListener("click", event => {
  if (event.target === aiModal) aiModal.style.display = "none";
});
presetSelect.addEventListener("change", () => {
  aiQueryInput.value = presetSelect.value;
});
sendAIQuery.addEventListener("click", async () => {
  const q = aiQueryInput.value.trim();
  if (!q) return;
  aiResponseDiv.textContent = "Loading…";

  const season = seasonSelect.value;
  const round  = roundSelect.value;

  const [resultsResp, ltResp, sfResp] = await Promise.all([
    fetch(`/api/f1/${season}/${round}/results.json`),
    fetch(`/api/f1/${season}/${round}/laptimes.json`),
    fetch(`/api/f1/${season}/${round}/startFinish.json`)
  ]);

  const [resultsJson, ltJson, sfJson] = await Promise.all([
    resultsResp.json(),
    ltResp.json(),
    sfResp.json()
  ]);

  try {
    const payload = {
      season, round, query: q,
      data: {
        results:     resultsJson.MRData?.RaceTable?.Races?.[0]?.Results || [],
        lapData:     ltJson.lapData  || [],
        startFinish: sfJson         || []
      }
    };
    const aiRes = await fetch("/api/ai/raceInsights", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload)
    });
    const aiData = await aiRes.json();
    aiResponseDiv.textContent = aiData.response || "No response received from AI.";
  } catch (err) {
    console.error("AI query error:", err);
    aiResponseDiv.textContent = "Error fetching AI insights.";
  }
});