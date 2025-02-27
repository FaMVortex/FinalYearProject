document.addEventListener("DOMContentLoaded", () => {
    // 1) DOM
    const startYearInput = document.getElementById("startYear");
    const endYearInput = document.getElementById("endYear");
    const loadTeamsBtn = document.getElementById("loadTeamsBtn");
  
    const teamASelect = document.getElementById("teamA");
    const teamBSelect = document.getElementById("teamB");
  
    const compareBtn = document.getElementById("compareBtn");
    const comparisonBody = document.getElementById("comparison-body");
  
    const teamACol = document.getElementById("teamACol");
    const teamBCol = document.getElementById("teamBCol");
  
    // Sections for toggling
    const tableContainer = document.getElementById("tableContainer");
    const chartContainer = document.getElementById("chartContainer");
    const comparisonChartCanvas = document.getElementById("comparisonChart");
  
    let comparisonChart = null;
  
    // 2) Load teams in range
    async function loadTeamsInRange() {
      const startYear = parseInt(startYearInput.value, 10);
      const endYear = parseInt(endYearInput.value, 10);
  
      // Clear existing
      teamASelect.innerHTML = `<option value="">-- Select Team A --</option>`;
      teamBSelect.innerHTML = `<option value="">-- Select Team B --</option>`;
  
      try {
        const resp = await fetch(`/api/f1/constructors/range?startYear=${startYear}&endYear=${endYear}`);
        const data = await resp.json();
        const constructors = data.MRData.ConstructorTable;
  
        constructors.forEach(c => {
          // e.g. { constructorId: 'mercedes', name: 'Mercedes' }
          const optA = document.createElement("option");
          optA.value = c.constructorId;
          optA.textContent = c.name;
  
          const optB = document.createElement("option");
          optB.value = c.constructorId;
          optB.textContent = c.name;
  
          teamASelect.appendChild(optA);
          teamBSelect.appendChild(optB);
        });
  
        alert(`Loaded ${constructors.length} teams for ${startYear} - ${endYear}.`);
      } catch (error) {
        console.error("Error loading teams in range:", error);
        alert("Failed to load teams for this range.");
      }
    }
  
    // 3) Compare
    async function compareTeams() {
      const teamA = teamASelect.value;
      const teamB = teamBSelect.value;
      const startYear = parseInt(startYearInput.value, 10);
      const endYear = parseInt(endYearInput.value, 10);
  
      if (!teamA || !teamB) {
        alert("Please select both teams.");
        return;
      }
  
      // Clear old table data
      comparisonBody.innerHTML = "";
      teamACol.textContent = teamASelect.options[teamASelect.selectedIndex].text;
      teamBCol.textContent = teamBSelect.options[teamBSelect.selectedIndex].text;
  
      // Destroy old chart if any
      if (comparisonChart) {
        comparisonChart.destroy();
        comparisonChart = null;
      }
  
      const url = `/api/f1/multiYearConstructorComparison?teamA=${teamA}&teamB=${teamB}&startYear=${startYear}&endYear=${endYear}`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        const results = data.MRData.MultiYearConstructorComparison;
  
        const yearMap = {};
  
        // Team A
        results.teamA.years.forEach(item => {
          yearMap[item.year] = { teamA: item.points || 0, teamB: 0 };
        });
  
        // Team B
        results.teamB.years.forEach(item => {
          if (!yearMap[item.year]) {
            yearMap[item.year] = { teamA: 0, teamB: item.points || 0 };
          } else {
            yearMap[item.year].teamB = item.points || 0;
          }
        });
  
        // Sort & display in table
        const sortedYears = Object.keys(yearMap).sort((a,b) => parseInt(a) - parseInt(b));
        sortedYears.forEach(year => {
          const rowData = yearMap[year];
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${year}</td>
            <td>${rowData.teamA}</td>
            <td>${rowData.teamB}</td>
          `;
          comparisonBody.appendChild(row);
        });
  
        // Build Chart.js line chart
        const labels = sortedYears;
        const teamAData = sortedYears.map(y => yearMap[y].teamA);
        const teamBData = sortedYears.map(y => yearMap[y].teamB);
  
        comparisonChart = new Chart(comparisonChartCanvas, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: teamACol.textContent,
                data: teamAData,
                borderColor: '#ffcc00',
                backgroundColor: '#ffcc00',
                fill: false,
                tension: 0.1
              },
              {
                label: teamBCol.textContent,
                data: teamBData,
                borderColor: '#00ccff',
                backgroundColor: '#00ccff',
                fill: false,
                tension: 0.1
              }
            ]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Constructor Comparison Over Multiple Years',
                color: '#fff'
              },
              tooltip: {
                mode: 'index',
                intersect: false
              }
            },
            interaction: {
              mode: 'nearest',
              axis: 'x',
              intersect: false
            },
            scales: {
              x: {
                title: {
                  display: true,
                  text: 'Year',
                  color: '#fff'
                }
              },
              y: {
                title: {
                  display: true,
                  text: 'Points',
                  color: '#fff'
                },
                beginAtZero: true
              }
            }
          }
        });
  
        // Show correct container
        updateViewMode();
      } catch (error) {
        console.error("Error comparing teams:", error);
        comparisonBody.innerHTML = "<tr><td colspan='3'>Failed to load data.</td></tr>";
      }
    }
  
    // 4) Toggle function
    function updateViewMode() {
      const viewMode = document.querySelector('input[name="viewMode"]:checked').value;
      if (viewMode === "table") {
        tableContainer.style.display = "block";
        chartContainer.style.display = "none";
      } else {
        tableContainer.style.display = "none";
        chartContainer.style.display = "block";
      }
    }
  
    // 5) Event Listeners
    loadTeamsBtn.addEventListener("click", loadTeamsInRange);
    compareBtn.addEventListener("click", compareTeams);
  
    document.querySelectorAll('input[name="viewMode"]').forEach(radio => {
      radio.addEventListener("change", updateViewMode);
    });
  });