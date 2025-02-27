document.addEventListener("DOMContentLoaded", () => {
    // 1) DOM Elements
    const startYearInput = document.getElementById("startYear");
    const endYearInput = document.getElementById("endYear");
    const loadDriversBtn = document.getElementById("loadDriversBtn");
  
    const driverASelect = document.getElementById("driverA");
    const driverBSelect = document.getElementById("driverB");
  
    const compareBtn = document.getElementById("compareBtn");
    const comparisonBody = document.getElementById("comparison-body");
  
    const driverACol = document.getElementById("driverACol");
    const driverBCol = document.getElementById("driverBCol");
  
    // Sections for toggling
    const tableContainer = document.getElementById("tableContainer");
    const chartContainer = document.getElementById("chartContainer");
    const comparisonChartCanvas = document.getElementById("comparisonChart");
  
    let comparisonChart = null; // We'll store the Chart.js instance here
  
    // 2) Load drivers in the given year range
    async function loadDriversInRange() {
      const startYear = parseInt(startYearInput.value, 10);
      const endYear = parseInt(endYearInput.value, 10);
  
      // Clear existing dropdown options
      driverASelect.innerHTML = `<option value="">-- Select Driver A --</option>`;
      driverBSelect.innerHTML = `<option value="">-- Select Driver B --</option>`;
  
      try {
        const resp = await fetch(`/api/f1/drivers/range?startYear=${startYear}&endYear=${endYear}`);
        const data = await resp.json();
        const drivers = data.MRData.DriverTable;
  
        drivers.forEach(d => {
          const optA = document.createElement("option");
          optA.value = d.driverId;
          optA.textContent = d.fullName;
  
          const optB = document.createElement("option");
          optB.value = d.driverId;
          optB.textContent = d.fullName;
  
          driverASelect.appendChild(optA);
          driverBSelect.appendChild(optB);
        });
  
        alert(`Loaded ${drivers.length} drivers for ${startYear} - ${endYear}.`);
      } catch (error) {
        console.error("Error loading drivers in range:", error);
        alert("Failed to load drivers for this range.");
      }
    }
  
    // 3) Compare drivers
    async function compareDrivers() {
      const driverA = driverASelect.value;
      const driverB = driverBSelect.value;
      const startYear = parseInt(startYearInput.value, 10);
      const endYear = parseInt(endYearInput.value, 10);
  
      if (!driverA || !driverB) {
        alert("Please select both drivers.");
        return;
      }
  
      // Clear old table results
      comparisonBody.innerHTML = "";
      driverACol.textContent = driverASelect.options[driverASelect.selectedIndex].text;
      driverBCol.textContent = driverBSelect.options[driverBSelect.selectedIndex].text;
  
      // Also destroy any existing chart instance
      if (comparisonChart) {
        comparisonChart.destroy();
        comparisonChart = null;
      }
  
      // Request multi-year data
      const url = `/api/f1/multiYearDriverComparison?driverA=${driverA}&driverB=${driverB}&startYear=${startYear}&endYear=${endYear}`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        const results = data.MRData.MultiYearDriverComparison;
  
        // Build a year -> { driverA, driverB } map
        const yearMap = {};
  
        // driverA data
        results.driverA.years.forEach(item => {
          yearMap[item.year] = {
            driverA: item.points || 0,
            driverB: 0
          };
        });
  
        // driverB data
        results.driverB.years.forEach(item => {
          if (!yearMap[item.year]) {
            yearMap[item.year] = { driverA: 0, driverB: item.points || 0 };
          } else {
            yearMap[item.year].driverB = item.points || 0;
          }
        });
  
        // Sort the years
        const sortedYears = Object.keys(yearMap).sort((a,b) => parseInt(a) - parseInt(b));
  
        // 3A) Populate Table
        sortedYears.forEach(year => {
          const rowData = yearMap[year];
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${year}</td>
            <td>${rowData.driverA}</td>
            <td>${rowData.driverB}</td>
          `;
          comparisonBody.appendChild(row);
        });
  
        // 3B) Build Chart Data
        const labels = sortedYears;
        const driverAData = sortedYears.map(y => yearMap[y].driverA);
        const driverBData = sortedYears.map(y => yearMap[y].driverB);
  
        // Create line chart
        comparisonChart = new Chart(comparisonChartCanvas, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: driverACol.textContent,
                data: driverAData,
                borderColor: '#ffcc00',
                backgroundColor: '#ffcc00',
                fill: false,
                tension: 0.1
              },
              {
                label: driverBCol.textContent,
                data: driverBData,
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
                text: 'Driver Comparison Over Multiple Years',
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
  
        // Show the correct container based on user’s chosen view
        updateViewMode();
      } catch (error) {
        console.error("Error comparing drivers:", error);
        comparisonBody.innerHTML = "<tr><td colspan='3'>Failed to load data.</td></tr>";
      }
    }
  
    // 4) Function to show/hide table or chart
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
    loadDriversBtn.addEventListener("click", loadDriversInRange);
    compareBtn.addEventListener("click", compareDrivers);
  
    // Listen for changes to the radio buttons (table vs. chart)
    document.querySelectorAll('input[name="viewMode"]').forEach(radio => {
      radio.addEventListener("change", updateViewMode);
    });
  });