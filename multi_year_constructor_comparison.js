document.addEventListener("DOMContentLoaded", () => {
  const startYearSelect = document.getElementById("startYear");
  const endYearSelect = document.getElementById("endYear");
  const constructorCheckboxesDiv = document.getElementById("constructorCheckboxes");
  const compareBtn = document.getElementById("compareBtn");
  const metricSelect = document.getElementById("metricSelect");

  const tableContainer = document.getElementById("tableContainer");
  const chartContainer = document.getElementById("chartContainer");
  const comparisonTableHead = document.getElementById("comparisonTableHead");
  const comparisonTableBody = document.getElementById("comparisonTableBody");

  const aiButton = document.getElementById("ai-button");
  const aiModal = document.getElementById("ai-modal");
  const closeModal = document.getElementById("close-ai-modal");
  const presetQueries = document.getElementById("preset-queries");
  const aiQueryInput = document.getElementById("ai-query");
  const sendAIQuery = document.getElementById("send-ai-query");
  const aiResponseDiv = document.getElementById("ai-response");

  let lastAIData = null;   
  let comparisonChart = null;

  // Load seasons
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

  // Load constructors as checkboxes
  async function loadConstructorsForRange() {
    const start = parseInt(startYearSelect.value);
    const end = parseInt(endYearSelect.value);
    if (start > end) return;

    try {
      constructorCheckboxesDiv.innerHTML = "";
      const resp = await fetch(`/api/f1/constructors/range?startYear=${start}&endYear=${end}`);
      const data = await resp.json();
      const constructorList = data.MRData.ConstructorTable || [];

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

  // Compare constructors for chosen metric
  async function compareConstructors() {
    const startYear = parseInt(startYearSelect.value);
    const endYear = parseInt(endYearSelect.value);

    if (startYear > endYear) {
      alert("Invalid range!");
      return;
    }

    // Gather selected constructors
    const checkedBoxes = document.querySelectorAll('#constructorCheckboxes input[type="checkbox"]:checked');
    if (checkedBoxes.length < 2 || checkedBoxes.length > 4) {
      alert("Please select between 2 and 4 constructors.");
      return;
    }
    const teamIds = Array.from(checkedBoxes).map(cb => cb.value);

    // Retrieve the metric
    const metric = metricSelect.value; // e.g. 'dnfs', 'wins', etc.

    // Build query
    const url = `/api/f1/multiYearConstructorComparison?teams=${teamIds.join(',')}`
              + `&startYear=${startYear}&endYear=${endYear}`
              + `&metric=${metric}`;

    try {
      const resp = await fetch(url);
      const data = await resp.json();
      const resultsObj = data.MRData.MultiYearConstructorComparison || {};

      // Convert to array: { mercedes:{...}, ferrari:{...} }
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

      // Map constructorId -> label text
      resultsArray.forEach(r => {
        const matchingCB = document.querySelector(`#constructorCheckboxes input[value="${r.constructorId}"]`);
        if (matchingCB) {
          const labelEl = matchingCB.nextElementSibling;
          r.name = labelEl ? labelEl.textContent : r.constructorId;
        } else {
          r.name = r.constructorId;
        }
      });

      lastAIData = {
        startYear,endYear,
        metric,
        years: sortedYears,
        results: resultsArray
      };
      aiButton.style.display = "block";

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

  // Render table
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
        rowHTML += `<td>${yearMap[y] !== undefined ? yearMap[y].toFixed(2) : 0}</td>`;
      });
      rowHTML += `<td>${r.totalPoints.toFixed(2)}</td></tr>`;
      comparisonTableBody.innerHTML += rowHTML;
    });
  }

  // Render chart (multi-line)
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

  aiButton.addEventListener("click",()=>{
    aiModal.style.display="block";
    aiResponseDiv.textContent="";
    aiQueryInput.value="";
    presetQueries.value="";
  });
  closeModal.addEventListener("click",e=>{
    e.preventDefault();aiModal.style.display="none";
  });
  window.addEventListener("click",e=>{
    if(e.target===aiModal) aiModal.style.display="none";
  });
  presetQueries.addEventListener("change",()=>{
    aiQueryInput.value=presetQueries.value;
  });
  sendAIQuery.addEventListener("click",async()=>{
    const q=aiQueryInput.value.trim();
    if(!q) return;
    if(!lastAIData){
      aiResponseDiv.textContent="Generate a comparison first!";
      return;
    }
    aiResponseDiv.textContent="Loading…";
    try{
      const payload={
        season:`${lastAIData.startYear}-${lastAIData.endYear}`,
        type:"multi-constructor",
        query:q,
        data:lastAIData
      };
      const res=await fetch("/api/ai/insights",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      const json=await res.json();
      aiResponseDiv.textContent=json.response;
    }catch(err){
      console.error(err);
      aiResponseDiv.textContent="Error fetching AI insights.";
    }
  });

  /* ----- listeners & init ----- */
  compareBtn.addEventListener("click",compareConstructors);
  startYearSelect.addEventListener("change",loadConstructorsForRange);
  endYearSelect  .addEventListener("change",loadConstructorsForRange);

  loadSeasons().then(loadConstructorsForRange);
});