const { SlashCommandBuilder } = require('discord.js');
const { GoogleSheetsService } = require('../services/googleSheets');
const { DebugLogger } = require('../utils/debugLogger');

const googleSheetsService = new GoogleSheetsService();
const debugLogger = new DebugLogger();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test-matchmaking-algorithm')
        .setDescription('Test matchmaking algorithm with random players')
        .addIntegerOption(option =>
            option.setName('players')
                .setDescription('Number of players to test with')
                .setRequired(false)),
    
    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can test matchmaking.',
                ephemeral: true
            });
        }
        
        
        // Use centralized debug logger
        const debug = debugLogger.createLogger(interaction.guild);
        
        try {
            await interaction.deferReply();
            await debug.info('**Test Matchmaking**: Test matchmaking algorithm initiated');
            
            let playerCount = interaction.options.getInteger('players');
            
            // If no player count provided, ask for it
            if (!playerCount) {
                await interaction.editReply('How many players should be considered for this test?');
                await debug.info('**Test Matchmaking**: Waiting for player count input from moderator/admin');
                
                // Wait for response
                const filter = (message) => {
                    const hasRole = message.member.roles.cache.some(role => 
                        role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
                    );
                    return hasRole && !isNaN(parseInt(message.content));
                };
                
                try {
                    const collected = await interaction.channel.awaitMessages({
                        filter,
                        max: 1,
                        time: 60000,
                        errors: ['time']
                    });
                    
                    playerCount = parseInt(collected.first().content);
                    await debug.info(`**Test Matchmaking**: Received player count: ${playerCount}`);
                } catch (error) {
                    await debug.warn('**Test Matchmaking**: No valid response received within time limit');
                    return await interaction.editReply('❌ No valid number provided within 60 seconds.');
                }
            }
            
            if (playerCount < 10) {
                await debug.error('**Test Matchmaking**: Invalid player count - less than 10');
                return await interaction.editReply('❌ Need at least 10 players for testing.');
            }
            
            // Get random players from Google Sheets
            await debug.info(`**Test Matchmaking**: Selecting ${playerCount} random players from Google Sheets`);
            const randomPlayers = await googleSheetsService.getRandomPlayers(playerCount);
            
            if (randomPlayers.length < playerCount) {
                await debug.warn(`**Test Matchmaking**: Only found ${randomPlayers.length} players in Google Sheets`);
                return await interaction.editReply(`❌ Only found ${randomPlayers.length} players in Google Sheets. Need ${playerCount} players.`);
            }
            
            // Display selected players (chunked to avoid message length limits)
            let playersList = `**Selected ${playerCount} Random Players:**\n\n`;
            
            // Show only first 10 players in main message to avoid length issues
            const playersToShow = Math.min(randomPlayers.length, 10);
            for (let i = 0; i < playersToShow; i++) {
                const player = randomPlayers[i];
                playersList += `${i + 1}. **${player.username}** (${player.riotId}) - MMR: ${player.mmr}\n`;
            }
            
            if (randomPlayers.length > 10) {
                playersList += `\n... and ${randomPlayers.length - 10} more players`;
            }
            
            await interaction.editReply(playersList);
            await debug.info('**Test Matchmaking**: Listed selected random players');
            
            // Calculate number of full matches
            const N = Math.floor(playerCount / 10);
            await debug.info(`**Test Matchmaking**: Can create ${N} full matches from ${playerCount} players`);
            
            if (N === 0) {
                return await interaction.followUp('❌ Not enough players for a full match.');
            }
            
            // Create matchmaking list (first N*10 players)
            const matchmakingList = randomPlayers.slice(0, N * 10);
            const flexQueueList = randomPlayers.slice(N * 10);
            
            // Convert to match format with user IDs and display names
            const testPlayers = matchmakingList.map((player, index) => {
                // Try to find the actual Discord member to get their display name
                let displayName = player.username;
                const member = interaction.guild.members.cache.find(m => m.user.username === player.username);
                if (member) {
                    displayName = member.displayName;
                }
                
                return {
                    userId: `test_${index}`,
                    username: player.username,
                    displayName: displayName,
                    mmr: player.mmr,
                    primaryRole: player.primaryRole,
                    secondaryRole: player.secondaryRole,
                    riotId: player.riotId || 'Unknown Riot ID'
                };
            });
            
            await debug.info('**Test Matchmaking**: Converted player data for matchmaking algorithm');
            
            // Run matchmaking algorithm
            const matches = await runMatchmakingAlgorithm(testPlayers, N, debug);
            await debug.info(`**Test Matchmaking**: Created ${matches.length} test matches`);
            
            // Format and send results summary (keep under 2000 chars)
            let matchResults = `**Test Matchmaking Results (${playerCount} Players)**\n\n`;
            matchResults += `✅ Created ${matches.length} matches (${matches.length * 10} players)\n`;
            
            if (flexQueueList.length > 0) {
                matchResults += `🔄 Flex Queue: ${flexQueueList.length} players\n`;
                
                // Send flex queue in separate message if there are many players
                if (flexQueueList.length > 15) {
                    matchResults += `\nFlex queue details will be sent separately...`;
                } else {
                    matchResults += `\n**Flex Queue Players:**\n`;
                    for (const player of flexQueueList) {
                        matchResults += `• ${player.username}\n`;
                    }
                }
            }
            
            matchResults += `\nDetailed match results will follow in separate messages...`;
            
            await interaction.followUp(matchResults);
            
            // Send each match in separate messages
            for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                let matchMessage = `**Test Match ${i + 1}**\n\n`;
                
                matchMessage += '**Team 1:**\n';
                matchMessage += formatTeam(match.team1);
                matchMessage += '\n**Team 2:**\n';
                matchMessage += formatTeam(match.team2);
                matchMessage += `\n**Team 1 Total MMR:** ${match.team1MMR}`;
                matchMessage += `\n**Team 2 Total MMR:** ${match.team2MMR}`;
                matchMessage += `\n**MMR Difference:** ${Math.abs(match.team1MMR - match.team2MMR)}`;
                
                await interaction.followUp(matchMessage);
            }
            
            // Send large flex queue in separate message if needed
            if (flexQueueList.length > 15) {
                let flexMessage = `**Flex Queue (${flexQueueList.length} players):**\n\n`;
                
                // Chunk flex queue into groups of 20 to avoid message limits
                for (let i = 0; i < flexQueueList.length; i += 20) {
                    const chunk = flexQueueList.slice(i, i + 20);
                    let chunkMessage = '';
                    
                    if (flexQueueList.length > 20) {
                        chunkMessage = `**Flex Queue (${i + 1}-${Math.min(i + 20, flexQueueList.length)}):**\n`;
                    } else {
                        chunkMessage = flexMessage;
                    }
                    
                    for (const player of chunk) {
                        chunkMessage += `• ${player.username} (${player.riotId}) - MMR: ${player.mmr}\n`;
                    }
                    
                    await interaction.followUp(chunkMessage);
                }
            }
            
            await debug.success('**Test Matchmaking**: Test matchmaking completed successfully');
            
        } catch (error) {
            console.error('Error in test matchmaking:', error);
            await debug.error(`**Test Matchmaking**: Error occurred: ${error.message}`);
            await interaction.editReply('❌ An error occurred during test matchmaking.');
        }
    }
};

