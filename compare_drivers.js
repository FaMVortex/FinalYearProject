document.addEventListener("DOMContentLoaded", () => {
    Chart.defaults.color = 'white';

    const seasonSelect = document.getElementById("season");
    const loadingMessage = document.getElementById("loadingMessage");
    const popup = document.getElementById("raceResultPopup");
    const closePopup = document.querySelector(".close-popup");
    let chartInstance = null;
    let currentSeason = null;
    let driverIds = {};

    closePopup.addEventListener("click", () => {
        popup.style.display = "none";
    });

    async function loadSeasons() {
        try {
            const response = await fetch("/api/f1/seasons.json");
            const data = await response.json();
            const seasons = data.MRData.SeasonTable.Seasons.map(season => season.season).reverse();

            seasons.forEach(season => {
                let option = document.createElement("option");
                option.value = season;
                option.textContent = season;
                seasonSelect.appendChild(option);
            });

            fetchAndRenderChart(seasonSelect.value);
        } catch (error) {
            console.error("Error fetching seasons:", error);
        }
    }

    async function fetchAndRenderChart(season) {
        currentSeason = season;
        showLoadingMessage(true);

        try {
            const response = await fetch(`/api/f1/${season}/allDriverStandings.json`);
            const data = await response.json();
            const standings = data.standings;

            const rounds = Object.keys(standings).sort((a, b) => parseInt(a) - parseInt(b));
            const driverPoints = {};
            driverIds = {};

            rounds.forEach(round => {
                standings[round].forEach(driver => {
                    const driverName = `${driver.givenName} ${driver.familyName}`;
                    driverIds[driverName] = driver.driverId;
                    if (!driverPoints[driverName]) {
                        driverPoints[driverName] = [];
                    }
                    driverPoints[driverName].push(driver.points);
                });
            });

            const datasets = Object.keys(driverPoints).map(driverName => ({
                label: driverName,
                data: driverPoints[driverName],
                borderColor: "#" + Math.floor(Math.random() * 16777215).toString(16),
                fill: false
            }));

            renderChart(rounds.map(r => `Round ${r}`), datasets);
        } catch (error) {
            console.error("Error fetching driver standings:", error);
        }

        showLoadingMessage(false);
    }

    function renderChart(labels, datasets) {
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
                elements: { line: { tension: 0.3, borderWidth: 2 }, point: { radius: 3 } },
                plugins: {
                    legend: {
                        labels: { color: 'white' },
                        onClick: (e, legendItem) => {
                            const index = legendItem.datasetIndex;
                            chartInstance.data.datasets[index].hidden = !chartInstance.data.datasets[index].hidden;
                            chartInstance.update();
                        }
                    },
                    tooltip: { titleColor: 'white', bodyColor: 'white' }
                },
                scales: {
                    x: { title: { display: true, text: "Rounds", color: "white" }, ticks: { color: 'white' } },
                    y: { title: { display: true, text: "Cumulative Points", color: "white" }, ticks: { color: 'white' } }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const datasetIndex = elements[0].datasetIndex;
                        const round = index + 1;
                        const driverName = chartInstance.data.datasets[datasetIndex].label;
                        const driverId = driverIds[driverName];
                        fetchRaceResults(currentSeason, round, driverId);
                    }
                }
            }
        });
    }

    async function fetchRaceResults(season, round, driverId) {
        try {
            const res = await fetch(`/api/f1/${season}/${round}/results.json`);
            const data = await res.json();
            const raceResults = data.MRData.RaceTable.Races[0].Results;
            const driverResult = raceResults.find(result => result.Driver.driverId === driverId);

            if (driverResult) {
                document.getElementById("round-info").innerHTML = `<strong>Round:</strong> ${round} - ${season}`;
                document.getElementById("driver-info").innerHTML = `<strong>Driver:</strong> ${driverResult.Driver.givenName} ${driverResult.Driver.familyName}`;
                document.getElementById("points-info").innerHTML = `<strong>Points Scored:</strong> ${driverResult.points}`;
                popup.style.display = "block";
            } else {
                popup.innerHTML = "<p>No results available for this round.</p>";
                popup.style.display = "block";
            }
        } catch (error) {
            console.error("Error fetching driver results:", error);
            popup.innerHTML = "<p>Could not fetch results.</p>";
            popup.style.display = "block";
        }
    }

    function showLoadingMessage(show) {
        loadingMessage.style.display = show ? "block" : "none";
    }

    loadSeasons();
    seasonSelect.addEventListener("change", () => fetchAndRenderChart(seasonSelect.value));
});