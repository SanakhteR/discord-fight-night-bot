const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { GoogleSheetsService } = require('../services/googleSheets');
const { DebugLogger } = require('../utils/debugLogger');

const googleSheetsService = new GoogleSheetsService();
const debugLogger = new DebugLogger();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('run-matchmaking-high-elo-sup')
        .setDescription('Matchmaking with high MMR (>730) support restriction'),
    
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
            
            // STEP 1: Get player data from Google Sheets and enrich with Rioter status
            await debug.info('**Matchmaking**: Retrieving player data from Google Sheets...');
            
            // Batch fetch all players from Google Sheets once to avoid rate limiting
            const allSheetPlayers = await googleSheetsService.getAllPlayers();
            const sheetDataMap = new Map();
            for (const sheetPlayer of allSheetPlayers) {
                if (sheetPlayer.username) {
                    sheetDataMap.set(sheetPlayer.username.toLowerCase(), sheetPlayer);
                }
            }
            await debug.info(`**Matchmaking**: Loaded ${allSheetPlayers.length} players from Google Sheets`);
            
            const enrichedPlayers = [];
            for (const player of activePlayersList) {
                // Ensure we have the display name from the server member
                let displayName = player.displayName;
                if (!displayName && player.userId) {
                    const member = interaction.guild.members.cache.get(player.userId) ||
                                   await interaction.guild.members.fetch(player.userId).catch(() => null);
                    displayName = member ? member.displayName : player.username;
                }
                
                // Look up player in the pre-fetched map
                const sheetData = sheetDataMap.get(player.username.toLowerCase());
                if (sheetData) {
                    enrichedPlayers.push({
                        ...player,
                        displayName: displayName || player.username,
                        mmr: sheetData.mmr,
                        primaryRole: sheetData.primaryRole,
                        secondaryRole: sheetData.secondaryRole,
                        riotId: sheetData.riotId || 'Unknown Riot ID',
                        firstName: sheetData.firstName || 'N/A',
                        isRioter: sheetData.isRioter || false
                    });
                } else {
                    // Default values for players not in sheet
                    enrichedPlayers.push({
                        ...player,
                        displayName: displayName || player.username,
                        mmr: 450, // Default Plat MMR
                        primaryRole: 'Fill',
                        secondaryRole: 'Fill',
                        riotId: 'Unknown Player',
                        firstName: 'N/A',
                        isRioter: false
                    });
                    await debug.info(`**Matchmaking**: Player ${player.username} not found in Google Sheets`);
                }
            }
            
            await debug.info('**Matchmaking**: Retrieved player data from Google Sheets');
            
            // STEP 2: Sort players by priority (Rioters first, then by join time)
            enrichedPlayers.sort((a, b) => {
                // First priority: Rioters before non-Rioters
                if (a.isRioter !== b.isRioter) {
                    return b.isRioter ? 1 : -1; // Rioters come first
                }
                // Second priority: Earlier join time first
                return a.joinTime - b.joinTime;
            });
            
            await debug.info('**Matchmaking**: Sorted players by Rioter status and join time');
            
            // STEP 3: Split into matchmaking pool (multiple of 10) and flex queue
            const poolSize = Math.floor(enrichedPlayers.length / 10) * 10;
            const matchmakingPool = enrichedPlayers.slice(0, poolSize);
            const flexQueue = enrichedPlayers.slice(poolSize);
            
            await debug.info(`**Matchmaking**: Matchmaking Pool: ${matchmakingPool.length} players`);
            await debug.info(`**Matchmaking**: Flex Queue: ${flexQueue.length} players`);
            
            // Calculate number of full matches
            const N = Math.floor(matchmakingPool.length / 10);
            await debug.info(`**Matchmaking**: Can create ${N} full matches from ${matchmakingPool.length} players`);
            
            // STEP 4: Send message showing matchmaking pool and flex queue
            let poolMessage = `📊 **MATCHMAKING POOL** (${matchmakingPool.length} players):\n\n`;
            for (let i = 0; i < matchmakingPool.length; i++) {
                const player = matchmakingPool[i];
                const rioterBadge = player.isRioter ? '🔷 ' : '';
                const joinTimeStr = new Date(player.joinTime).toLocaleTimeString('en-US', {
                    timeZone: 'America/Los_Angeles',
                    hour12: true,
                    hour: 'numeric',
                    minute: '2-digit'
                });
                const firstName = player.firstName && player.firstName !== 'N/A' ? player.firstName : 'N/A';
                poolMessage += `${i + 1}. ${rioterBadge}${player.displayName} | ${firstName} | ${player.riotId} | Joined: ${joinTimeStr}\n`;
                
                // Send in chunks to avoid message limits
                if ((i + 1) % 25 === 0 || i === matchmakingPool.length - 1) {
                    if (i < 25) {
                        await interaction.editReply(poolMessage);
                    } else {
                        await interaction.followUp(poolMessage);
                    }
                    poolMessage = '';
                }
            }
            
            if (flexQueue.length > 0) {
                let flexMessage = `\n🔄 **FLEX QUEUE** (${flexQueue.length} players):\n\n`;
                for (let i = 0; i < flexQueue.length; i++) {
                    const player = flexQueue[i];
                    const rioterBadge = player.isRioter ? '🔷 ' : '';
                    const joinTimeStr = new Date(player.joinTime).toLocaleTimeString('en-US', {
                        timeZone: 'America/Los_Angeles',
                        hour12: true,
                        hour: 'numeric',
                        minute: '2-digit'
                    });
                    const firstName = player.firstName && player.firstName !== 'N/A' ? player.firstName : 'N/A';
                    flexMessage += `${i + 1}. ${rioterBadge}${player.displayName} | ${firstName} | ${player.riotId} | Joined: ${joinTimeStr}\n`;
                }
                await interaction.followUp(flexMessage);
            }
            
            await interaction.followUp('⚙️ Running matchmaking algorithm...');
            
            // Use matchmaking pool for the algorithm
            const playersWithData = matchmakingPool;
            
            // Run matchmaking algorithm with high elo support restriction
            await debug.info('**Matchmaking High Elo Support**: Converted player data for matchmaking algorithm');
            const matches = await runMatchmakingAlgorithmHighEloSupport(playersWithData, N, debug);
            await debug.info(`**Matchmaking**: Created ${matches.length} test matches`);
            
            // Check if matchmaking failed
            if (matches.length === 0) {
                const highMmrPlayers = playersWithData.filter(p => p.mmr > 730);
                const lowMmrPlayers = playersWithData.filter(p => p.mmr <= 730);
                const requiredSupportSlots = N * 2;
                const requiredNonSupportSlots = N * 8;
                
                let errorMsg = '❌ **Matchmaking Failed**\n\n';
                errorMsg += `**Constraint: Players with MMR > 730 can ONLY play Support**\n\n`;
                errorMsg += `**Current Player Distribution:**\n`;
                errorMsg += `• High MMR players (>730): ${highMmrPlayers.length} (can only fill support slots)\n`;
                errorMsg += `• Regular players (≤730): ${lowMmrPlayers.length} (can fill any role)\n\n`;
                errorMsg += `**Requirements for ${N} matches:**\n`;
                errorMsg += `• Support slots: ${requiredSupportSlots} (can be filled by any player)\n`;
                errorMsg += `• Non-support slots: ${requiredNonSupportSlots} (need players with MMR ≤ 730)\n\n`;
                
                if (highMmrPlayers.length > requiredSupportSlots) {
                    errorMsg += `⚠️ **Too many high MMR players** - Have ${highMmrPlayers.length}, but only ${requiredSupportSlots} support slots available`;
                } else if (lowMmrPlayers.length < requiredNonSupportSlots) {
                    errorMsg += `⚠️ **Not enough regular players** - Need ${requiredNonSupportSlots - lowMmrPlayers.length} more players with MMR ≤ 730 for non-support roles`;
                } else {
                    errorMsg += `⚠️ **Algorithm failed** - Could not create valid matches with current player pool`;
                }
                
                return await interaction.followUp(errorMsg);
            }
            
            // Send summary message
            const summaryMessage = `\n✅ **Matchmaking Complete!**\n\n📊 Created ${matches.length} matches (${matches.length * 10} players)\n🔄 Flex Queue: ${flexQueue.length} players\n🏆 High MMR Support Restriction: Active (>730)\n\nDetailed match results follow...`;
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
            
            // Keep active players list intact for future matchmaking
            await debug.info('**Matchmaking**: Matchmaking completed - Active Players List preserved');
            
        } catch (error) {
            console.error('Error in matchmaking:', error);
            await debug.error(`**Matchmaking**: Error occurred: ${error.message}`);
            await interaction.editReply('❌ An error occurred during matchmaking.');
        }
    }
};