function formatTeam(team) {
    const roles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
    let formatted = '';
    
    // Calculate column widths for proper alignment
    let maxRoleWidth = 0;
    let maxNameWidth = 0;
    let maxRiotIdWidth = 0;
    
    const teamData = [];
    for (const role of roles) {
        const player = team.find(p => p.assignedRole === role);
        if (player) {
            let roleText = role;
            if (player.roleType === 'secondary') roleText += ' (Sec)';
            if (player.roleType === 'autofill') roleText += ' (Auto)';
            
            teamData.push({
                role: roleText,
                name: player.displayName,
                riotId: player.riotId,
                mmr: player.effectiveMMR
            });
            
            maxRoleWidth = Math.max(maxRoleWidth, roleText.length);
            maxNameWidth = Math.max(maxNameWidth, player.displayName.length);
            maxRiotIdWidth = Math.max(maxRiotIdWidth, player.riotId.length);
        }
    }
    
    // Create formatted table
    formatted += '```\n';
    formatted += '┌─' + '─'.repeat(maxRoleWidth) + '─┬─' + '─'.repeat(maxNameWidth) + '─┬─' + '─'.repeat(maxRiotIdWidth) + '─┬─────────┐\n';
    formatted += '│ ' + 'Role'.padEnd(maxRoleWidth) + ' │ ' + 'Player'.padEnd(maxNameWidth) + ' │ ' + 'Riot ID'.padEnd(maxRiotIdWidth) + ' │   MMR   │\n';
    formatted += '├─' + '─'.repeat(maxRoleWidth) + '─┼─' + '─'.repeat(maxNameWidth) + '─┼─' + '─'.repeat(maxRiotIdWidth) + '─┼─────────┤\n';
    
    for (const data of teamData) {
        formatted += '│ ' + data.role.padEnd(maxRoleWidth) + ' │ ' + data.name.padEnd(maxNameWidth) + ' │ ' + data.riotId.padEnd(maxRiotIdWidth) + ' │ ' + data.mmr.toString().padStart(7) + ' │\n';
    }
    
    formatted += '└─' + '─'.repeat(maxRoleWidth) + '─┴─' + '─'.repeat(maxNameWidth) + '─┴─' + '─'.repeat(maxRiotIdWidth) + '─┴─────────┘\n';
    formatted += '```';
    
    return formatted;
}

