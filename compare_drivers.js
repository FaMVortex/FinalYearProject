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

    // Fetch available seasons
    async function loadSeasons() {
        try {
            const response = await fetch("/api/f1/seasons.json");
            const data = await response.json();
            const seasons = data.MRData.SeasonTable.Seasons
                .map(season => season.season)
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
            const response = await fetch(`/api/f1/${season}/drivers.json`);
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
        console.log(`Fetching driver standings for season ${season}`);
        let driverPoints = {};
        let totalRounds = 0;
    
        try {
            const response = await fetch(`/api/f1/${season}.json`);
            const data = await response.json();
            totalRounds = data.MRData.RaceTable.Races.length;
            allRounds = Array.from({ length: totalRounds }, (_, i) => `Round ${i + 1}`);
    
            // Initialize driver points storage correctly
            allDrivers.forEach(driver => {
                driverPoints[driver.id] = new Array(totalRounds).fill(0);
            });
    
            for (let round = 1; round <= totalRounds; round++) {
                console.log(`Fetching standings for round ${round}`);
    
                const roundResponse = await fetch(`/api/f1/${season}/${round}/driverStandings.json`);
                const roundData = await roundResponse.json();
    
                if (!roundData.MRData.StandingsTable.StandingsLists.length) {
                    console.warn(`No standings data for round ${round}`);
                    continue;
                }
    
                const standings = roundData.MRData.StandingsTable.StandingsLists[0].DriverStandings || [];
    
                standings.forEach(result => {
                    let driverId = result.Driver.driverId;
                    let points = parseFloat(result.points);
    
                    // Directly assign the API's cumulative points without adding previous rounds
                    driverPoints[driverId][round - 1] = points;
                });
    
                console.log(`Processed round ${round} standings:`, driverPoints);
            }
        } catch (error) {
            console.error("Error fetching driver standings:", error);
        }
    
        console.log("Final processed driver points:", driverPoints);
        return driverPoints;
    }

    async function fetchDriverStandings(season, round) {
        try {
            const response = await fetch(`/api/f1/${season}/${round}/driverStandings.json`);
            const data = await response.json();
    
            if (!data.MRData || !data.MRData.StandingsTable || !data.MRData.StandingsTable.StandingsLists) {
                console.error("Invalid API response format:", data);
                return;
            }
    
            // Ensure StandingsLists[0] exists
            const standingsLists = data.MRData.StandingsTable.StandingsLists;
            const driverStandings = standingsLists.length > 0 ? standingsLists[0].DriverStandings : [];
    
            console.log("Driver Standings Fetched:", driverStandings); // Debugging line
    
            return driverStandings;
        } catch (error) {
            console.error("Error fetching driver standings:", error);
            return [];
        }
    }
    
    // Ensure that data is mapped correctly when displaying the points
    async function displayDriverStandings(season, totalRounds) {
        let driverPoints = {};
    
        // Fetch all rounds
        for (let round = 1; round <= totalRounds; round++) {
            const standings = await fetchDriverStandings(season, round);
    
            standings.forEach(result => {
                let driverId = result.Driver.driverId;
                let points = parseFloat(result.points);
    
                if (!driverPoints[driverId]) {
                    driverPoints[driverId] = new Array(totalRounds).fill(0);
                }
    
                driverPoints[driverId][round - 1] = points;
    
                // Ensure cumulative tracking
                if (round > 1) {
                    driverPoints[driverId][round - 1] += driverPoints[driverId][round - 2];
                }
            });
        }
    
        console.log("Final Driver Points Data:", driverPoints); // Debugging line
        updateChart(driverPoints, totalRounds);
    }
    
    // Function to update the visualization
    function updateChart(driverPoints, totalRounds) {
        let labels = Array.from({ length: totalRounds }, (_, i) => `Round ${i + 1}`);
        let datasets = Object.keys(driverPoints).map(driverId => ({
            label: `Driver ${driverId}`,
            data: driverPoints[driverId],
            fill: false,
            borderColor: getRandomColor(),
            tension: 0.1
        }));
    
        let ctx = document.getElementById("driverStandingsChart").getContext("2d");
        new Chart(ctx, {
            type: "line",
            data: { labels, datasets },
            options: { responsive: true }
        });
    }

    // Fetch all drivers' data and render chart
    async function fetchAndRenderChart(season) {
        let datasets = [];
        showLoadingMessage(true);
    
        const driverPoints = await fetchAllDriverPoints(season);
    
        allDrivers.forEach(driver => {
            if (driverPoints[driver.id] && driverPoints[driver.id].some(point => point > 0)) { 
                datasets.push({
                    label: driver.name,
                    data: driverPoints[driver.id],
                    borderColor: "#" + Math.floor(Math.random() * 16777215).toString(16),
                    fill: false
                });
            }
        });
    
        if (datasets.length === 0) {
            console.warn("No valid driver data found for visualization.");
        }
    
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
            const roundResponse = await fetch(`/api/f1/${season}/${round}/results.json`);
            const data = await roundResponse.json();
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