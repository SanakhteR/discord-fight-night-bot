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
        
        // Check channel
        if (interaction.channel.name !== 'fightnightmods') {
            return await interaction.reply({
                content: '❌ This command can only be used in the #fightnightmods channel.',
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
                    return hasRole && message.channel.name === 'fightnightmods' && !isNaN(parseInt(message.content));
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
    const matches = [];
    const availablePlayers = [...players];
    
    for (let matchIndex = 0; matchIndex < numMatches; matchIndex++) {
        if (availablePlayers.length < 10) {
            if (debug) {
                await debug.warn(`**Test Matchmaking**: Breaking at match ${matchIndex + 1}: only ${availablePlayers.length} players remaining`);
            }
            break; // Not enough players for another match
        }
        
        if (debug) {
            await debug.info(`**Test Matchmaking**: Creating match ${matchIndex + 1} with ${availablePlayers.length} available players`);
        }
        const matchPlayers = availablePlayers.splice(0, 10);
        if (debug) {
            await debug.info(`**Test Matchmaking**: Match ${matchIndex + 1}: Using 10 players, ${availablePlayers.length} remaining`);
            // Show player roles for this match
            const roleDistribution = {};
            matchPlayers.forEach(p => {
                const primary = p.primaryRole || 'Unknown';
                const secondary = p.secondaryRole || 'Unknown';
                roleDistribution[primary] = (roleDistribution[primary] || 0) + 1;
            });
            await debug.info(`**Test Matchmaking**: Match ${matchIndex + 1} role distribution: ${JSON.stringify(roleDistribution)}`);
        }
        
        // Run optimization for this match
        let bestMatch = null;
        let bestScore = Infinity;
        
        // Try multiple iterations to find best match
        for (let iteration = 0; iteration < 100; iteration++) {
            const shuffled = [...matchPlayers].sort(() => Math.random() - 0.5);
            const match = await createMatch(shuffled, null); // Don't debug every iteration
            
            if (match) {
                const score = calculateMatchScore(match);
                if (score < bestScore) {
                    bestScore = score;
                    bestMatch = match;
                }
            }
        }
        
        // If no match found in optimization, try once more with autofill enabled
        if (!bestMatch) {
            if (debug) {
                await debug.warn(`**Test Matchmaking**: No valid match found in 100 iterations for match ${matchIndex + 1}, trying with autofill...`);
            }
            const shuffled = [...matchPlayers].sort(() => Math.random() - 0.5);
            bestMatch = await createMatch(shuffled, debug, true); // Enable autofill
        }
        
        if (bestMatch) {
            matches.push(bestMatch);
            if (debug) {
                await debug.success(`**Test Matchmaking**: Successfully created match ${matchIndex + 1}`);
            }
        } else {
            if (debug) {
                await debug.error(`**Test Matchmaking**: Failed to create match ${matchIndex + 1} - running detailed analysis...`);
                // Run one more time with debug to see why it failed
                const shuffled = [...matchPlayers].sort(() => Math.random() - 0.5);
                await createMatch(shuffled, debug);
            }
        }
    }
    
    if (debug) {
        await debug.info(`**Test Matchmaking**: Final result: Created ${matches.length} matches out of ${numMatches} requested`);
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
    
    // Count autofills and secondary roles
    const team1Penalties = match.team1.reduce((sum, p) => {
        if (p.roleType === 'autofill') return sum + 100;
        if (p.roleType === 'secondary') return sum + 10;
        return sum;
    }, 0);
    
    const team2Penalties = match.team2.reduce((sum, p) => {
        if (p.roleType === 'autofill') return sum + 100;
        if (p.roleType === 'secondary') return sum + 10;
        return sum;
    }, 0);
    
    return mmrDiff + team1Penalties + team2Penalties;
}