function truncateString(str, maxLength) {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

function formatTeam(team) {
    const roles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
    let formatted = '';
    
    // Maximum column widths to prevent table breaking
    const MAX_NAME_WIDTH = 20;
    const MAX_RIOT_ID_WIDTH = 25;
    
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
            
            // Truncate long names and Riot IDs
            const truncatedName = truncateString(player.displayName, MAX_NAME_WIDTH);
            const truncatedRiotId = truncateString(player.riotId, MAX_RIOT_ID_WIDTH);
            
            teamData.push({
                role: roleText,
                name: truncatedName,
                riotId: truncatedRiotId,
                mmr: player.effectiveMMR
            });
            
            maxRoleWidth = Math.max(maxRoleWidth, roleText.length);
            maxNameWidth = Math.max(maxNameWidth, truncatedName.length);
            maxRiotIdWidth = Math.max(maxRiotIdWidth, truncatedRiotId.length);
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

async function runMatchmakingAlgorithmHighEloSupport(players, numMatches, debug) {
    await debug.info(`**Matchmaking High Elo Support**: Starting advanced matchmaking algorithm with ${players.length} players for ${numMatches} matches`);
    await debug.info(`**Matchmaking High Elo Support**: Constraint - Players with MMR > 730 can ONLY play Support role`);
    
    // Validate player distribution
    const highMmrPlayers = players.filter(p => p.mmr > 730);
    const lowMmrPlayers = players.filter(p => p.mmr <= 730);
    const requiredSupportSlots = numMatches * 2; // 2 supports per match
    const requiredNonSupportSlots = numMatches * 8; // 8 non-support players per match
    
    await debug.info(`**Matchmaking High Elo Support**: Found ${highMmrPlayers.length} high MMR players (>730), ${lowMmrPlayers.length} regular players (<=730)`);
    await debug.info(`**Matchmaking High Elo Support**: Need ${requiredNonSupportSlots} players for non-support roles, ${requiredSupportSlots} for support`);
    
    // High MMR players can ONLY play support, so they cannot exceed support slots
    if (highMmrPlayers.length > requiredSupportSlots) {
        await debug.error(`**Matchmaking High Elo Support**: FAILED - Too many high MMR players (>730). Have ${highMmrPlayers.length}, but only ${requiredSupportSlots} support slots available`);
        return [];
    }
    
    // Need enough regular players to fill all non-support roles
    if (lowMmrPlayers.length < requiredNonSupportSlots) {
        await debug.error(`**Matchmaking High Elo Support**: FAILED - Not enough regular players (<=730) for non-support roles. Have ${lowMmrPlayers.length}, need ${requiredNonSupportSlots}`);
        return [];
    }
    
    // Total players should be sufficient for all slots
    if (players.length < (requiredSupportSlots + requiredNonSupportSlots)) {
        await debug.error(`**Matchmaking High Elo Support**: FAILED - Not enough total players. Have ${players.length}, need ${requiredSupportSlots + requiredNonSupportSlots}`);
        return [];
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
                const match = await createMatchHighEloSupport(shuffled, null);
                
                if (match) {
                    const score = calculateMatchScore(match);
                    if (score < bestMatchScore) {
                        bestMatchScore = score;
                        bestMatch = match;
                    }
                }
            }
            
            // If no match found, try with autofill (but still enforce support restriction)
            if (!bestMatch) {
                const shuffled = [...matchPlayers].sort(() => Math.random() - 0.5);
                bestMatch = await createMatchHighEloSupport(shuffled, null, true);
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
        if ((scenarioIndex + 1) % 10 === 0) {
            await debug.info(`**Matchmaking**: Evaluated ${scenarioIndex + 1}/${numScenarios} scenarios, best score: ${bestScenarioScore.toFixed(2)}`);
        }
    }
    
    if (!bestScenario) {
        await debug.error('**Matchmaking**: Failed to create valid matchmaking scenario');
        return [];
    }
    
    await debug.success(`**Matchmaking**: Created ${bestScenario.length} matches with scenario score: ${bestScenarioScore.toFixed(2)}`);
    
    // Apply final optimization pass - swap players between teams to minimize MMR differences
    await debug.info('**Matchmaking**: Starting final optimization pass...');
    const optimizedMatches = await finalOptimizationPass(bestScenario, debug);
    
    await debug.success('**Matchmaking**: Final optimization complete!');
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
                
                // HIGH ELO SUPPORT CONSTRAINT: Check if swap violates MMR constraints
                // Players with MMR > 730 can ONLY play Support
                // Players with MMR <= 730 can play ANY role
                if (role !== 'Support') {
                    // For non-Support roles, neither player can have MMR > 730
                    if (team1Player.mmr > 730 || team2Player.mmr > 730) {
                        continue; // Skip this swap - violates constraint
                    }
                }
                // For Support role, any player can be swapped (no constraint)
                
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
                    await debug.info(`**Optimization**: Match ${matchIndex + 1} - Swapped ${role} players, MMR diff: ${currentDiff} → ${newDiff}`);
                }
            }
        }
        
        if (improved) {
            await debug.info(`**Optimization**: Pass ${passCount} completed with improvements`);
        }
    }
    
    await debug.info(`**Optimization**: Completed ${passCount} optimization passes`);
    return matches;
}

