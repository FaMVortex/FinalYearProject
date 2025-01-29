document.addEventListener("DOMContentLoaded", () => {
    const seasonSelect = document.getElementById("season");
    const team1Select = document.getElementById("team1");
    const team2Select = document.getElementById("team2");
    const form = document.getElementById("teamSelectionForm");
    let chartInstance = null;

    // Fetch available seasons
    async function loadSeasons() {
        try {
            const response = await fetch("https://ergast.com/api/f1/seasons.json?limit=100");
            const data = await response.json();
            const seasons = data.MRData.SeasonTable.Seasons.map(season => season.season).reverse();

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
        team1Select.innerHTML = "";
        team2Select.innerHTML = "";

        try {
            const response = await fetch(`https://ergast.com/api/f1/${season}/constructors.json`);
            const data = await response.json();
            const teams = data.MRData.ConstructorTable.Constructors.map(team => ({
                name: team.name,
                id: team.constructorId
            }));

            teams.forEach(team => {
                let option1 = document.createElement("option");
                let option2 = document.createElement("option");
                option1.value = option2.value = team.id;
                option1.textContent = option2.textContent = team.name;
                team1Select.appendChild(option1);
                team2Select.appendChild(option2);
            });
        } catch (error) {
            console.error("Error fetching teams:", error);
        }
    }

    // Fetch total rounds in a season
    async function fetchTotalRounds(season) {
        try {
            const response = await fetch(`https://ergast.com/api/f1/${season}.json`);
            const data = await response.json();
            return data.MRData.RaceTable.Races.length;
        } catch (error) {
            console.error("Error fetching total rounds:", error);
            return 0;
        }
    }

    // Fetch cumulative points per round for a team
    async function fetchTeamPoints(season, teamId) {
        const totalRounds = await fetchTotalRounds(season);
        let pointsMap = new Array(totalRounds).fill(0); // Initialize with 0s
        let cumulativePoints = 0;

        try {
            for (let round = 1; round <= totalRounds; round++) {
                const response = await fetch(`https://ergast.com/api/f1/${season}/${round}/constructorStandings.json`);
                const data = await response.json();
                const standings = data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [];

                const teamData = standings.find(team => team.Constructor.constructorId === teamId);

                if (teamData) {
                    cumulativePoints = parseFloat(teamData.points); // Set latest points
                }

                pointsMap[round - 1] = cumulativePoints; // Store in correct index
            }
        } catch (error) {
            console.error(`Error fetching team points for ${teamId}:`, error);
        }

        return pointsMap;
    }

    // Handle form submission
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const season = seasonSelect.value;
        const team1 = team1Select.value;
        const team2 = team2Select.value;

        if (!season || !team1 || !team2) return alert("Please select all options.");

        const totalRounds = await fetchTotalRounds(season);
        const rounds = Array.from({ length: totalRounds }, (_, i) => `Round ${i + 1}`);

        const team1Points = await fetchTeamPoints(season, team1);
        const team2Points = await fetchTeamPoints(season, team2);

        renderChart(rounds, team1Points, team2Points, team1, team2);
    });

    // Render chart with interactive click feature
    function renderChart(labels, team1Data, team2Data, team1, team2) {
        const ctx = document.getElementById("teamComparisonChart").getContext("2d");

        if (chartInstance) {
            chartInstance.destroy();
        }

        chartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: team1,
                        data: team1Data,
                        borderColor: "red",
                        fill: false,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    },
                    {
                        label: team2,
                        data: team2Data,
                        borderColor: "blue",
                        fill: false,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }
                ]
            },
            options: {
                onClick: async (event, elements) => {
                    if (elements.length > 0) {
                        const datasetIndex = elements[0].datasetIndex;
                        const index = elements[0].index;
                        const selectedTeam = datasetIndex === 0 ? team1 : team2;
                        const selectedRound = index + 1;  // Convert index to round number
                        const selectedSeason = seasonSelect.value;

                        // Fetch results for the clicked round
                        const results = await fetchRaceResults(selectedSeason, selectedRound, selectedTeam);
                        displayRaceResults(selectedSeason, selectedRound, selectedTeam, results);
                    }
                }
            }
        });
    }

    // Fetch race results for both drivers of a team
    async function fetchRaceResults(season, round, teamId) {
        try {
            const response = await fetch(`https://ergast.com/api/f1/${season}/${round}/results.json`);
            const data = await response.json();
            const raceResults = data.MRData.RaceTable.Races[0].Results;

            // Filter results for selected team
            const teamResults = raceResults.filter(result => result.Constructor.constructorId === teamId);

            return teamResults.map(result => ({
                driver: `${result.Driver.givenName} ${result.Driver.familyName}`,
                position: result.position,
                points: result.points
            }));
        } catch (error) {
            console.error("Error fetching race results:", error);
            return [];
        }
    }

    // Display results in an alert or modal
    function displayRaceResults(season, round, team, results) {
        let message = `🏁 **Race Results - Season ${season}, Round ${round}**\n\n`;
        message += `🏎️ Team: ${team}\n\n`;
        results.forEach(result => {
            message += `👤 ${result.driver}\n📍 Position: ${result.position}\n🏆 Points: ${result.points}\n\n`;
        });

        alert(message);
    }

    // Load seasons on page load
    loadSeasons();

    // Update teams when season is changed
    seasonSelect.addEventListener("change", () => {
        loadTeams(seasonSelect.value);
    });
});