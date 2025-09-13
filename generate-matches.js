const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleSheetsService } = require('./services/googleSheets');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const googleSheetsService = new GoogleSheetsService();

// Matchmaking algorithm
function createOptimalMatches(players) {
    const numMatches = Math.floor(players.length / 10);
    
    if (numMatches === 0) return [];
    
    const playersToUse = players.slice(0, numMatches * 10);
    let bestMatches = null;
    let bestScore = Infinity;
    
    // Run optimization for up to 10000 iterations or 5 seconds
    const startTime = Date.now();
    const maxTime = 5000; // 5 seconds
    let iterations = 0;
    
    while (Date.now() - startTime < maxTime && iterations < 10000) {
        const matches = generateRandomMatches(playersToUse, numMatches);
        const score = evaluateMatches(matches);
        
        if (score < bestScore) {
            bestScore = score;
            bestMatches = JSON.parse(JSON.stringify(matches));
        }
        
        iterations++;
    }
    
    console.log(`Matchmaking completed: ${iterations} iterations, best score: ${bestScore}`);
    return bestMatches || [];
}

function generateRandomMatches(players, numMatches) {
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    const matches = [];
    
    for (let m = 0; m < numMatches; m++) {
        const matchPlayers = shuffledPlayers.slice(m * 10, (m + 1) * 10);
        const teams = [[], []];
        
        // Assign players to teams and roles
        for (let i = 0; i < 10; i++) {
            teams[i % 2].push(matchPlayers[i]);
        }
        
        // Assign roles to each team
        const team1 = assignRolesToTeam(teams[0]);
        const team2 = assignRolesToTeam(teams[1]);
        
        matches.push({ team1, team2 });
    }
    
    return matches;
}

function assignRolesToTeam(teamPlayers) {
    const roles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
    const assignments = [];
    const availableRoles = [...roles];
    const unassignedPlayers = [...teamPlayers];
    
    // First pass: assign primary roles
    for (const role of roles) {
        const playerIndex = unassignedPlayers.findIndex(p => 
            p.primaryRole === role || (p.primaryRole === 'Fill' && availableRoles.includes(role))
        );
        
        if (playerIndex !== -1) {
            const player = unassignedPlayers.splice(playerIndex, 1)[0];
            assignments.push({
                ...player,
                assignedRole: role,
                roleType: player.primaryRole === role ? 'Primary' : (player.primaryRole === 'Fill' ? 'Fill' : 'Primary')
            });
            availableRoles.splice(availableRoles.indexOf(role), 1);
        }
    }
    
    // Second pass: assign secondary roles
    for (const role of [...availableRoles]) {
        const playerIndex = unassignedPlayers.findIndex(p => 
            p.secondaryRole === role || (p.secondaryRole === 'Fill' && availableRoles.includes(role))
        );
        
        if (playerIndex !== -1) {
            const player = unassignedPlayers.splice(playerIndex, 1)[0];
            assignments.push({
                ...player,
                assignedRole: role,
                roleType: player.secondaryRole === role ? 'Secondary' : 'Fill'
            });
            availableRoles.splice(availableRoles.indexOf(role), 1);
        }
    }
    
    // Third pass: autofill remaining roles
    for (let i = 0; i < availableRoles.length && i < unassignedPlayers.length; i++) {
        const player = unassignedPlayers[i];
        assignments.push({
            ...player,
            assignedRole: availableRoles[i],
            roleType: 'Autofill'
        });
    }
    
    return assignments;
}

function evaluateMatches(matches) {
    let totalScore = 0;
    
    for (const match of matches) {
        const team1Score = evaluateTeam(match.team1);
        const team2Score = evaluateTeam(match.team2);
        const mmrDiff = Math.abs(team1Score.adjustedMMR - team2Score.adjustedMMR);
        
        // Scoring: minimize MMR difference, role penalties, and autofills
        totalScore += mmrDiff + team1Score.rolePenalty + team2Score.rolePenalty + 
                     (team1Score.autofills + team2Score.autofills) * 50;
    }
    
    return totalScore;
}

function evaluateTeam(team) {
    let totalMMR = 0;
    let rolePenalty = 0;
    let autofills = 0;
    
    for (const player of team) {
        let playerMMR = player.mmr;
        
        if (player.roleType === 'Autofill') {
            playerMMR *= 0.80; // 20% penalty for autofill
            autofills++;
            rolePenalty += 100;
        } else if (player.roleType === 'Secondary') {
            rolePenalty += 25;
        } 
        
        totalMMR += playerMMR;
    }
    
    return {
        adjustedMMR: totalMMR,
        rolePenalty,
        autofills
    };
}

