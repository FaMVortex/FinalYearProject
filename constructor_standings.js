document.addEventListener("DOMContentLoaded", () => {
    const seasonSelect = document.getElementById("season");
    const standingsBody = document.getElementById("standings-body");
    const standingsTable = document.querySelector(".standings-container table thead");

    async function loadSeasons() {
        try {
            const response = await fetch("/api/f1/seasons.json");
            const data = await response.json();
            const seasons = data.MRData.SeasonTable.Seasons;

            // Populate dropdown with all seasons
            seasons.forEach(season => {
                let option = document.createElement("option");
                option.value = season.season;
                option.textContent = season.season;
                seasonSelect.appendChild(option);
            });

            // Load the current season's constructor standings by default
            loadStandings(seasonSelect.value);
        } catch (error) {
            console.error("Error fetching seasons:", error);
        }
    }

    async function loadStandings(season) {
        standingsBody.innerHTML = "<tr><td colspan='3'>Loading...</td></tr>";
    
        try {
            // Fetch the constructor results for the entire season
            const response = await fetch(`/api/f1/${season}/constructorResultsTable.json`);
            const data = await response.json();
    
            const raceOrder = data.MRData.StandingsTable.Races; // { roundNumber: raceName, ... }
            const standings = data.MRData.StandingsTable.ConstructorResults; // sorted array
    
            // 1) Build the table header (Position | Constructor | for each race | Points)
            let headerRow = `<tr><th>Position</th><th>Constructor</th>`;
            Object.values(raceOrder).forEach(raceName => {
                headerRow += `<th>${raceName}</th>`;
            });
            headerRow += `<th>Points</th></tr>`;
            standingsTable.innerHTML = headerRow;
    
            // 2) Build the standings table rows
            standingsBody.innerHTML = "";
            standings.forEach((constructorObj, index) => {
                let rowHTML = `<tr><td>${index + 1}</td>`;
                rowHTML += `<td>${constructorObj.Constructor.name}</td>`;
    
                // For each round, constructorObj.Races[round] is an array of positions
                Object.keys(raceOrder).forEach(round => {
                    const positionsArray = constructorObj.Races[round] || [];
                    if (positionsArray.length === 0) {
                        rowHTML += `<td>-</td>`;
                    } else {
                        // e.g., if positionsArray = ["1","5"], display "1, 5"
                        rowHTML += `<td>${positionsArray.join(", ")}</td>`;
                    }
                });
    
                // Finally, show total points
                rowHTML += `<td>${constructorObj.TotalPoints}</td></tr>`;
                standingsBody.innerHTML += rowHTML;
            });
    
        } catch (error) {
            console.error("Error fetching constructor standings:", error);
            standingsBody.innerHTML = "<tr><td colspan='3'>Failed to load standings.</td></tr>";
        }
    }

    // When season changes, reload that season’s constructor standings
    seasonSelect.addEventListener("change", () => loadStandings(seasonSelect.value));

    // Fetch seasons on page load
    loadSeasons();
});