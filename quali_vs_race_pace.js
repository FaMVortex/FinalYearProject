document.addEventListener("DOMContentLoaded", () => {
  /* ────────────────────────────────────────────────────────────
     0.  GLOBAL CHART DEFAULTS → WHITE TEXT
  ────────────────────────────────────────────────────────────── */
  Chart.defaults.color = "#ffffff";   // <─ NEW LINE

  const seasonSel   = document.getElementById("seasonSelect");
  const genBtn      = document.getElementById("generateBtn");
  const chartDiv    = document.getElementById("chartContainer");
  const aiBtn       = document.getElementById("aiButton");

  /* ---------- AI elements ---------- */
  const modal       = document.getElementById("aiModal");
  const closeModal  = document.getElementById("closeModal");
  const presetDD    = document.getElementById("presetQueries");
  const aiQuery     = document.getElementById("aiQuery");
  const sendAI      = document.getElementById("sendAI");
  const aiAnswer    = document.getElementById("aiAnswer");

  let scatterChart  = null;
  let lastSeason    = null;
  let lastData      = null;

  /* -------- Load seasons ---------- */
  fetch("/api/f1/seasons.json")
    .then(r => r.json())
    .then(json => {
      const seasons = json.MRData.SeasonTable.Seasons;
      seasonSel.innerHTML = "";
      seasons.forEach(s => {
        const o = document.createElement("option");
        o.value = s.season;
        o.textContent = s.season;
        seasonSel.appendChild(o);
      });
    })
    .catch(err => console.error("Seasons fetch error:", err));

  /* -------- Generate scatter ---------- */
  genBtn.addEventListener("click", async () => {
    const season = seasonSel.value;
    if (!season) { alert("Pick a season first!"); return; }

    chartDiv.style.display = "none";
    aiBtn.style.display    = "none";
    if (scatterChart) scatterChart.destroy();

    try {
      const r  = await fetch(`/api/f1/${season}/gridVsFinish.json`);
      const js = await r.json();
      lastData   = js.data;
      lastSeason = season;
      buildScatter(js.data);
      chartDiv.style.display = "block";
      aiBtn.style.display    = "block";
    } catch (e) {
      console.error(e);
      alert("Failed to fetch data.");
    }
  });

  /* -------- Build Chart.js scatter ---------- */
  function buildScatter(arr){
    const ctx = document.getElementById("scatterCanvas").getContext("2d");

    const pts = arr.map(d => ({
      x: d.avgGrid,
      y: d.avgFinish,
      r: 5,
      backgroundColor: colour(d)
    }));

    scatterChart = new Chart(ctx, {
      type: "bubble",
      data: { datasets: [{ data: pts, parsing:false, pointStyle:"circle", hoverRadius:7 }] },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        scales:{
          x:{ title:{ display:true, text:"Avg Grid (lower = better)" },
              ticks:{ color:"#fff" }, grid:{ color:"rgba(255,255,255,0.3)" } },
          y:{ title:{ display:true, text:"Avg Finish (lower = better)" },
              ticks:{ color:"#fff" }, grid:{ color:"rgba(255,255,255,0.3)" } }
        },
        plugins:{
          tooltip:{
            backgroundColor:"rgba(0,0,0,0.8)",
            titleColor:"#fff",
            bodyColor:"#fff",
            callbacks:{
              label: ctx => {
                const d   = arr[ctx.dataIndex];
                const Δ   = (d.avgFinish - d.avgGrid).toFixed(2);
                return `${d.driverName}: grid ${d.avgGrid.toFixed(2)}, finish ${d.avgFinish.toFixed(2)} (Δ ${Δ})`;
              }
            }
          },
          legend:{ display:false }
        }
      }
    });
  }

  function colour(d){
    const delta = d.avgFinish - d.avgGrid;
    if (delta < -1) return "rgba(0,200,0,0.8)";    // Sunday hero
    if (delta >  1) return "rgba(200,0,0,0.8)";    // Sunday struggler
    return           "rgba(200,200,200,0.8)";
  }

  /* -------- AI modal logic ---------- */
  aiBtn.addEventListener("click", () => {
    modal.style.display = "block";
    aiAnswer.textContent = "";
    aiQuery.value = "";
    presetDD.value = "";
  });
  closeModal.addEventListener("click", e => {e.preventDefault(); modal.style.display = "none";});
  window.addEventListener("click", e => { if (e.target === modal) modal.style.display = "none";});
  presetDD.addEventListener("change", () => { aiQuery.value = presetDD.value; });

  sendAI.addEventListener("click", async () => {
    const q = aiQuery.value.trim();
    if (!q) return;
    aiAnswer.textContent = "Loading…";
    try{
      const res = await fetch("/api/ai/insights",{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          season: lastSeason,
          type: "gridVsFinish",
          query: q,
          data: lastData
        })
      });
      const js = await res.json();
      aiAnswer.textContent = js.response;
    }catch(e){
      console.error(e);
      aiAnswer.textContent = "Error fetching AI insights.";
    }
  });
});