document.addEventListener("DOMContentLoaded", () => {
    const seasonSelect = document.getElementById("season");
    const loadingMessage = document.getElementById("loadingMessage");
    let chartInstance = null;
    let allTeams = [];
    let allRounds = [];

    // Fetch available seasons (starting from 1958)
    async function loadSeasons() {
        try {
            const response = await fetch("/api/f1/seasons.json");
            const data = await response.json();
            const seasons = data.MRData.SeasonTable.Seasons
                .map(season => season.season)
                .filter(season => parseInt(season) >= 1958) // Remove seasons before 1958
                .reverse();

            seasons.forEach(season => {
                let option = document.createElement("option");
                option.value = season;
                option.textContent = season;
                seasonSelect.appendChild(option);
            });

            loadTeams(seasonSelect.value);
        } catch (error) {
            console.error("Error fetching seasons:", error);
        }
    }

    // Fetch teams for a given season
    async function loadTeams(season) {
        allTeams = [];
        showLoadingMessage(true);

        try {
            const response = await fetch(`/api/f1/${season}/constructors.json`);
            const data = await response.json();
            allTeams = data.MRData.ConstructorTable.Constructors.map(team => ({
                name: team.name,
                id: team.constructorId
            }));

            fetchAndRenderChart(season);
        } catch (error) {
            console.error("Error fetching teams:", error);
        }
    }

    // Fetch cumulative points per round for a team
    async function fetchTeamPoints(season, teamId) {
        let points = [];
        let cumulativePoints = 0;
        let totalRounds = 0;

        try {
            const response = await fetch(`/api/f1/${season}.json`);
            const data = await response.json();
            totalRounds = data.MRData.RaceTable.Races.length;

            for (let round = 1; round <= totalRounds; round++) {
                const roundResponse = await fetch(`/api/f1/${season}/${round}/constructorStandings.json`);
                const roundData = await roundResponse.json();
                const standings = roundData.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [];

                const teamData = standings.find(team => team.Constructor.constructorId === teamId);

                if (teamData) {
                    cumulativePoints = parseFloat(teamData.points);
                }

                points.push(cumulativePoints);
            }
        } catch (error) {
            console.error(`Error fetching team points for ${teamId}:`, error);
        }
        return points;
    }

    // Fetch all teams' data and render chart
    async function fetchAndRenderChart(season) {
        let datasets = [];
        allRounds = [];

        for (let team of allTeams) {
            let points = await fetchTeamPoints(season, team.id);
            if (points.length > allRounds.length) {
                allRounds = points.map((_, i) => `Round ${i + 1}`);
            }

            datasets.push({
                label: team.name,
                data: points,
                borderColor: "#" + Math.floor(Math.random() * 16777215).toString(16),
                fill: false,
                hidden: false
            });
        }

        renderChart(allRounds, datasets);
        showLoadingMessage(false);
    }

    // Render chart with legend-based toggling
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
                    line: {
                        tension: 0.3, // Smooth curves
                        borderWidth: 2, // Ensure lines are clearly visible
                    },
                    point: {
                        radius: 3, // Make points visible
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: "white",
                        },
                        onClick: (e, legendItem) => {
                            const index = legendItem.datasetIndex;
                            chartInstance.data.datasets[index].hidden = !chartInstance.data.datasets[index].hidden;
                            chartInstance.update();
                        }
                    },
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: "x", // Enable horizontal panning
                        },
                        zoom: {
                            wheel: {
                                enabled: true, // Enable zooming with the mouse wheel
                                speed: 0.1, // Slow zoom for better control
                            },
                            pinch: {
                                enabled: true, // Enable pinch zooming on touch devices
                            },
                            mode: "x", // Zoom only along the x-axis
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: "Rounds",
                            color: "white",
                        },
                        ticks: {
                            color: "white",
                            autoSkip: true,
                            maxTicksLimit: 20,
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: "Cumulative Points",
                            color: "white",
                        },
                        ticks: {
                            color: "white",
                        }
                    }
                }
            }
        });
    }

    function showLoadingMessage(show) {
        loadingMessage.style.display = show ? "block" : "none";
    }

    loadSeasons();
    seasonSelect.addEventListener("change", () => loadTeams(seasonSelect.value));
});