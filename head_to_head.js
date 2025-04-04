document.addEventListener("DOMContentLoaded", () => {
  const seasonSelect = document.getElementById('seasonSelect');
  const driverASelect = document.getElementById('driverASelect');
  const driverBSelect = document.getElementById('driverBSelect');
  const loadH2HBtn = document.getElementById('loadH2HBtn');
  const h2hResultsDiv = document.getElementById('h2hResults');
  const roundChartSection = document.getElementById('roundChartSection');
  const h2hChartCanvas = document.getElementById('h2hChart');

  let h2hChart = null;

  // 1. Load seasons into seasonSelect on page load
  async function loadSeasons() {
    try {
      const resp = await fetch("/api/f1/seasons.json");
      const data = await resp.json();
      const seasons = data?.MRData?.SeasonTable?.Seasons || [];
      seasonSelect.innerHTML = '<option value="">Select Season</option>';
      seasons.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.season;
        opt.textContent = s.season;
        seasonSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("Error loading seasons:", err);
    }
  }

  // 2. When user picks a season, load drivers for that season
  seasonSelect.addEventListener('change', async () => {
    const chosenSeason = seasonSelect.value;
    if (!chosenSeason) return;

    driverASelect.innerHTML = '<option>Loading...</option>';
    driverBSelect.innerHTML = '<option>Loading...</option>';

    try {
      const resp = await fetch(`/api/f1/${chosenSeason}/drivers.json`);
      const data = await resp.json();
      const drivers = data?.MRData?.DriverTable?.Drivers || [];
      driverASelect.innerHTML = '<option value="">Select Driver A</option>';
      driverBSelect.innerHTML = '<option value="">Select Driver B</option>';
      drivers.forEach(d => {
        const label = `${d.givenName} ${d.familyName}`;
        const val = d.driverId; // numeric driverId
        let optA = document.createElement('option');
        let optB = document.createElement('option');
        optA.value = val;
        optA.textContent = label;
        optB.value = val;
        optB.textContent = label;
        driverASelect.appendChild(optA);
        driverBSelect.appendChild(optB);
      });
    } catch (err) {
      console.error("Error loading drivers:", err);
    }
  });

  // 3. On "Load Head‐to‐Head" button
  loadH2HBtn.addEventListener('click', async () => {
    const season = seasonSelect.value;
    const driverA = driverASelect.value;
    const driverB = driverBSelect.value;
    if (!season || !driverA || !driverB) {
      alert("Please pick a season and two drivers!");
      return;
    }

    const url = `/api/f1/${season}/headToHeadDrivers.json?driverA=${driverA}&driverB=${driverB}`;
    try {
      h2hResultsDiv.innerHTML = "<p>Loading head‐to‐head data...</p>";
      const resp = await fetch(url);
      if (!resp.ok) {
        h2hResultsDiv.innerHTML = `<p>Error loading (HTTP ${resp.status})</p>`;
        return;
      }
      const data = await resp.json(); // array
      if (!data.length) {
        h2hResultsDiv.innerHTML = "<p>No data found for these drivers.</p>";
        return;
      }

      // Build a table
      let html = `<table>
        <thead>
          <tr>
            <th>Round</th>
            <th>Race Name</th>
            <th>Driver A Pos (Pts)</th>
            <th>Driver B Pos (Pts)</th>
            <th>Who Finished Ahead?</th>
          </tr>
        </thead>
        <tbody>
      `;
      // For chart
      let roundLabels = [];
      let driverAPoints = [];
      let driverBPoints = [];

      data.forEach(item => {
        const rnd = item.round;
        const raceName = item.raceName || "-";
        const daPos = item.driverA.position ?? "N/A";
        const daPts = item.driverA.points ?? 0;
        const dbPos = item.driverB.position ?? "N/A";
        const dbPts = item.driverB.points ?? 0;
        let who = item.winner || "-";
        if (who === "driverA") who = "Driver A";
        else if (who === "driverB") who = "Driver B";
        else if (who === "tie") who = "Tie";

        html += `
          <tr>
            <td>${rnd}</td>
            <td>${raceName}</td>
            <td>${daPos} (${daPts})</td>
            <td>${dbPos} (${dbPts})</td>
            <td>${who}</td>
          </tr>
        `;

        roundLabels.push(`R${rnd}`);
        driverAPoints.push(daPts);
        driverBPoints.push(dbPts);
      });

      html += "</tbody></table>";
      h2hResultsDiv.innerHTML = html;

      // 4. Build a bar chart comparing points each round
      if (h2hChart) {
        h2hChart.destroy();
      }
      if (roundLabels.length) {
        roundChartSection.style.display = "block";
        const ctx = h2hChartCanvas.getContext("2d");
        h2hChart = new Chart(ctx, {
          type: "bar",
          data: {
            labels: roundLabels,
            datasets: [
              {
                label: "Driver A Points",
                data: driverAPoints,
                backgroundColor: "rgba(255, 99, 132, 0.6)"
              },
              {
                label: "Driver B Points",
                data: driverBPoints,
                backgroundColor: "rgba(54, 162, 235, 0.6)"
              }
            ]
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                labels: {
                  color: 'white'
                }
              },
              title: {
                display: false
              }
            },
            scales: {
              x: {
                title: {
                  display: true,
                  text: "Round",
                  color: "white"
                },
                ticks: {
                  color: "white"
                },
                grid: {
                  color: "rgba(255, 255, 255, 0.2)"
                }
              },
              y: {
                title: {
                  display: true,
                  text: "Points This Round",
                  color: "white"
                },
                ticks: {
                  color: "white"
                },
                grid: {
                  color: "rgba(255, 255, 255, 0.2)"
                }
              }
            }
          }
        });
      } else {
        roundChartSection.style.display = "none";
      }
    } catch (err) {
      console.error("Error loading H2H data:", err);
      // Show the actual error message for easier debugging:
      h2hResultsDiv.innerHTML = `<p>Failed to load data. Error: ${err.message}</p>`;
    }
  });

  // Initialize
  loadSeasons();
});