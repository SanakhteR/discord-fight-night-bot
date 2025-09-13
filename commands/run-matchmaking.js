const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { GoogleSheetsService } = require('../services/googleSheets');
const { DebugLogger } = require('../utils/debugLogger');

const googleSheetsService = new GoogleSheetsService();
const debugLogger = new DebugLogger();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('run-matchmaking')
        .setDescription('Run matchmaking for active players'),
    
    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can run matchmaking.',
                ephemeral: true
            });
        }
        
        // Check channel
        if (interaction.channel.name !== 'fight-night-general' && interaction.channel.name !== 'fightnightmods') {
            return await interaction.reply({
                content: '❌ This command can only be used in the #fight-night-general or #fightnightmods channels.',
                ephemeral: true
            });
        }
        
        // Use centralized debug logger
        const debug = debugLogger.createLogger(interaction.guild);
        
        try {
            await interaction.deferReply();
            await debug.info('**Matchmaking**: Matchmaking command initiated');
            
            // Get active players list
            const activePlayersList = interaction.client.activePlayersList;
            await debug.info(`**Matchmaking**: Found ${activePlayersList.length} players in Active Players List`);
            
            if (activePlayersList.length < 10) {
                return await interaction.editReply('❌ Not enough players for matchmaking. Need at least 10 players.');
            }
            
            // Calculate number of full matches
            const N = Math.floor(activePlayersList.length / 10);
            await debug.info(`**Matchmaking**: Can create ${N} full matches from ${activePlayersList.length} players`);
            
            // Create matchmaking list (all players for matchmaking)
            const matchmakingList = [...activePlayersList];
            const flexQueueList = [];
            
            await debug.info(`**Matchmaking**: Matchmaking List: ${matchmakingList.length} players`);
            await debug.info(`**Matchmaking**: Flex Queue List: ${flexQueueList.length} players`);
            
            // Get player data from Google Sheets and ensure display names
            const playersWithData = [];
            for (const player of matchmakingList) {
                // Ensure we have the display name from the server member
                let displayName = player.displayName;
                if (!displayName && player.userId) {
                    const member = interaction.guild.members.cache.get(player.userId);
                    displayName = member ? member.displayName : player.username;
                }
                
                const sheetData = await googleSheetsService.findPlayerByUsername(player.username);
                if (sheetData) {
                    playersWithData.push({
                        ...player,
                        displayName: displayName || player.username,
                        mmr: sheetData.mmr,
                        primaryRole: sheetData.primaryRole,
                        secondaryRole: sheetData.secondaryRole,
                        riotId: sheetData.riotId || 'Unknown Riot ID'
                    });
                } else {
                    // Default values for players not in sheet
                    playersWithData.push({
                        ...player,
                        displayName: displayName || player.username,
                        mmr: 300, // Default Silver MMR
                        primaryRole: 'Fill',
                        secondaryRole: 'Fill',
                        riotId: 'Unknown Riot ID'
                    });
                }
            }
            
            await debug.info('**Matchmaking**: Retrieved player data from Google Sheets');
            
            // Run matchmaking algorithm
            await debug.info('**Matchmaking**: Converted player data for matchmaking algorithm');
            const matches = await runMatchmakingAlgorithm(playersWithData, N, debug);
            await debug.info(`**Matchmaking**: Created ${matches.length} test matches`);
            
            // Calculate remaining players for flex queue
            const playersUsedInMatches = matches.length * 10;
            const remainingPlayers = playersWithData.slice(playersUsedInMatches);
            
            // Update flex queue list with remaining players
            for (const player of remainingPlayers) {
                flexQueueList.push({
                    username: player.username,
                    displayName: player.displayName
                });
            }
            
            // Send player lists in chunks to avoid message length limits
            const allPlayers = [...matchmakingList, ...flexQueueList];
            
            // Send players in chunks of 10
            for (let i = 0; i < allPlayers.length; i += 10) {
                const chunk = allPlayers.slice(i, i + 10);
                let chunkMessage = `**Players ${i + 1}-${Math.min(i + 10, allPlayers.length)}:**\n`;
                
                for (const player of chunk) {
                    const sheetData = await googleSheetsService.findPlayerByUsername(player.username);
                    const riotId = sheetData ? sheetData.riotId : 'Unknown Riot ID';
                    chunkMessage += `• ${player.displayName} (${riotId})\n`;
                }
                
                if (i === 0) {
                    await interaction.editReply(chunkMessage);
                } else {
                    await interaction.followUp(chunkMessage);
                }
            }
            
            // Send summary message
            const summaryMessage = `**Matchmaking Summary**\n✅ Created ${matches.length} matches (${matches.length * 10} players)\n🔄 Flex Queue: ${flexQueueList.length} players\n\nDetailed match results follow...`;
            await interaction.followUp(summaryMessage);
            
            // Send each match in separate messages
            for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                let matchMessage = `**Match ${i + 1}**\n\n`;
                
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
                        const sheetData = await googleSheetsService.findPlayerByUsername(player.username);
                        const riotId = sheetData ? sheetData.riotId : 'Unknown Riot ID';
                        const mmr = sheetData ? sheetData.mmr : 0;
                        chunkMessage += `• ${player.displayName} (${riotId}) - MMR: ${mmr}\n`;
                    }
                    
                    await interaction.followUp(chunkMessage);
                }
            }
            
            // Clear lists
            interaction.client.activePlayersList = [];
            await debug.info('**Matchmaking**: Cleared Active Players List and Flex Queue List');
            
        } catch (error) {
            console.error('Error in matchmaking:', error);
            await debug.error(`**Matchmaking**: Error occurred: ${error.message}`);
            await interaction.editReply('❌ An error occurred during matchmaking.');
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
            if (player.roleType === 'autofill') roleText += ' (Autof)';
            
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
            await debug.warn(`**Matchmaking**: Breaking at match ${matchIndex + 1}: only ${availablePlayers.length} players remaining`);
            break; // Not enough players for another match
        }
        
        await debug.info(`**Matchmaking**: Creating match ${matchIndex + 1} with ${availablePlayers.length} available players`);
        const matchPlayers = availablePlayers.splice(0, 10);
        await debug.info(`**Matchmaking**: Match ${matchIndex + 1}: Using 10 players, ${availablePlayers.length} remaining`);
        
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
                await debug.warn(`**Matchmaking**: No valid match found in 100 iterations for match ${matchIndex + 1}, trying with autofill...`);
            }
            const shuffled = [...matchPlayers].sort(() => Math.random() - 0.5);
            bestMatch = await createMatch(shuffled, debug, true); // Enable autofill
        }
        
        if (bestMatch) {
            matches.push(bestMatch);
            await debug.success(`**Matchmaking**: Successfully created match ${matchIndex + 1}`);
        } else {
            await debug.error(`**Matchmaking**: Failed to create match ${matchIndex + 1}`);
        }
    }
    
    await debug.info(`**Matchmaking**: Final result: Created ${matches.length} matches out of ${numMatches} requested`);
    return matches;
}

