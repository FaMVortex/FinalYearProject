document.addEventListener("DOMContentLoaded", () => {
    const seasonSelect   = document.getElementById("season");
    const standingsBody  = document.getElementById("standings-body");
    const standingsTable = document.querySelector(".standings-container table thead");

    // AI UI elements
    const aiButton       = document.getElementById("ai-button");
    const aiModal        = document.getElementById("ai-modal");
    const closeAIModal   = document.getElementById("close-ai-modal");
    const presetSelect   = document.getElementById("preset-queries");
    const aiQueryInput   = document.getElementById("ai-query");
    const sendAIQuery    = document.getElementById("send-ai-query");
    const aiResponseDiv  = document.getElementById("ai-response");

    let raceOrder     = null;
    let standingsData = null;

    async function loadSeasons() {
        try {
            const res  = await fetch("/api/f1/seasons.json");
            const data = await res.json();
            const seasons = data.MRData.SeasonTable.Seasons;

            seasons.forEach(s => {
                const o = document.createElement("option");
                o.value   = s.season;
                o.textContent = s.season;
                seasonSelect.appendChild(o);
            });
            loadStandings(seasonSelect.value);
        } catch (e) {
            console.error("Error fetching seasons:", e);
        }
    }

    async function loadStandings(season) {
        standingsBody.innerHTML = "<tr><td colspan='3'>Loading...</td></tr>";
        try {
            const res  = await fetch(`/api/f1/${season}/constructorResultsTable.json`);
            const json = await res.json();
            raceOrder     = json.MRData.StandingsTable.Races;
            standingsData = json.MRData.StandingsTable.ConstructorResults;

            // headers
            let hdr = `<tr><th>Position</th><th>Constructor</th>`;
            Object.values(raceOrder).forEach(r => hdr += `<th>${r}</th>`);
            hdr += `<th>Points</th></tr>`;
            standingsTable.innerHTML = hdr;

            standingsBody.innerHTML = "";
            standingsData.forEach((c, idx) => {
                let row = `<tr><td>${idx+1}</td><td>${c.Constructor.name}</td>`;
                Object.keys(raceOrder).forEach(rnd => {
                    const arr = c.Races[rnd]||[];
                    let cls = "", txt = arr.join("<br>")||"-";
                    arr.forEach(p => {
                        const n = parseInt(p,10);
                        if (!isNaN(n)) {
                            if      (n===1) cls="gold-cell";
                            else if (n===2) cls="silver-cell";
                            else if (n===3) cls="bronze-cell";
                            else if (n>=4&&n<=10) cls="green-cell";
                        }
                    });
                    row += `<td class="${cls}">${txt}</td>`;
                });
                row += `<td>${c.TotalPoints}</td></tr>`;
                standingsBody.innerHTML += row;
            });
        } catch (e) {
            console.error("Error fetching constructor standings:", e);
            standingsBody.innerHTML = "<tr><td colspan='3'>Failed to load standings.</td></tr>";
        }
    }

    seasonSelect.addEventListener("change", () => loadStandings(seasonSelect.value));

    // AI modal
    aiButton.addEventListener("click", () => {
        aiModal.style.display = "block";
        aiQueryInput.value = "";
        aiResponseDiv.textContent = "";
        presetSelect.value = "";
    });
    closeAIModal.addEventListener("click", e => { e.preventDefault(); aiModal.style.display = "none"; });
    window.addEventListener("click", e => { if (e.target===aiModal) aiModal.style.display="none"; });

    // wire up preset dropdown
    presetSelect.addEventListener("change", () => {
        aiQueryInput.value = presetSelect.value;
    });

    sendAIQuery.addEventListener("click", async () => {
        const q = aiQueryInput.value.trim();
        if (!q) return;
        aiResponseDiv.textContent = "Loading…";
        try {
            const payload = {
                season: seasonSelect.value,
                type:   "constructor",
                query:  q,
                data:   { raceOrder, standings: standingsData }
            };
            const res = await fetch("/api/ai/insights", {
                method: "POST",
                headers: {"Content-Type":"application/json"},
                body: JSON.stringify(payload)
            });
            const rj = await res.json();
            aiResponseDiv.textContent = rj.response;
        } catch (e) {
            console.error(e);
            aiResponseDiv.textContent = "Error fetching AI insights.";
        }
    });

    loadSeasons();
});