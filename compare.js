document.addEventListener("DOMContentLoaded", () => {
    const seasonSelect = document.getElementById("season");
    const loadingMessage = document.getElementById("loadingMessage");
    let chartInstance = null;

    async function loadSeasons() {
        try {
            const response = await fetch("/api/f1/seasons.json");
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

            fetchAndRenderChart(seasonSelect.value);
        } catch (error) {
            console.error("Error fetching seasons:", error);
        }
    }

    async function fetchAndRenderChart(season) {
        showLoadingMessage(true);

        try {
            const response = await fetch(`/api/f1/${season}/allConstructorStandings.json`);
            const data = await response.json();
            const standings = data.standings;

            const rounds = Object.keys(standings).sort((a, b) => parseInt(a) - parseInt(b));
            const teamPoints = {};

            rounds.forEach(round => {
                standings[round].forEach(team => {
                    if (!teamPoints[team.constructorName]) {
                        teamPoints[team.constructorName] = [];
                    }
                    teamPoints[team.constructorName].push(team.points);
                });
            });

            const datasets = Object.keys(teamPoints).map(teamName => ({
                label: teamName,
                data: teamPoints[teamName],
                borderColor: "#" + Math.floor(Math.random() * 16777215).toString(16),
                fill: false
            }));

            renderChart(rounds.map(r => `Round ${r}`), datasets);
        } catch (error) {
            console.error("Error fetching constructor standings:", error);
        }

        showLoadingMessage(false);
    }

    function renderChart(labels, datasets) {
        const ctx = document.getElementById("teamComparisonChart").getContext("2d");

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
                    line: { tension: 0.3, borderWidth: 2 },
                    point: { radius: 3 }
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: "white" },
                        onClick: (e, legendItem) => {
                            const index = legendItem.datasetIndex;
                            chartInstance.data.datasets[index].hidden = !chartInstance.data.datasets[index].hidden;
                            chartInstance.update();
                        }
                    },
                    zoom: {
                        pan: { enabled: true, mode: "x" },
                        zoom: {
                            wheel: { enabled: true, speed: 0.1 },
                            pinch: { enabled: true },
                            mode: "x"
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: "Rounds", color: "white" },
                        ticks: { color: "white", autoSkip: true, maxTicksLimit: 20 }
                    },
                    y: {
                        title: { display: true, text: "Cumulative Points", color: "white" },
                        ticks: { color: "white" }
                    }
                }
            }
        });
    }

    function showLoadingMessage(show) {
        loadingMessage.style.display = show ? "block" : "none";
    }

    loadSeasons();
    seasonSelect.addEventListener("change", () => fetchAndRenderChart(seasonSelect.value));
});