async function runMatchmakingAlgorithm(players, numMatches, debug) {
    if (debug) {
        await debug.info(`**Test Matchmaking**: Starting advanced matchmaking algorithm with ${players.length} players for ${numMatches} matches`);
    }
    
    // Generate multiple complete matchmaking scenarios and pick the best one
    let bestScenario = null;
    let bestScenarioScore = Infinity;
    const numScenarios = 250; // Try 250 different complete scenarios
    
    for (let scenarioIndex = 0; scenarioIndex < numScenarios; scenarioIndex++) {
        // Shuffle all players for this scenario
        const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
        const scenarioMatches = [];
        const usedPlayerIds = new Set();
        let scenarioValid = true;
        
        // Create all matches for this scenario
        for (let matchIndex = 0; matchIndex < numMatches; matchIndex++) {
            // Get 10 random unused players for this match
            const availablePlayers = shuffledPlayers.filter(p => !usedPlayerIds.has(p.userId));
            
            if (availablePlayers.length < 10) {
                scenarioValid = false;
                break;
            }
            
            // Try to create the best match with these 10 players
            const matchPlayers = availablePlayers.slice(0, 10);
            let bestMatch = null;
            let bestMatchScore = Infinity;
            
            // Try multiple arrangements of these 10 players
            for (let iteration = 0; iteration < 20; iteration++) {
                const shuffled = [...matchPlayers].sort(() => Math.random() - 0.5);
                const match = await createMatch(shuffled, null);
                
                if (match) {
                    const score = calculateMatchScore(match);
                    if (score < bestMatchScore) {
                        bestMatchScore = score;
                        bestMatch = match;
                    }
                }
            }
            
            // If no match found, try with autofill
            if (!bestMatch) {
                const shuffled = [...matchPlayers].sort(() => Math.random() - 0.5);
                bestMatch = await createMatch(shuffled, null, true);
            }
            
            if (bestMatch) {
                scenarioMatches.push(bestMatch);
                // Mark these players as used
                bestMatch.team1.forEach(p => usedPlayerIds.add(p.userId));
                bestMatch.team2.forEach(p => usedPlayerIds.add(p.userId));
            } else {
                scenarioValid = false;
                break;
            }
        }
        
        // Evaluate this scenario
        if (scenarioValid && scenarioMatches.length === numMatches) {
            const scenarioScore = calculateScenarioScore(scenarioMatches);
            
            if (scenarioScore < bestScenarioScore) {
                bestScenarioScore = scenarioScore;
                bestScenario = scenarioMatches;
            }
        }
        
        // Log progress every 10 scenarios
        if (debug && (scenarioIndex + 1) % 10 === 0) {
            await debug.info(`**Test Matchmaking**: Evaluated ${scenarioIndex + 1}/${numScenarios} scenarios, best score: ${bestScenarioScore.toFixed(2)}`);
        }
    }
    
    if (!bestScenario) {
        if (debug) {
            await debug.error('**Test Matchmaking**: Failed to create valid matchmaking scenario');
        }
        return [];
    }
    
    if (debug) {
        await debug.success(`**Test Matchmaking**: Created ${bestScenario.length} matches with scenario score: ${bestScenarioScore.toFixed(2)}`);
    }
    
    // Apply final optimization pass - swap players between teams to minimize MMR differences
    if (debug) {
        await debug.info('**Test Matchmaking**: Starting final optimization pass...');
    }
    const optimizedMatches = await finalOptimizationPass(bestScenario, debug);
    
    if (debug) {
        await debug.success('**Test Matchmaking**: Final optimization complete!');
    }
    return optimizedMatches;
}

// Calculate score for entire scenario (all matches combined)
function calculateScenarioScore(matches) {
    let totalScore = 0;
    
    for (const match of matches) {
        totalScore += calculateMatchScore(match);
    }
    
    return totalScore;
}

