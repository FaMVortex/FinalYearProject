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
            const response = await fetch(`/api/f1/${season}/constructorResultsTable.json`);
            const data = await response.json();
    
            const raceOrder = data.MRData.StandingsTable.Races; 
            const standings = data.MRData.StandingsTable.ConstructorResults; 
    
            let headerRow = `<tr><th>Position</th><th>Constructor</th>`;
            Object.values(raceOrder).forEach(raceName => {
                headerRow += `<th>${raceName}</th>`;
            });
            headerRow += `<th>Points</th></tr>`;
            standingsTable.innerHTML = headerRow;
    
            standingsBody.innerHTML = "";
            standings.forEach((constructorObj, index) => {
                let rowHTML = `<tr><td>${index + 1}</td>`;
                rowHTML += `<td>${constructorObj.Constructor.name}</td>`;
    
                Object.keys(raceOrder).forEach(round => {
                    const positionsArray = constructorObj.Races[round] || [];

                    if (positionsArray.length === 0) {
                        rowHTML += `<td>-</td>`;
                    } else {
                        let highlightClass = "";
                        let cellText = positionsArray.join("<br>");

                        positionsArray.forEach(pos => {
                            const numericPos = parseInt(pos, 10);
                            if (!isNaN(numericPos)) {
                                if (numericPos === 1 && highlightClass !== "gold-cell") {
                                    highlightClass = "gold-cell";
                                } else if (
                                    numericPos === 2 &&
                                    highlightClass !== "gold-cell" &&
                                    highlightClass !== "silver-cell"
                                ) {
                                    highlightClass = "silver-cell";
                                } else if (
                                    numericPos === 3 &&
                                    !["gold-cell", "silver-cell", "bronze-cell"].includes(highlightClass)
                                ) {
                                    highlightClass = "bronze-cell";
                                } else if (
                                    numericPos >= 4 &&
                                    numericPos <= 10 &&
                                    !["gold-cell", "silver-cell", "bronze-cell", "green-cell"].includes(highlightClass)
                                ) {
                                    highlightClass = "green-cell";
                                }
                            }
                        });

                        rowHTML += `<td class="${highlightClass}">${cellText}</td>`;
                    }
                });
    
                rowHTML += `<td>${constructorObj.TotalPoints}</td></tr>`;
                standingsBody.innerHTML += rowHTML;
            });
    
        } catch (error) {
            console.error("Error fetching constructor standings:", error);
            standingsBody.innerHTML = "<tr><td colspan='3'>Failed to load standings.</td></tr>";
        }
    }

    seasonSelect.addEventListener("change", () => loadStandings(seasonSelect.value));

    loadSeasons();
});