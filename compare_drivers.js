document.addEventListener("DOMContentLoaded", () => {
    const seasonSelect = document.getElementById("season");
    const loadingMessage = document.getElementById("loadingMessage");
    const popup = document.getElementById("raceResultPopup");
    const popupContent = document.getElementById("raceResults");
    const closePopup = document.querySelector(".close-popup");
    let chartInstance = null;
    let allDrivers = [];
    let allRounds = [];

    // Close popup when clicking on close button
    closePopup.addEventListener("click", () => {
        popup.style.display = "none";
    });

    // Fetch available seasons (starting from 1958)
    async function loadSeasons() {
        try {
            const response = await fetch("https://ergast.com/api/f1/seasons.json?limit=100");
            const data = await response.json();
            const seasons = data.MRData.SeasonTable.Seasons
                .map(season => season.season)
                .filter(season => parseInt(season) >= 1958)
                .reverse();

            seasons.forEach(season => {
                let option = document.createElement("option");
                option.value = season;
                option.textContent = season;
                seasonSelect.appendChild(option);
            });

            loadDrivers(seasonSelect.value);
        } catch (error) {
            console.error("Error fetching seasons:", error);
        }
    }

    // Fetch drivers for a given season
    async function loadDrivers(season) {
        allDrivers = [];
        showLoadingMessage(true);

        try {
            const response = await fetch(`https://ergast.com/api/f1/${season}/drivers.json`);
            const data = await response.json();
            allDrivers = data.MRData.DriverTable.Drivers.map(driver => ({
                name: `${driver.givenName} ${driver.familyName}`,
                id: driver.driverId
            }));

            fetchAndRenderChart(season);
        } catch (error) {
            console.error("Error fetching drivers:", error);
        }
    }

    // Fetch round-by-round points for each driver
    async function fetchAllDriverPoints(season) {
        let driverPoints = {};
        let totalRounds = 0;

        try {
            const response = await fetch(`https://ergast.com/api/f1/${season}.json`);
            const data = await response.json();
            totalRounds = data.MRData.RaceTable.Races.length;
            allRounds = Array.from({ length: totalRounds }, (_, i) => `Round ${i + 1}`);

            // Initialize driver points structure
            allDrivers.forEach(driver => {
                driverPoints[driver.id] = new Array(totalRounds).fill(0);
            });

            // Fetch race results for each round
            for (let round = 1; round <= totalRounds; round++) {
                const roundResponse = await fetch(`https://ergast.com/api/f1/${season}/${round}/results.json`);
                const roundData = await roundResponse.json();
                const raceResults = roundData.MRData.RaceTable.Races[0]?.Results || [];

                // Update points based on actual race results
                raceResults.forEach(result => {
                    if (driverPoints[result.Driver.driverId]) {
                        driverPoints[result.Driver.driverId][round - 1] = parseFloat(result.points);
                    }
                });

                // Ensure cumulative tracking without overcounting
                allDrivers.forEach(driver => {
                    if (round > 1) {
                        driverPoints[driver.id][round - 1] += driverPoints[driver.id][round - 2];
                    }
                });
            }
        } catch (error) {
            console.error("Error fetching driver standings:", error);
        }

        return driverPoints;
    }

    // Fetch all drivers' data and render chart
    async function fetchAndRenderChart(season) {
        let datasets = [];
        showLoadingMessage(true);

        const driverPoints = await fetchAllDriverPoints(season);

        allDrivers.forEach(driver => {
            if (driverPoints[driver.id]) {
                datasets.push({
                    label: driver.name,
                    data: driverPoints[driver.id],
                    borderColor: "#" + Math.floor(Math.random() * 16777215).toString(16),
                    fill: false,
                    hidden: false
                });
            }
        });

        renderChart(allRounds, datasets, season);
        showLoadingMessage(false);
    }

    // Render chart with interactive round selection
    function renderChart(labels, datasets, season) {
        const ctx = document.getElementById("driverComparisonChart").getContext("2d");

        if (chartInstance) {
            chartInstance.destroy();
        }

        chartInstance = new Chart(ctx, {
            type: "line",
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                elements: {
                    line: {
                        tension: 0.3,
                        borderWidth: 2
                    },
                    point: {
                        radius: 3
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        onClick: (e, legendItem) => {
                            const index = legendItem.datasetIndex;
                            chartInstance.data.datasets[index].hidden = !chartInstance.data.datasets[index].hidden;
                            chartInstance.update();
                        }
                    }
                },
                onClick: async (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const datasetIndex = elements[0].datasetIndex;
                        const round = index + 1;
                        const driverId = allDrivers[datasetIndex].id;

                        fetchRaceResults(season, round, driverId);
                    }
                }
            }
        });
    }

    // Fetch driver race results for a specific round
    async function fetchRaceResults(season, round, driverId) {
        try {
            const response = await fetch(`https://ergast.com/api/f1/${season}/${round}/results.json`);
            const data = await response.json();
            const raceResults = data.MRData.RaceTable.Races[0].Results;
    
            // Find the specific driver's results
            const driverResult = raceResults.find(result => result.Driver.driverId === driverId);
    
            if (driverResult) {
                document.getElementById("round-info").innerHTML = `<strong>Round:</strong> ${round} - ${season}`;
                document.getElementById("driver-info").innerHTML = `<strong>Driver:</strong> ${driverResult.Driver.givenName} ${driverResult.Driver.familyName}`;
                document.getElementById("points-info").innerHTML = `<strong>Points Scored:</strong> ${driverResult.points}`;
    
                // Show the popup
                document.getElementById("raceResultPopup").style.display = "block";
            } else {
                document.getElementById("raceResultPopup").innerHTML = "<p>No results available for this round.</p>";
                document.getElementById("raceResultPopup").style.display = "block";
            }
        } catch (error) {
            console.error("Error fetching driver results:", error);
            document.getElementById("raceResultPopup").innerHTML = "<p>Could not fetch results.</p>";
            document.getElementById("raceResultPopup").style.display = "block";
        }
    }

    function showLoadingMessage(show) {
        loadingMessage.style.display = show ? "block" : "none";
    }

    loadSeasons();
    seasonSelect.addEventListener("change", () => loadDrivers(seasonSelect.value));
});