// Final optimization pass: try swapping players between teams to reduce MMR differences
async function finalOptimizationPass(matches, debug) {
    const roles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
    let improved = true;
    let passCount = 0;
    const maxPasses = 10;
    
    while (improved && passCount < maxPasses) {
        improved = false;
        passCount++;
        
        for (let matchIndex = 0; matchIndex < matches.length; matchIndex++) {
            const match = matches[matchIndex];
            const currentDiff = Math.abs(match.team1MMR - match.team2MMR);
            
            // Try swapping each role between teams
            for (const role of roles) {
                const team1Player = match.team1.find(p => p.assignedRole === role);
                const team2Player = match.team2.find(p => p.assignedRole === role);
                
                if (!team1Player || !team2Player) continue;
                
                // Calculate new MMRs if we swap these players
                const newTeam1MMR = match.team1MMR - team1Player.effectiveMMR + team2Player.effectiveMMR;
                const newTeam2MMR = match.team2MMR - team2Player.effectiveMMR + team1Player.effectiveMMR;
                const newDiff = Math.abs(newTeam1MMR - newTeam2MMR);
                
                // Also consider if swapping improves role assignments
                const team1NewRoleScore = getRoleScore(team2Player, role);
                const team2NewRoleScore = getRoleScore(team1Player, role);
                const team1OldRoleScore = getRoleScore(team1Player, role);
                const team2OldRoleScore = getRoleScore(team2Player, role);
                
                const roleScoreImprovement = (team1OldRoleScore + team2OldRoleScore) - (team1NewRoleScore + team2NewRoleScore);
                
                // Swap if it reduces MMR difference or significantly improves role assignments
                if (newDiff < currentDiff || (newDiff === currentDiff && roleScoreImprovement > 0)) {
                    // Perform the swap
                    const team1Index = match.team1.findIndex(p => p.assignedRole === role);
                    const team2Index = match.team2.findIndex(p => p.assignedRole === role);
                    
                    // Swap players but keep role assignments
                    const temp = match.team1[team1Index];
                    match.team1[team1Index] = assignPlayerToRole(team2Player, role);
                    match.team2[team2Index] = assignPlayerToRole(temp, role);
                    
                    // Update MMRs
                    match.team1MMR = newTeam1MMR;
                    match.team2MMR = newTeam2MMR;
                    
                    improved = true;
                    if (debug) {
                        await debug.info(`**Test Optimization**: Match ${matchIndex + 1} - Swapped ${role} players, MMR diff: ${currentDiff} → ${newDiff}`);
                    }
                }
            }
        }
        
        if (improved && debug) {
            await debug.info(`**Test Optimization**: Pass ${passCount} completed with improvements`);
        }
    }
    
    if (debug) {
        await debug.info(`**Test Optimization**: Completed ${passCount} optimization passes`);
    }
    return matches;
}