async function createMatchHighEloSupport(players, debug, enableAutofill = false) {
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
        let candidates = players.filter(p => !usedPlayers.has(p.userId));
        
        // HIGH ELO SUPPORT CONSTRAINT:
        // - For Support role: ANY player can play (both >730 and <=730)
        // - For other roles: ONLY players with MMR <= 730 (exclude >730 players)
        // This ensures players with MMR > 730 can ONLY play Support
        if (role === 'Support') {
            // Support can be filled by anyone
            if (debug) {
                await debug.info(`**CreateMatch High Elo Support**: Support role - ${candidates.length} total candidates available`);
            }
        } else {
            // Other roles: exclude high MMR players (they can only play support)
            candidates = candidates.filter(p => p.mmr <= 730);
            if (debug) {
                await debug.info(`**CreateMatch High Elo Support**: ${role} role - ${candidates.length} candidates (MMR <= 730) available`);
            }
        }
        
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
            
            // Find any remaining player for autofill (respecting MMR constraints)
            let remainingPlayers = players.filter(p => !usedPlayers.has(p.userId));
            if (role !== 'Support') {
                // For non-Support roles, exclude high MMR players (they can only play support)
                remainingPlayers = remainingPlayers.filter(p => p.mmr <= 730);
            }
            // For Support role, any player can be autofilled
            
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
            let remainingPlayers = players.filter(p => !usedPlayers.has(p.userId));
            
            // Apply MMR constraints for autofill
            if (role !== 'Support') {
                // For non-Support roles, exclude high MMR players (they can only play support)
                remainingPlayers = remainingPlayers.filter(p => p.mmr <= 730);
            }
            // For Support role, any player can be autofilled
            
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
    
    // For Support role in high elo support mode, no autofill penalty and they get their full MMR
    if (role === 'Support' && player.mmr > 730) {
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