client.once('ready', async () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    
    try {
        // Get 22 random players from Google Sheets (20 for matches + 2 for flex queue)
        const randomPlayers = await googleSheetsService.getRandomPlayers(22);
        
        if (randomPlayers.length < 20) {
            console.log(`❌ Not enough players in database. Need at least 20 players, found ${randomPlayers.length}.`);
            process.exit(1);
        }
        
        // Add mock display names for the players
        const testPlayers = randomPlayers.map((player, index) => ({
            ...player,
            userId: `test_${index}`,
            username: player.discordUsername,
            displayName: player.discordUsername,
            joinTime: Date.now() - (index * 1000)
        }));
        
        // Separate players for matches and flex queue
        const numMatches = Math.floor(testPlayers.length / 10);
        const playersForMatching = testPlayers.slice(0, numMatches * 10);
        const flexQueuePlayers = testPlayers.slice(numMatches * 10);
        
        // Create matches
        const matches = createOptimalMatches(playersForMatching);
        
        if (matches.length === 0) {
            console.log('❌ Failed to create matches.');
            process.exit(1);
        }
        
        // Find the fight-night-general channel
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) {
            console.log('❌ Could not find guild.');
            process.exit(1);
        }
        
        const channel = guild.channels.cache.find(ch => ch.name === 'fight-night-general');
        if (!channel) {
            console.log('❌ Could not find #fight-night-general channel.');
            process.exit(1);
        }
        
        // First message: Player lists
        let playerListOutput = `🎮 **FIGHT NIGHT PLAYER ASSIGNMENTS** 🎮\n\n`;
        
        // Players in matches
        playerListOutput += `**Players in Matches (${playersForMatching.length} players):**\n`;
        for (const player of playersForMatching) {
            const namePadded = player.displayName.padEnd(20);
            const riotPadded = player.riotId.padEnd(25);
            const mmrPadded = `${player.mmr} MMR`.padEnd(10);
            const rolesPadded = `${player.primaryRole}/${player.secondaryRole}`.padEnd(15);
            playerListOutput += `\`${namePadded} ${riotPadded} ${mmrPadded} ${rolesPadded}\`\n`;
        }
        
        // Flex queue players
        if (flexQueuePlayers.length > 0) {
            playerListOutput += `\n**Flex Queue (${flexQueuePlayers.length} players):**\n`;
            for (const player of flexQueuePlayers) {
                const namePadded = player.displayName.padEnd(20);
                const riotPadded = player.riotId.padEnd(25);
                const mmrPadded = `${player.mmr} MMR`.padEnd(10);
                const rolesPadded = `${player.primaryRole}/${player.secondaryRole}`.padEnd(15);
                playerListOutput += `\`${namePadded} ${riotPadded} ${mmrPadded} ${rolesPadded}\`\n`;
            }
        }
        
        // Post player list
        await channel.send(playerListOutput);
        console.log('Posted player assignments to #fight-night-general');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Post each match in separate messages
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const team1MMR = match.team1.reduce((sum, p) => sum + (p.roleType === 'Autofill' ? p.mmr * 0.80 : p.mmr), 0);
            const team2MMR = match.team2.reduce((sum, p) => sum + (p.roleType === 'Autofill' ? p.mmr * 0.80 : p.mmr), 0);
            const mmrDiff = Math.abs(team1MMR - team2MMR);
            
            let matchOutput = `🎮 **MATCH ${i + 1}** (MMR Difference: ${Math.round(mmrDiff)}) 🎮\n\n`;
            
            // Team 1
            matchOutput += `**Team 1:**\n`;
            const roles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
            for (const role of roles) {
                const player = match.team1.find(p => p.assignedRole === role);
                if (player) {
                    let roleText = '';
                    if (player.roleType === 'Secondary') roleText = ' Secondary';
                    else if (player.roleType === 'Autofill') roleText = ' Autofill';
                    
                    const rolePadded = role.padEnd(8);
                    const namePadded = player.displayName.padEnd(20);
                    const riotPadded = player.riotId.padEnd(25);
                    const mmrPadded = `${player.mmr} MMR`.padEnd(10);
                    matchOutput += `\`${rolePadded} ${namePadded} ${riotPadded} ${mmrPadded}\`${roleText}\n`;
                }
            }
            
            // Team 2
            matchOutput += `\n**Team 2:**\n`;
            for (const role of roles) {
                const player = match.team2.find(p => p.assignedRole === role);
                if (player) {
                    let roleText = '';
                    if (player.roleType === 'Secondary') roleText = ' Secondary';
                    else if (player.roleType === 'Autofill') roleText = ' Autofill';
                    
                    const rolePadded = role.padEnd(8);
                    const namePadded = player.displayName.padEnd(20);
                    const riotPadded = player.riotId.padEnd(25);
                    const mmrPadded = `${player.mmr} MMR`.padEnd(10);
                    matchOutput += `\`${rolePadded} ${namePadded} ${riotPadded} ${mmrPadded}\`${roleText}\n`;
                }
            }
            
            // Post the match to the channel
            await channel.send(matchOutput);
            console.log(`Posted Match ${i + 1} to #fight-night-general`);
            
            // Small delay between messages
            if (i < matches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`✅ Successfully posted player list and ${matches.length} matches to #fight-night-general!`);
        process.exit(0);
        
    } catch (error) {
        console.error('Error generating matches:', error);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
