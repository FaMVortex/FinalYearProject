document.addEventListener("DOMContentLoaded", () => {
    // Set global Chart.js default text color to white
    Chart.defaults.color = 'white';

    const seasonSelect = document.getElementById("season");
    const loadingMessage = document.getElementById("loadingMessage");
    const popup = document.getElementById("raceResultPopup");
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

            // Initialize driver points storage
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

                    // Assign cumulative points for this round
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

    // Fetch all drivers' data and render the chart
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

    // Render chart with interactive round selection and white text styling
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
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: "Rounds",
                            color: "white"
                        },
                        ticks: { color: 'white' },
                        grid: { color: 'rgba(255,255,255,0.2)' }
                    },
                    y: {
                        title: {
                            display: true,
                            text: "Cumulative Points",
                            color: "white"
                        },
                        ticks: { color: 'white' },
                        grid: { color: 'rgba(255,255,255,0.2)' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: 'white' },
                        onClick: (e, legendItem) => {
                            const index = legendItem.datasetIndex;
                            chartInstance.data.datasets[index].hidden = !chartInstance.data.datasets[index].hidden;
                            chartInstance.update();
                        }
                    },
                    tooltip: {
                        titleColor: 'white',
                        bodyColor: 'white',
                        footerColor: 'white'
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

    // Fetch driver race results for a specific round and display them in a popup
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

    // Utility function to generate a random hex color
    function getRandomColor() {
        return "#" + Math.floor(Math.random() * 16777215).toString(16);
    }
});