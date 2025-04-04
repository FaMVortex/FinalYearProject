document.addEventListener("DOMContentLoaded", () => {
    const seasonSelect = document.getElementById('seasonSelect');
    const teamASelect = document.getElementById('teamASelect');
    const teamBSelect = document.getElementById('teamBSelect');
    const loadH2HBtn = document.getElementById('loadH2HBtn');
    const h2hResultsDiv = document.getElementById('h2hResults');
    const roundChartSection = document.getElementById('roundChartSection');
    const h2hChartCanvas = document.getElementById('h2hChart');
  
    let h2hChart = null;

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

    seasonSelect.addEventListener('change', async () => {
      const chosenSeason = seasonSelect.value;
      if (!chosenSeason) return;
  
      teamASelect.innerHTML = '<option>Loading...</option>';
      teamBSelect.innerHTML = '<option>Loading...</option>';
  
      try {
        const resp = await fetch(`/api/f1/${chosenSeason}/constructors.json`);
        const data = await resp.json();
        const constructors = data?.MRData?.ConstructorTable?.Constructors || [];
        teamASelect.innerHTML = '<option value="">Select Team A</option>';
        teamBSelect.innerHTML = '<option value="">Select Team B</option>';
        constructors.forEach(c => {
          const label = c.name;
          // Typically constructorId is numeric in your DB, or an integer string
          const val = c.constructorId;
          let optA = document.createElement('option');
          let optB = document.createElement('option');
          optA.value = val;
          optA.textContent = label;
          optB.value = val;
          optB.textContent = label;
          teamASelect.appendChild(optA);
          teamBSelect.appendChild(optB);
        });
      } catch (err) {
        console.error("Error loading constructors:", err);
      }
    });

    loadH2HBtn.addEventListener('click', async () => {
      const season = seasonSelect.value;
      const teamA = teamASelect.value;
      const teamB = teamBSelect.value;
      if (!season || !teamA || !teamB) {
        alert("Please pick a season and two teams!");
        return;
      }
  
      const url = `/api/f1/${season}/headToHeadConstructors.json?teamA=${teamA}&teamB=${teamB}`;
      try {
        h2hResultsDiv.innerHTML = "<p>Loading team head‐to‐head data...</p>";
        const resp = await fetch(url);
        if (!resp.ok) {
          h2hResultsDiv.innerHTML = `<p>Error loading (HTTP ${resp.status})</p>`;
          return;
        }
        const data = await resp.json(); 
        if (!data.length) {
          h2hResultsDiv.innerHTML = "<p>No data found for these teams.</p>";
          return;
        }
  
        // Build a table
        let html = `<table>
          <thead>
            <tr>
              <th>Round</th>
              <th>Race Name</th>
              <th>Team A Pos (Pts)</th>
              <th>Team B Pos (Pts)</th>
              <th>Who Was Ahead?</th>
            </tr>
          </thead>
          <tbody>
        `;
        // For chart data
        let roundLabels = [];
        let teamAPoints = [];
        let teamBPoints = [];
  
        data.forEach(item => {
          const rnd = item.round;
          const raceName = item.raceName || "-";
          const aPos = item.teamA.position ?? "N/A";
          const aPts = item.teamA.points ?? 0;
          const bPos = item.teamB.position ?? "N/A";
          const bPts = item.teamB.points ?? 0;
          let who = item.winner || "-";
          if (who === "teamA") who = "Team A";
          else if (who === "teamB") who = "Team B";
          else if (who === "tie") who = "Tie";
  
          html += `
            <tr>
              <td>${rnd}</td>
              <td>${raceName}</td>
              <td>${aPos} (${aPts})</td>
              <td>${bPos} (${bPts})</td>
              <td>${who}</td>
            </tr>
          `;
  
          roundLabels.push(`R${rnd}`);
          teamAPoints.push(aPts);
          teamBPoints.push(bPts);
        });
  
        html += "</tbody></table>";
        h2hResultsDiv.innerHTML = html;

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
                  label: "Team A Points",
                  data: teamAPoints,
                  backgroundColor: "rgba(255, 99, 132, 0.6)"
                },
                {
                  label: "Team B Points",
                  data: teamBPoints,
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
        console.error("Error loading team H2H data:", err);
        h2hResultsDiv.innerHTML = `<p>Failed to load data. Error: ${err.message}</p>`;
      }
    });
  
    loadSeasons();
  });