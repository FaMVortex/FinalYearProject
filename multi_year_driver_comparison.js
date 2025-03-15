document.addEventListener("DOMContentLoaded", () => {
  const startYearSelect = document.getElementById("startYear");
  const endYearSelect = document.getElementById("endYear");
  const driverCheckboxesDiv = document.getElementById("driverCheckboxes");
  const compareBtn = document.getElementById("compareBtn");
  const metricSelect = document.getElementById("metricSelect");

  const tableContainer = document.getElementById("tableContainer");
  const chartContainer = document.getElementById("chartContainer");
  const comparisonTableHead = document.getElementById("comparisonTableHead");
  const comparisonTableBody = document.getElementById("comparisonTableBody");
  let comparisonChart = null;

  // Load all known seasons
  async function loadSeasons() {
    try {
      const resp = await fetch("/api/f1/seasons.json");
      const data = await resp.json();
      const seasons = data.MRData.SeasonTable.Seasons
        .map(s => parseInt(s.season))
        .sort((a,b) => a - b);

      seasons.forEach(year => {
        const opt1 = document.createElement("option");
        opt1.value = year;
        opt1.textContent = year;
        startYearSelect.appendChild(opt1);

        const opt2 = document.createElement("option");
        opt2.value = year;
        opt2.textContent = year;
        endYearSelect.appendChild(opt2);
      });

      startYearSelect.value = seasons[0];
      endYearSelect.value = seasons[seasons.length - 1];
    } catch (err) {
      console.error("Error loading seasons:", err);
    }
  }

  // Load drivers for the selected range (checkboxes)
  async function loadDriversForRange() {
    const start = parseInt(startYearSelect.value);
    const end = parseInt(endYearSelect.value);
    if (start > end) return;

    try {
      driverCheckboxesDiv.innerHTML = "";
      const resp = await fetch(`/api/f1/drivers/range?startYear=${start}&endYear=${end}`);
      const data = await resp.json();
      const driverList = data.MRData.DriverTable || [];

      driverList.forEach(d => {
        const wrapper = document.createElement("div");
        wrapper.style.marginBottom = "5px";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = d.driverId;
        checkbox.id = `driver_${d.driverId}`;

        const label = document.createElement("label");
        label.htmlFor = checkbox.id;
        label.textContent = d.fullName || (d.forename + " " + d.surname);

        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        driverCheckboxesDiv.appendChild(wrapper);
      });
    } catch (err) {
      console.error("Error loading drivers for range:", err);
    }
  }

  // Compare drivers for the chosen metric
  async function compareDrivers() {
    const startYear = parseInt(startYearSelect.value);
    const endYear = parseInt(endYearSelect.value);

    if (startYear > endYear) {
      alert("Invalid year range!");
      return;
    }

    // Collect checked drivers
    const checkedBoxes = document.querySelectorAll('#driverCheckboxes input[type="checkbox"]:checked');
    if (checkedBoxes.length < 2 || checkedBoxes.length > 4) {
      alert("Please select between 2 and 4 drivers.");
      return;
    }
    const driverIds = Array.from(checkedBoxes).map(cb => cb.value);

    // Retrieve the selected metric
    const metric = metricSelect.value; // e.g. 'avgFinish'

    // Build the query with metric
    const url = `/api/f1/multiYearDriverComparison?drivers=${driverIds.join(',')}`
              + `&startYear=${startYear}&endYear=${endYear}`
              + `&metric=${metric}`;

    try {
      const resp = await fetch(url);
      const data = await resp.json();
      const resultsObj = data.MRData.MultiYearDriverComparison || {};

      // Each driver => { driverId, yearlyPoints: [{year,points}], totalPoints }
      const resultsArray = Object.values(resultsObj).map(item => ({
        driverId: item.driverId,
        yearlyPoints: item.yearlyPoints || [],
        totalPoints: item.totalPoints || 0
      }));

      // Gather all years
      const allYears = new Set();
      resultsArray.forEach(r => {
        r.yearlyPoints.forEach(yp => allYears.add(yp.year));
      });
      const sortedYears = Array.from(allYears).sort((a,b) => a - b);

      // Map driverId back to label
      resultsArray.forEach(r => {
        const matchingCB = document.querySelector(`#driverCheckboxes input[value="${r.driverId}"]`);
        if (matchingCB) {
          const labelEl = matchingCB.nextElementSibling;
          r.name = labelEl ? labelEl.textContent : r.driverId;
        } else {
          r.name = r.driverId;
        }
      });

      const viewMode = document.querySelector('input[name="viewMode"]:checked').value;
      if (viewMode === "table") {
        renderTable(resultsArray, sortedYears);
      } else {
        renderChart(resultsArray, sortedYears);
      }
    } catch (err) {
      console.error("Error comparing drivers:", err);
    }
  }

  // Render table
  function renderTable(results, years) {
    tableContainer.style.display = "block";
    chartContainer.style.display = "none";

    let headerHTML = "<tr><th>Driver</th>";
    years.forEach(y => { headerHTML += `<th>${y}</th>`; });
    headerHTML += "<th>Total</th></tr>";
    comparisonTableHead.innerHTML = headerHTML;

    comparisonTableBody.innerHTML = "";
    results.forEach(r => {
      let rowHTML = `<tr><td>${r.name}</td>`;
      const yearMap = {};
      r.yearlyPoints.forEach(yp => { yearMap[yp.year] = yp.points; });
      years.forEach(y => {
        rowHTML += `<td>${yearMap[y] !== undefined ? yearMap[y].toFixed(2) : 0}</td>`;
      });
      // If you want to show the total with 2 decimals:
      rowHTML += `<td>${r.totalPoints.toFixed(2)}</td></tr>`;
      comparisonTableBody.innerHTML += rowHTML;
    });
  }

  // Render multi-line chart
  function renderChart(results, years) {
    tableContainer.style.display = "none";
    chartContainer.style.display = "block";

    if (comparisonChart) {
      comparisonChart.destroy();
    }

    const labels = years;
    const datasets = results.map(r => {
      const yearMap = {};
      r.yearlyPoints.forEach(yp => { yearMap[yp.year] = yp.points; });
      const data = years.map(y => yearMap[y] || 0);

      return { label: r.name, data };
    });

    const ctx = document.getElementById("comparisonChart").getContext("2d");
    comparisonChart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: {
              color: "#fff" // white x-axis labels
            },
            grid: {
              color: "rgba(255,255,255,0.3)" // optional lighter grid line color
            }
          },
          y: {
            ticks: {
              color: "#fff" // white y-axis labels
            },
            grid: {
              color: "rgba(255,255,255,0.3)"
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: "#fff" // white legend text
            }
          },
          title: {
            display: false, // or true if you have a chart title
            text: "Comparison Chart",
            color: "#fff"
          }
        }
      }
    });
  }

  // Event listeners
  compareBtn.addEventListener("click", compareDrivers);
  startYearSelect.addEventListener("change", loadDriversForRange);
  endYearSelect.addEventListener("change", loadDriversForRange);

  // Init
  loadSeasons().then(loadDriversForRange);
});