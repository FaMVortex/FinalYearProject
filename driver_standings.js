document.addEventListener("DOMContentLoaded", () => {
    const seasonSelect = document.getElementById("season");
    const standingsBody = document.getElementById("standings-body");
    const standingsTable = document.querySelector(".standings-container table thead");

    async function loadSeasons() {
        try {
            const response = await fetch("/api/f1/seasons.json");
            const data = await response.json();
            const seasons = data.MRData.SeasonTable.Seasons;

            seasons.forEach(season => {
                let option = document.createElement("option");
                option.value = season.season;
                option.textContent = season.season;
                seasonSelect.appendChild(option);
            });
            loadStandings(seasonSelect.value);
        } catch (error) {
            console.error("Error fetching seasons:", error);
        }
    }

    async function loadStandings(season) {
        standingsBody.innerHTML = "<tr><td colspan='3'>Loading...</td></tr>";

        try {
            const response = await fetch(`/api/f1/${season}/driverResultsTable.json`);
            const data = await response.json();
            const raceOrder = data.MRData.StandingsTable.Races;
            const standings = data.MRData.StandingsTable.DriverResults;

            // Update table headers
            let headerRow = `<tr><th>Position</th><th>Driver</th>`;
            Object.values(raceOrder).forEach(raceName => {
                headerRow += `<th>${raceName}</th>`;
            });
            headerRow += `<th>Points</th></tr>`;
            standingsTable.innerHTML = headerRow;

            // Update driver standings
            standingsBody.innerHTML = "";
            standings.forEach((driver, index) => {
                let row = `<tr><td>${index + 1}</td>`;
                row += `<td>${driver.Driver.givenName} ${driver.Driver.familyName}</td>`;

                Object.keys(raceOrder).forEach(round => {
                    let position = driver.Races[round] || "-";
                    row += `<td>${position}</td>`;
                });

                row += `<td>${driver.TotalPoints}</td></tr>`;
                standingsBody.innerHTML += row;
            });

        } catch (error) {
            console.error("Error fetching driver standings:", error);
            standingsBody.innerHTML = "<tr><td colspan='3'>Failed to load standings.</td></tr>";
        }
    }

    seasonSelect.addEventListener("change", () => loadStandings(seasonSelect.value));
    loadSeasons();
});