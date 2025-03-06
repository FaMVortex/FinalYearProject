document.addEventListener("DOMContentLoaded", () => {
  const startYearSelect = document.getElementById("startYear");
  const endYearSelect = document.getElementById("endYear");
  const constructorCheckboxesDiv = document.getElementById("constructorCheckboxes"); // new container
  const compareBtn = document.getElementById("compareBtn");

  const tableContainer = document.getElementById("tableContainer");
  const chartContainer = document.getElementById("chartContainer");
  const comparisonTableHead = document.getElementById("comparisonTableHead");
  const comparisonTableBody = document.getElementById("comparisonTableBody");
  let comparisonChart = null;

  // 1) Load seasons
  async function loadSeasons() {
    try {
      const resp = await fetch("/api/f1/seasons.json");
      const data = await resp.json();
      const seasons = data.MRData.SeasonTable.Seasons
        .map(s => parseInt(s.season))
        .sort((a,b) => a - b);

      seasons.forEach(year => {
        const optStart = document.createElement("option");
        optStart.value = year;
        optStart.textContent = year;
        startYearSelect.appendChild(optStart);

        const optEnd = document.createElement("option");
        optEnd.value = year;
        optEnd.textContent = year;
        endYearSelect.appendChild(optEnd);
      });

      startYearSelect.value = seasons[0];
      endYearSelect.value = seasons[seasons.length - 1];
    } catch (err) {
      console.error("Error loading seasons:", err);
    }
  }

  // 2) Load constructors for the selected range, create checkboxes
  async function loadConstructorsForRange() {
    const start = parseInt(startYearSelect.value);
    const end = parseInt(endYearSelect.value);
    if (start > end) return;

    try {
      constructorCheckboxesDiv.innerHTML = "";
      const resp = await fetch(`/api/f1/constructors/range?startYear=${start}&endYear=${end}`);
      const data = await resp.json();
      const constructorList = data.MRData.ConstructorTable; 
      // e.g. [ {constructorId:'mercedes', name:'Mercedes'}, ...]

      constructorList.forEach(c => {
        const wrapper = document.createElement("div");
        wrapper.style.marginBottom = "5px";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = c.constructorId;
        checkbox.id = `constructor_${c.constructorId}`;

        const label = document.createElement("label");
        label.htmlFor = checkbox.id;
        label.textContent = c.name;

        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        constructorCheckboxesDiv.appendChild(wrapper);
      });
    } catch (err) {
      console.error("Error loading constructors:", err);
    }
  }

  // 3) Compare constructors, show per-year
  async function compareConstructors() {
    const startYear = parseInt(startYearSelect.value);
    const endYear = parseInt(endYearSelect.value);

    if (startYear > endYear) {
      alert("Invalid range!");
      return;
    }

    // Grab checked teams
    const checkedBoxes = document.querySelectorAll('#constructorCheckboxes input[type="checkbox"]:checked');
    if (checkedBoxes.length < 2 || checkedBoxes.length > 4) {
      alert("Please select between 2 and 4 constructors.");
      return;
    }
    const teamIds = Array.from(checkedBoxes).map(cb => cb.value);

    const url = `/api/f1/multiYearConstructorComparison?teams=${teamIds.join(',')}&startYear=${startYear}&endYear=${endYear}`;
    try {
      const resp = await fetch(url);
      const data = await resp.json();
      const resultsObj = data.MRData.MultiYearConstructorComparison || {};

      // Convert to array
      // e.g. { 'mercedes':{constructorId:'mercedes',yearlyPoints:[],totalPoints:X}, 'ferrari':... }
      const resultsArray = Object.values(resultsObj).map(item => ({
        constructorId: item.constructorId,
        yearlyPoints: item.yearlyPoints || [],
        totalPoints: item.totalPoints || 0
      }));

      // Gather all years
      const allYears = new Set();
      resultsArray.forEach(r => {
        r.yearlyPoints.forEach(yp => allYears.add(yp.year));
      });
      const sortedYears = Array.from(allYears).sort((a,b) => a - b);

      // Map constructorId back to label text
      resultsArray.forEach(r => {
        const matchingCB = document.querySelector(`#constructorCheckboxes input[value="${r.constructorId}"]`);
        if (matchingCB) {
          const labelEl = matchingCB.nextElementSibling;
          r.name = labelEl ? labelEl.textContent : r.constructorId;
        } else {
          r.name = r.constructorId;
        }
      });

      // Show table or chart
      const viewMode = document.querySelector('input[name="viewMode"]:checked').value;
      if (viewMode === "table") {
        renderTable(resultsArray, sortedYears);
      } else {
        renderChart(resultsArray, sortedYears);
      }
    } catch (err) {
      console.error("Error comparing constructors:", err);
    }
  }

  // 4) Table
  function renderTable(results, years) {
    tableContainer.style.display = "block";
    chartContainer.style.display = "none";

    let headerHTML = "<tr><th>Constructor</th>";
    years.forEach(y => { headerHTML += `<th>${y}</th>`; });
    headerHTML += "<th>Total</th></tr>";
    comparisonTableHead.innerHTML = headerHTML;

    comparisonTableBody.innerHTML = "";
    results.forEach(r => {
      let rowHTML = `<tr><td>${r.name}</td>`;
      const yearMap = {};
      r.yearlyPoints.forEach(yp => { yearMap[yp.year] = yp.points; });
      years.forEach(y => {
        rowHTML += `<td>${yearMap[y] || 0}</td>`;
      });
      rowHTML += `<td>${r.totalPoints}</td></tr>`;
      comparisonTableBody.innerHTML += rowHTML;
    });
  }

  // 5) Chart
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
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // Event listeners
  compareBtn.addEventListener("click", compareConstructors);
  startYearSelect.addEventListener("change", loadConstructorsForRange);
  endYearSelect.addEventListener("change", loadConstructorsForRange);

  // Init
  loadSeasons().then(() => {
    loadConstructorsForRange();
  });
});