async function createMatch(players, debug, enableAutofill = false) {
    const roles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
    const team1 = [];
    const team2 = [];
    const usedPlayers = new Set();
    
    if (debug) {
        await debug.info(`**Test CreateMatch**: Starting with ${players.length} players`);
    }
    
    // Try to assign players to roles
    for (const role of roles) {
        // Find players for this role for both teams
        const candidates = players.filter(p => !usedPlayers.has(p.userId));
        
        if (debug) {
            await debug.info(`**Test CreateMatch**: Role ${role} - ${candidates.length} candidates available, ${usedPlayers.size} already used`);
        }
        
        // Sort by role preference
        candidates.sort((a, b) => {
            const aScore = getRoleScore(a, role);
            const bScore = getRoleScore(b, role);
            return aScore - bScore;
        });
        
        if (candidates.length >= 2) {
            // Assign to team 1
            const player1 = candidates[0];
            team1.push(assignPlayerToRole(player1, role));
            usedPlayers.add(player1.userId);
            
            // Assign to team 2
            const player2 = candidates[1];
            team2.push(assignPlayerToRole(player2, role));
            usedPlayers.add(player2.userId);
            
            if (debug) {
                await debug.success(`**Test CreateMatch**: Assigned ${player1.displayName} and ${player2.displayName} to ${role}`);
            }
        } else if (candidates.length === 1 && enableAutofill) {
            // Only one candidate, need to autofill the second player
            const player1 = candidates[0];
            team1.push(assignPlayerToRole(player1, role));
            usedPlayers.add(player1.userId);
            
            // Find any remaining player for autofill
            const remainingPlayers = players.filter(p => !usedPlayers.has(p.userId));
            if (remainingPlayers.length > 0) {
                const autofillPlayer = remainingPlayers[0];
                team2.push(assignPlayerToRole(autofillPlayer, role));
                usedPlayers.add(autofillPlayer.userId);
                
                if (debug) {
                    await debug.success(`**Test CreateMatch**: Assigned ${player1.displayName} to ${role}, autofilled ${autofillPlayer.displayName} to ${role}`);
                }
            } else {
                if (debug) {
                    await debug.error(`**Test CreateMatch**: FAILED - No remaining players for autofill to ${role}`);
                }
                return null;
            }
        } else if (candidates.length === 0 && enableAutofill) {
            // No candidates for this role, need to autofill both players
            const remainingPlayers = players.filter(p => !usedPlayers.has(p.userId));
            if (remainingPlayers.length >= 2) {
                const autofillPlayer1 = remainingPlayers[0];
                const autofillPlayer2 = remainingPlayers[1];
                
                team1.push(assignPlayerToRole(autofillPlayer1, role));
                usedPlayers.add(autofillPlayer1.userId);
                
                team2.push(assignPlayerToRole(autofillPlayer2, role));
                usedPlayers.add(autofillPlayer2.userId);
                
                if (debug) {
                    await debug.success(`**Test CreateMatch**: Autofilled ${autofillPlayer1.displayName} and ${autofillPlayer2.displayName} to ${role}`);
                }
            } else {
                if (debug) {
                    await debug.error(`**Test CreateMatch**: FAILED - Not enough remaining players for autofill to ${role}. Available: ${remainingPlayers.length}, Need: 2`);
                }
                return null;
            }
        } else {
            // Not enough candidates and autofill not enabled
            if (debug) {
                await debug.error(`**Test CreateMatch**: FAILED - Not enough candidates for ${role}. Available: ${candidates.length}, Need: 2`);
                const candidateInfo = candidates.map(p => `${p.displayName} (${p.primaryRole}/${p.secondaryRole})`).join(', ');
                await debug.error(`**Test CreateMatch**: Candidates for ${role}: ${candidateInfo || 'None'}`);
            }
            return null;
        }
    }
    
    const team1MMR = team1.reduce((sum, p) => sum + p.effectiveMMR, 0);
    const team2MMR = team2.reduce((sum, p) => sum + p.effectiveMMR, 0);
    
    if (debug) {
        await debug.success(`**Test CreateMatch**: SUCCESS - Created match with teams of ${team1.length} and ${team2.length} players`);
    }
    
    return {
        team1,
        team2,
        team1MMR,
        team2MMR
    };
}

function getRoleScore(player, role) {
    if (player.primaryRole === role || player.primaryRole === 'Fill') return 1;
    if (player.secondaryRole === role || player.secondaryRole === 'Fill') return 2;
    return 3; // Autofill
}

function assignPlayerToRole(player, role) {
    let roleType = 'autofill';
    let effectiveMMR = Math.floor(player.mmr * 0.8); // 20% penalty for autofill
    
    if (player.primaryRole === role || player.primaryRole === 'Fill') {
        roleType = 'primary';
        effectiveMMR = player.mmr;
    } else if (player.secondaryRole === role || player.secondaryRole === 'Fill') {
        roleType = 'secondary';
        effectiveMMR = player.mmr;
    }
    
    return {
        ...player,
        assignedRole: role,
        roleType,
        effectiveMMR
    };
}

function calculateMatchScore(match) {
    const mmrDiff = Math.abs(match.team1MMR - match.team2MMR);
    
    // Count autofills and secondary roles for each team
    const team1Autofills = match.team1.filter(p => p.roleType === 'autofill').length;
    const team2Autofills = match.team2.filter(p => p.roleType === 'autofill').length;
    const team1Secondaries = match.team1.filter(p => p.roleType === 'secondary').length;
    const team2Secondaries = match.team2.filter(p => p.roleType === 'secondary').length;
    
    // Total autofills and secondaries (want to minimize these)
    const totalAutofills = team1Autofills + team2Autofills;
    const totalSecondaries = team1Secondaries + team2Secondaries;
    
    // Imbalance between teams (want teams to have similar numbers of autofills/secondaries)
    const autofillImbalance = Math.abs(team1Autofills - team2Autofills);
    const secondaryImbalance = Math.abs(team1Secondaries - team2Secondaries);
    
    // Scoring weights (prioritize in this order):
    // 1. Minimize total autofills (most important)
    // 2. Balance autofills between teams
    // 3. Minimize total secondaries
    // 4. Balance secondaries between teams
    // 5. Minimize MMR difference
    const score = 
        (totalAutofills * 1000) +           // Heavily penalize autofills
        (autofillImbalance * 500) +         // Heavily penalize autofill imbalance
        (totalSecondaries * 100) +          // Moderately penalize secondaries
        (secondaryImbalance * 50) +         // Moderately penalize secondary imbalance
        mmrDiff;                            // Finally consider MMR difference
    
    return score;
}
