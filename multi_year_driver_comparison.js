document.addEventListener("DOMContentLoaded", () => {
  const startYearSelect       = document.getElementById("startYear");
  const endYearSelect         = document.getElementById("endYear");
  const driverCheckboxesDiv   = document.getElementById("driverCheckboxes");
  const compareBtn            = document.getElementById("compareBtn");
  const metricSelect          = document.getElementById("metricSelect");

  const tableContainer        = document.getElementById("tableContainer");
  const chartContainer        = document.getElementById("chartContainer");
  const comparisonTableHead   = document.getElementById("comparisonTableHead");
  const comparisonTableBody   = document.getElementById("comparisonTableBody");

  /* AI elements */
  const aiButton      = document.getElementById("aiButton");
  const aiModal       = document.getElementById("ai-modal");
  const closeModal    = document.getElementById("close-ai-modal");
  const presetQueries = document.getElementById("presetQueries");
  const aiQueryInput  = document.getElementById("aiQuery");
  const sendAI        = document.getElementById("sendAI");
  const aiAnswerDiv   = document.getElementById("aiAnswer");

  let lastAIData      = null;
  let comparisonChart = null;

  /* -----------------------------
     Load seasons
  -------------------------------*/
  async function loadSeasons() {
    try {
      const resp    = await fetch("/api/f1/seasons.json");
      const data    = await resp.json();
      const seasons = data.MRData.SeasonTable.Seasons
        .map(s => parseInt(s.season))
        .sort((a, b) => a - b);

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
      endYearSelect.value   = seasons[seasons.length - 1];
    } catch (err) {
      console.error("Error loading seasons:", err);
    }
  }

  /* -----------------------------
     Load drivers for range
  -------------------------------*/
  async function loadDriversForRange() {
    const start = parseInt(startYearSelect.value);
    const end   = parseInt(endYearSelect.value);
    if (start > end) return;

    try {
      driverCheckboxesDiv.innerHTML = "";
      const resp = await fetch(`/api/f1/drivers/range?startYear=${start}&endYear=${end}`);
      const data = await resp.json();
      const list = data.MRData.DriverTable || [];

      list.forEach(d => {
        const wrapper = document.createElement("div");
        wrapper.style.marginBottom = "5px";

        const checkbox = document.createElement("input");
        checkbox.type  = "checkbox";
        checkbox.value = d.driverId;
        checkbox.id    = `driver_${d.driverId}`;

        const label = document.createElement("label");
        label.htmlFor = checkbox.id;
        label.textContent = d.fullName || `${d.forename} ${d.surname}`;

        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        driverCheckboxesDiv.appendChild(wrapper);
      });
    } catch (err) {
      console.error("Error loading drivers for range:", err);
    }
  }

  /* -----------------------------
     Compare drivers
  -------------------------------*/
  async function compareDrivers() {
    const startYear = parseInt(startYearSelect.value);
    const endYear   = parseInt(endYearSelect.value);
    if (startYear > endYear) {
      alert("Invalid year range!");
      return;
    }

    const checked = document.querySelectorAll('#driverCheckboxes input[type="checkbox"]:checked');
    if (checked.length < 2 || checked.length > 4) {
      alert("Please select between 2 and 4 drivers.");
      return;
    }
    const driverIds = Array.from(checked).map(cb => cb.value);

    const metric = metricSelect.value;
    const url = `/api/f1/multiYearDriverComparison?drivers=${driverIds.join(',')}` +
                `&startYear=${startYear}&endYear=${endYear}&metric=${metric}`;
    try {
      const resp  = await fetch(url);
      const data  = await resp.json();
      const obj   = data.MRData.MultiYearDriverComparison || {};

      const arr = Object.values(obj).map(item => ({
        driverId:    item.driverId,
        yearlyPoints: item.yearlyPoints || [],
        totalPoints:  item.totalPoints  || 0
      }));

      const yearSet = new Set();
      arr.forEach(r => r.yearlyPoints.forEach(yp => yearSet.add(yp.year)));
      const years = Array.from(yearSet).sort((a, b) => a - b);

      arr.forEach(r => {
        const matchCB = document.querySelector(`#driverCheckboxes input[value="${r.driverId}"]`);
        r.name = matchCB ? matchCB.nextElementSibling.textContent : r.driverId;
      });

      lastAIData = { startYear, endYear, metric, years, results: arr };
      aiButton.style.display = "block";

      const viewMode = document.querySelector('input[name="viewMode"]:checked').value;
      (viewMode === "table") ? renderTable(arr, years) : renderChart(arr, years);
    } catch (err) {
      console.error("Error comparing drivers:", err);
    }
  }

  /* -----------------------------
     Table
  -------------------------------*/
  function renderTable(results, years) {
    tableContainer.style.display  = "block";
    chartContainer.style.display  = "none";

    let header = "<tr><th>Driver</th>";
    years.forEach(y => (header += `<th>${y}</th>`));
    header += "<th>Total</th></tr>";
    comparisonTableHead.innerHTML = header;

    comparisonTableBody.innerHTML = "";
    results.forEach(r => {
      const yearMap = {};
      r.yearlyPoints.forEach(yp => (yearMap[yp.year] = yp.points));

      let row = `<tr><td>${r.name}</td>`;
      years.forEach(y => {
        row += `<td>${yearMap[y] !== undefined ? yearMap[y].toFixed(2) : 0}</td>`;
      });
      row += `<td>${r.totalPoints.toFixed(2)}</td></tr>`;
      comparisonTableBody.innerHTML += row;
    });
  }

  /* -----------------------------
     Chart
  -------------------------------*/
  function renderChart(results, years) {
    tableContainer.style.display  = "none";
    chartContainer.style.display  = "block";
    if (comparisonChart) comparisonChart.destroy();

    const labels   = years;
    const datasets = results.map(r => {
      const map = {};
      r.yearlyPoints.forEach(yp => (map[yp.year] = yp.points));
      return { label: r.name, data: years.map(y => map[y] || 0) };
    });

    const ctx = document.getElementById("comparisonChart").getContext("2d");
    comparisonChart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: "#fff" }, grid: { color: "rgba(255,255,255,0.3)" } },
          y: { ticks: { color: "#fff" }, grid: { color: "rgba(255,255,255,0.3)" } }
        },
        plugins: {
          legend: { labels: { color: "#fff" } },
          title:  { display: false }
        }
      }
    });
  }

  /* -----------------------------
     AI modal logic
  -------------------------------*/
  aiButton.addEventListener("click", () => {
    aiModal.style.display = "block";
    aiAnswerDiv.textContent = "";
    aiQueryInput.value      = "";
    presetQueries.value     = "";
  });

  closeModal.addEventListener("click", e => {
    e.preventDefault();
    aiModal.style.display = "none";
  });
  window.addEventListener("click", e => {
    if (e.target === aiModal) aiModal.style.display = "none";
  });
  presetQueries.addEventListener("change", () => {
    aiQueryInput.value = presetQueries.value;
  });
  sendAI.addEventListener("click", async () => {
    const q = aiQueryInput.value.trim();
    if (!q) return;
    if (!lastAIData) {
      aiAnswerDiv.textContent = "Generate a comparison first!";
      return;
    }
    aiAnswerDiv.textContent = "Loading…";
    try {
      const payload = {
        season: `${lastAIData.startYear}-${lastAIData.endYear}`,
        type:   "multi-driver",
        query:  q,
        data:   lastAIData
      };
      const res  = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      aiAnswerDiv.textContent = json.response;
    } catch (err) {
      console.error(err);
      aiAnswerDiv.textContent = "Error fetching AI insights.";
    }
  });

  /* -----------------------------
     Init
  -------------------------------*/
  compareBtn.addEventListener("click", compareDrivers);
  startYearSelect.addEventListener("change", loadDriversForRange);
  endYearSelect  .addEventListener("change", loadDriversForRange);

  loadSeasons().then(loadDriversForRange);
});