async function createMatch(players, debug, enableAutofill = false) {
    const roles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
    const team1 = [];
    const team2 = [];
    const usedPlayers = new Set();
    
    if (debug) {
        await debug.info(`**CreateMatch**: Starting with ${players.length} players`);
    }
    
    // Try to assign players to roles
    for (const role of roles) {
        // Find players for this role for both teams
        const candidates = players.filter(p => !usedPlayers.has(p.userId));
        
        if (debug) {
            await debug.info(`**CreateMatch**: Role ${role} - ${candidates.length} candidates available, ${usedPlayers.size} already used`);
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
                await debug.success(`**CreateMatch**: Assigned ${player1.displayName} and ${player2.displayName} to ${role}`);
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
                    await debug.success(`**CreateMatch**: Assigned ${player1.displayName} to ${role}, autofilled ${autofillPlayer.displayName} to ${role}`);
                }
            } else {
                if (debug) {
                    await debug.error(`**CreateMatch**: FAILED - No remaining players for autofill to ${role}`);
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
                    await debug.success(`**CreateMatch**: Autofilled ${autofillPlayer1.displayName} and ${autofillPlayer2.displayName} to ${role}`);
                }
            } else {
                if (debug) {
                    await debug.error(`**CreateMatch**: FAILED - Not enough remaining players for autofill to ${role}. Available: ${remainingPlayers.length}, Need: 2`);
                }
                return null;
            }
        } else {
            // Not enough candidates and autofill not enabled
            if (debug) {
                await debug.error(`**CreateMatch**: FAILED - Not enough candidates for ${role}. Available: ${candidates.length}, Need: 2`);
                const candidateInfo = candidates.map(p => `${p.displayName} (${p.primaryRole}/${p.secondaryRole})`).join(', ');
                await debug.error(`**CreateMatch**: Candidates for ${role}: ${candidateInfo || 'None'}`);
            }
            return null;
        }
    }
    
    const team1MMR = team1.reduce((sum, p) => sum + p.effectiveMMR, 0);
    const team2MMR = team2.reduce((sum, p) => sum + p.effectiveMMR, 0);
    
    if (debug) {
        await debug.success(`**CreateMatch**: SUCCESS - Created match with teams of ${team1.length} and ${team2.length} players`);
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
