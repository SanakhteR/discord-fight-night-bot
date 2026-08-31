const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { GoogleSheetsService } = require('../services/googleSheets');
const { DebugLogger } = require('../utils/debugLogger');

const googleSheetsService = new GoogleSheetsService();
const debugLogger = new DebugLogger();

// Unbiased Fisher-Yates shuffle. Replaces the older `sort(() => Math.random() - 0.5)`
// pattern, which produced non-uniform permutations and reduced variety across runs.
function fisherYatesShuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    return a;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('run-matchmaking-even-lanes')
        .setDescription('Run matchmaking with lane-balanced algorithm (minimizes role autofills)'),
    
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
        
        const debug = debugLogger.createLogger(interaction.guild);
        
        try {
            await interaction.deferReply();
            await debug.info('**Matchmaking2**: Matchmaking command initiated');
            
            // Get active players list
            const activePlayersList = interaction.client.activePlayersList;
            await debug.info(`**Matchmaking2**: Found ${activePlayersList.length} players in Active Players List`);
            
            if (activePlayersList.length < 10) {
                return await interaction.editReply('❌ Not enough players for matchmaking. Need at least 10 players.');
            }
            
            // STEP 1: Get player data from Google Sheets and enrich with Rioter status
            await debug.info('**Matchmaking2**: Retrieving player data from Google Sheets...');
            
            const allSheetPlayers = await googleSheetsService.getAllPlayers();
            const sheetDataMap = new Map();
            for (const sheetPlayer of allSheetPlayers) {
                if (sheetPlayer.username) {
                    sheetDataMap.set(sheetPlayer.username.toLowerCase(), sheetPlayer);
                }
            }
            await debug.info(`**Matchmaking2**: Loaded ${allSheetPlayers.length} players from Google Sheets`);
            
            const enrichedPlayers = [];
            for (const player of activePlayersList) {
                let displayName = player.displayName;
                if (!displayName && player.userId) {
                    const member = interaction.guild.members.cache.get(player.userId) ||
                                   await interaction.guild.members.fetch(player.userId).catch(() => null);
                    displayName = member ? member.displayName : player.username;
                }
                
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
                    enrichedPlayers.push({
                        ...player,
                        displayName: displayName || player.username,
                        mmr: 450,
                        primaryRole: 'Fill',
                        secondaryRole: 'Fill',
                        riotId: 'Unknown Player',
                        firstName: 'N/A',
                        isRioter: false
                    });
                    await debug.info(`**Matchmaking2**: Player ${player.username} not found in Google Sheets`);
                }
            }
            
            await debug.info('**Matchmaking2**: Retrieved player data from Google Sheets');
            
            // Sort players by priority (Rioters first, then by join time)
            enrichedPlayers.sort((a, b) => {
                if (a.isRioter !== b.isRioter) {
                    return b.isRioter ? 1 : -1;
                }
                return a.joinTime - b.joinTime;
            });
            
            await debug.info('**Matchmaking2**: Sorted players by Rioter status and join time');
            
            // Split into matchmaking pool (multiple of 10) and flex queue
            const poolSize = Math.floor(enrichedPlayers.length / 10) * 10;
            const matchmakingPool = enrichedPlayers.slice(0, poolSize);
            const flexQueue = enrichedPlayers.slice(poolSize);
            
            await debug.info(`**Matchmaking2**: Matchmaking Pool: ${matchmakingPool.length} players`);
            await debug.info(`**Matchmaking2**: Flex Queue: ${flexQueue.length} players`);
            
            const N = Math.floor(matchmakingPool.length / 10);
            await debug.info(`**Matchmaking2**: Can create ${N} full matches from ${matchmakingPool.length} players`);
            
            // Display matchmaking pool and flex queue
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
            
            await interaction.followUp('⚙️ Running role-first matchmaking algorithm...');
            
            // Run new matchmaking algorithm
            const matches = await runRoleFirstMatchmaking(matchmakingPool, N, debug);
            await debug.info(`**Matchmaking2**: Created ${matches.length} matches`);
            
            // Send summary message
            const summaryMessage = `\n✅ **Matchmaking Complete!**\n\n📊 Created ${matches.length} matches (${matches.length * 10} players)\n🔄 Flex Queue: ${flexQueue.length} players\n\nDetailed match results follow...`;
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
                
                // Add lane balance metrics
                const laneBalanceMetrics = calculateLaneBalanceMetrics(match);
                matchMessage += `\n**Avg Lane MMR Diff:** ${laneBalanceMetrics.avgLaneDiff.toFixed(1)}`;
                matchMessage += `\n**Max Lane MMR Diff:** ${laneBalanceMetrics.maxLaneDiff}`;
                
                await interaction.followUp(matchMessage);
            }
            
            await debug.info('**Matchmaking2**: Matchmaking completed - Active Players List preserved');
            
        } catch (error) {
            console.error('Error in matchmaking2:', error);
            await debug.error(`**Matchmaking2**: Error occurred: ${error.message}`);
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
    
    const MAX_NAME_WIDTH = 20;
    const MAX_RIOT_ID_WIDTH = 25;
    
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

// STEP 2: Assign roles to all players using iterative optimization
async function assignRolesToPlayers(players, numMatches, debug) {
    await debug.info(`**Matchmaking2**: 🎯 Starting iterative role assignment optimization for ${players.length} players across ${numMatches} matches`);
    
    const roles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
    const playersPerRole = numMatches * 2; // 2 players per role per match
    
    // Analyze role preferences
    await debug.info('**Matchmaking2**: 📊 Analyzing role preferences');
    const primaryRoleCounts = {};
    const secondaryRoleCounts = {};
    for (const role of roles) {
        primaryRoleCounts[role] = 0;
        secondaryRoleCounts[role] = 0;
    }
    
    for (const player of players) {
        if (player.primaryRole === 'Fill') {
            for (const role of roles) primaryRoleCounts[role]++;
        } else {
            primaryRoleCounts[player.primaryRole]++;
        }
        
        if (player.secondaryRole === 'Fill') {
            for (const role of roles) secondaryRoleCounts[role]++;
        } else {
            secondaryRoleCounts[player.secondaryRole]++;
        }
    }
    
    let countMsg = '**Role Preferences:**\n';
    for (const role of roles) {
        countMsg += `  • ${role}: ${primaryRoleCounts[role]} primary, ${secondaryRoleCounts[role]} secondary (need ${playersPerRole})\n`;
    }
    await debug.info(countMsg);
    
    // Run iterative optimization (1000 iterations)
    await debug.info('**Matchmaking2**: 🔄 Running iterative optimization (1000 iterations)...');
    
    let bestAssignment = null;
    let bestScore = {
        autofills: Infinity,
        secondaries: Infinity,
        mmrVariance: Infinity
    };
    
    const numIterations = 1000;
    
    for (let iteration = 0; iteration < numIterations; iteration++) {
        const assignment = createOptimizedRoleAssignment(players, roles, playersPerRole);
        
        if (assignment) {
            const score = scoreRoleAssignment(assignment, roles);
            
            // Lexicographic comparison: autofills > secondaries > mmrVariance
            const isBetter = 
                score.autofills < bestScore.autofills ||
                (score.autofills === bestScore.autofills && score.secondaries < bestScore.secondaries) ||
                (score.autofills === bestScore.autofills && score.secondaries === bestScore.secondaries && score.mmrVariance < bestScore.mmrVariance);
            
            if (isBetter) {
                bestScore = score;
                bestAssignment = assignment;
            }
        }
        
        // Log progress every 200 iterations
        if ((iteration + 1) % 200 === 0) {
            await debug.info(`**Matchmaking2**: Iteration ${iteration + 1}/${numIterations} | Best: ${bestScore.autofills} autofills, ${bestScore.secondaries} secondaries, ${bestScore.mmrVariance.toFixed(2)} MMR variance`);
        }
    }
    
    if (!bestAssignment) {
        await debug.error('**Matchmaking2**: ❌ Failed to create valid role assignment');
        throw new Error('Failed to create valid role assignment');
    }
    
    await debug.success(`**Matchmaking2**: ✅ Best assignment found: ${bestScore.autofills} autofills, ${bestScore.secondaries} secondaries, ${bestScore.mmrVariance.toFixed(2)} MMR variance`);
    
    // Display final summary
    await debug.info('**Matchmaking2**: 📋 Final Role Assignment Summary:');
    for (const role of roles) {
        const primaries = bestAssignment[role].filter(p => p.roleType === 'primary').length;
        const secondaries = bestAssignment[role].filter(p => p.roleType === 'secondary').length;
        const autofills = bestAssignment[role].filter(p => p.roleType === 'autofill').length;
        const avgMMR = (bestAssignment[role].reduce((sum, p) => sum + p.mmr, 0) / bestAssignment[role].length).toFixed(1);
        await debug.info(`  • ${role}: ${primaries}p/${secondaries}s/${autofills}a (avg MMR: ${avgMMR})`);
    }
    
    return bestAssignment;
}

// Create an optimized role assignment using greedy algorithm with MMR consideration
function createOptimizedRoleAssignment(players, roles, playersPerRole) {
    // Shuffle players to introduce randomness across iterations
    const shuffledPlayers = fisherYatesShuffle(players);
    
    const roleAssignments = {};
    for (const role of roles) {
        roleAssignments[role] = [];
    }
    
    const assignedPlayers = new Set();
    
    // Build assignment pools for each role
    const rolePools = {};
    for (const role of roles) {
        rolePools[role] = {
            primary: [],
            secondary: [],
            autofill: []
        };
    }
    
    for (const player of shuffledPlayers) {
        for (const role of roles) {
            if (player.primaryRole === role || player.primaryRole === 'Fill') {
                rolePools[role].primary.push(player);
            }
            if (player.secondaryRole === role || player.secondaryRole === 'Fill') {
                rolePools[role].secondary.push(player);
            }
            // Everyone is autofill candidate
            rolePools[role].autofill.push(player);
        }
    }
    
    // Sort each pool by MMR to enable MMR-balanced selection
    for (const role of roles) {
        rolePools[role].primary.sort((a, b) => a.mmr - b.mmr);
        rolePools[role].secondary.sort((a, b) => a.mmr - b.mmr);
        rolePools[role].autofill.sort((a, b) => a.mmr - b.mmr);
    }
    
    // Strategy: Process roles in random order to vary assignments
    const roleOrder = fisherYatesShuffle(roles);
    
    for (const role of roleOrder) {
        // Try to fill with primaries first, selecting evenly across MMR spectrum
        const availablePrimaries = rolePools[role].primary.filter(p => !assignedPlayers.has(p.userId));
        const primarySelections = selectPlayersEvenly(availablePrimaries, playersPerRole);
        
        for (const player of primarySelections) {
            if (roleAssignments[role].length >= playersPerRole) break;
            roleAssignments[role].push({
                ...player,
                assignedRole: role,
                roleType: 'primary',
                effectiveMMR: player.mmr
            });
            assignedPlayers.add(player.userId);
        }
        
        // Fill remaining with secondaries
        if (roleAssignments[role].length < playersPerRole) {
            const availableSecondaries = rolePools[role].secondary.filter(p => !assignedPlayers.has(p.userId));
            const secondaryNeeded = playersPerRole - roleAssignments[role].length;
            const secondarySelections = selectPlayersEvenly(availableSecondaries, secondaryNeeded);
            
            for (const player of secondarySelections) {
                if (roleAssignments[role].length >= playersPerRole) break;
                roleAssignments[role].push({
                    ...player,
                    assignedRole: role,
                    roleType: 'secondary',
                    effectiveMMR: player.mmr
                });
                assignedPlayers.add(player.userId);
            }
        }
        
        // Fill remaining with autofills
        if (roleAssignments[role].length < playersPerRole) {
            const availableAutofills = rolePools[role].autofill.filter(p => !assignedPlayers.has(p.userId));
            const autofillNeeded = playersPerRole - roleAssignments[role].length;
            const autofillSelections = selectPlayersEvenly(availableAutofills, autofillNeeded);
            
            for (const player of autofillSelections) {
                if (roleAssignments[role].length >= playersPerRole) break;
                roleAssignments[role].push({
                    ...player,
                    assignedRole: role,
                    roleType: 'autofill',
                    effectiveMMR: Math.floor(player.mmr * 0.85)
                });
                assignedPlayers.add(player.userId);
            }
        }
    }
    
    // Validate assignment
    for (const role of roles) {
        if (roleAssignments[role].length !== playersPerRole) {
            return null;
        }
    }
    
    return roleAssignments;
}

// Select players spread across the MMR spectrum using stratified random sampling.
// `players` is expected to be sorted ascending by MMR. We split the pool into `count`
// equal-size strata and pick ONE uniformly random player from each stratum. This
// preserves MMR spread (so lanes can later be balanced) while still producing real
// variety across iterations, instead of the old near-deterministic stride which
// always selected nearly the same player at each MMR rank.
function selectPlayersEvenly(players, count) {
    if (players.length === 0) return [];
    if (players.length <= count) return players.slice();

    // When we're picking the majority of the pool, the strata are too tight to give
    // real variety (e.g. picking 4 of 6 leaves 1-2 candidates per stratum, which is
    // close to deterministic). Fall back to uniform random sampling in that case.
    if (count * 2 > players.length) {
        return fisherYatesShuffle(players).slice(0, count);
    }

    const selected = [];
    const used = new Set();
    const bucketSize = players.length / count;

    for (let i = 0; i < count; i++) {
        const lo = Math.floor(i * bucketSize);
        const hi = Math.floor((i + 1) * bucketSize);
        const span = Math.max(1, hi - lo);

        // Try a few random picks within this stratum to avoid collisions on tiny strata
        let pickIdx = lo + Math.floor(Math.random() * span);
        let attempts = 0;
        while (used.has(pickIdx) && attempts < span) {
            pickIdx = lo + ((pickIdx - lo + 1) % span);
            attempts++;
        }
        if (used.has(pickIdx)) continue;

        used.add(pickIdx);
        selected.push(players[Math.min(pickIdx, players.length - 1)]);
    }

    return selected;
}

// Score a role assignment (Priority 1: autofills, Priority 2: secondaries, Priority 3: MMR variance)
function scoreRoleAssignment(assignment, roles) {
    let totalAutofills = 0;
    let totalSecondaries = 0;
    let totalMMRVariance = 0;
    
    for (const role of roles) {
        const rolePlayers = assignment[role];
        
        // Count autofills and secondaries
        for (const player of rolePlayers) {
            if (player.roleType === 'autofill') totalAutofills++;
            else if (player.roleType === 'secondary') totalSecondaries++;
        }
        
        // Calculate MMR variance for this role
        // This measures how spread out the MMRs are for players assigned to the same role
        const mmrs = rolePlayers.map(p => p.mmr);
        const avgMMR = mmrs.reduce((sum, mmr) => sum + mmr, 0) / mmrs.length;
        const variance = mmrs.reduce((sum, mmr) => sum + Math.pow(mmr - avgMMR, 2), 0) / mmrs.length;
        totalMMRVariance += variance;
    }
    
    return {
        autofills: totalAutofills,
        secondaries: totalSecondaries,
        mmrVariance: totalMMRVariance
    };
}

// STEP 3: Create balanced matches from role assignments
async function createBalancedMatches(roleAssignments, numMatches, debug) {
    await debug.info(`**Matchmaking2**: Creating ${numMatches} balanced matches from role assignments`);
    
    const roles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
    let bestMatches = null;
    let bestScore = Infinity;
    const numAttempts = 500; // Try 500 different scenarios
    
    for (let attempt = 0; attempt < numAttempts; attempt++) {
        const matches = [];
        const usedIndices = {};
        
        // Initialize usedIndices for each role
        for (const role of roles) {
            usedIndices[role] = new Set();
        }
        
        let validScenario = true;
        
        // Create each match
        for (let matchIndex = 0; matchIndex < numMatches; matchIndex++) {
            const team1 = [];
            const team2 = [];
            
            // For each role, pick 2 players (one for each team)
            for (const role of roles) {
                const availablePlayers = roleAssignments[role].filter((_, idx) => 
                    !usedIndices[role].has(idx)
                );
                
                if (availablePlayers.length < 2) {
                    validScenario = false;
                    break;
                }
                
                // Randomly pick 2 players for this role
                const shuffled = fisherYatesShuffle(availablePlayers);
                const player1 = shuffled[0];
                const player2 = shuffled[1];
                
                // Find their original indices
                const idx1 = roleAssignments[role].findIndex(p => 
                    p.userId === player1.userId && !usedIndices[role].has(roleAssignments[role].indexOf(p))
                );
                const idx2 = roleAssignments[role].findIndex(p => 
                    p.userId === player2.userId && p.userId !== player1.userId && !usedIndices[role].has(roleAssignments[role].indexOf(p))
                );
                
                usedIndices[role].add(idx1);
                usedIndices[role].add(idx2);
                
                team1.push(player1);
                team2.push(player2);
            }
            
            if (!validScenario) break;
            
            const team1MMR = team1.reduce((sum, p) => sum + p.effectiveMMR, 0);
            const team2MMR = team2.reduce((sum, p) => sum + p.effectiveMMR, 0);
            
            matches.push({
                team1,
                team2,
                team1MMR,
                team2MMR
            });
        }
        
        if (validScenario && matches.length === numMatches) {
            const score = calculateScenarioScore(matches);
            
            if (score < bestScore) {
                bestScore = score;
                bestMatches = matches;
            }
        }
        
        // Log progress every 50 attempts
        if ((attempt + 1) % 50 === 0) {
            await debug.info(`**Matchmaking2**: Evaluated ${attempt + 1}/${numAttempts} scenarios, best score: ${bestScore.toFixed(2)}`);
        }
    }
    
    if (!bestMatches) {
        await debug.error('**Matchmaking2**: Failed to create valid matches');
        return [];
    }
    
    await debug.success(`**Matchmaking2**: Created ${bestMatches.length} matches with scenario score: ${bestScore.toFixed(2)}`);
    
    // Apply optimization to improve lane balance and team MMR
    await debug.info('**Matchmaking2**: Starting optimization pass...');
    let optimizedMatches = await optimizeMatches(bestMatches, debug);

    // Cross-match optimization: try swapping same-role players across matches.
    // This breaks the optimizer out of local optima where the same pairs are locked
    // into the same match every run.
    await debug.info('**Matchmaking2**: Starting cross-match optimization pass...');
    optimizedMatches = await crossMatchOptimization(optimizedMatches, calculateMatchScore, debug);

    await debug.success('**Matchmaking2**: Optimization complete!');
    return optimizedMatches;
}

// Cross-match optimization: swap same-role players between different matches if it
// reduces total score. Players don't change role, but their roleType (primary /
// secondary / autofill) and effectiveMMR may shift based on their preferences in
// the new match context.
async function crossMatchOptimization(matches, scoreFn, debug) {
    if (matches.length < 2) return matches;
    const roles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
    let improved = true;
    let passCount = 0;
    const maxPasses = 5;
    let totalSwaps = 0;

    while (improved && passCount < maxPasses) {
        improved = false;
        passCount++;

        for (let i = 0; i < matches.length; i++) {
            for (let j = i + 1; j < matches.length; j++) {
                for (const role of roles) {
                    for (const teamKey of ['team1', 'team2']) {
                        if (trySwapAcrossMatches(matches[i], matches[j], role, teamKey, scoreFn)) {
                            improved = true;
                            totalSwaps++;
                        }
                    }
                }
            }
        }
    }

    if (debug) {
        await debug.info(`**Cross-Match Optimization**: Performed ${totalSwaps} swap(s) over ${passCount} pass(es)`);
    }
    return matches;
}

function reassignPlayerToRole(player, role) {
    let roleType = 'autofill';
    let effectiveMMR = Math.floor(player.mmr * 0.85);
    if (player.primaryRole === role || player.primaryRole === 'Fill') {
        roleType = 'primary';
        effectiveMMR = player.mmr;
    } else if (player.secondaryRole === role || player.secondaryRole === 'Fill') {
        roleType = 'secondary';
        effectiveMMR = player.mmr;
    }
    return { ...player, assignedRole: role, roleType, effectiveMMR };
}

function trySwapAcrossMatches(matchA, matchB, role, teamKey, scoreFn) {
    const idxA = matchA[teamKey].findIndex(p => p.assignedRole === role);
    const idxB = matchB[teamKey].findIndex(p => p.assignedRole === role);
    if (idxA === -1 || idxB === -1) return false;

    const playerA = matchA[teamKey][idxA];
    const playerB = matchB[teamKey][idxB];

    const newA = reassignPlayerToRole(playerB, role);
    const newB = reassignPlayerToRole(playerA, role);

    const tempA = { team1: matchA.team1.slice(), team2: matchA.team2.slice() };
    const tempB = { team1: matchB.team1.slice(), team2: matchB.team2.slice() };
    tempA[teamKey][idxA] = newA;
    tempB[teamKey][idxB] = newB;
    tempA.team1MMR = tempA.team1.reduce((s, p) => s + p.effectiveMMR, 0);
    tempA.team2MMR = tempA.team2.reduce((s, p) => s + p.effectiveMMR, 0);
    tempB.team1MMR = tempB.team1.reduce((s, p) => s + p.effectiveMMR, 0);
    tempB.team2MMR = tempB.team2.reduce((s, p) => s + p.effectiveMMR, 0);

    const beforeScore = scoreFn(matchA) + scoreFn(matchB);
    const afterScore = scoreFn(tempA) + scoreFn(tempB);

    if (afterScore < beforeScore) {
        matchA.team1 = tempA.team1;
        matchA.team2 = tempA.team2;
        matchA.team1MMR = tempA.team1MMR;
        matchA.team2MMR = tempA.team2MMR;
        matchB.team1 = tempB.team1;
        matchB.team2 = tempB.team2;
        matchB.team1MMR = tempB.team1MMR;
        matchB.team2MMR = tempB.team2MMR;
        return true;
    }
    return false;
}

// Calculate score for a scenario (prioritize lane balance and team MMR balance)
function calculateScenarioScore(matches) {
    let totalScore = 0;
    const roles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
    
    for (const match of matches) {
        // Team MMR difference
        const teamMMRDiff = Math.abs(match.team1MMR - match.team2MMR);
        
        // Lane MMR differences
        let totalLaneDiff = 0;
        let maxLaneDiff = 0;
        
        for (const role of roles) {
            const team1Player = match.team1.find(p => p.assignedRole === role);
            const team2Player = match.team2.find(p => p.assignedRole === role);
            
            if (team1Player && team2Player) {
                const laneDiff = Math.abs(team1Player.effectiveMMR - team2Player.effectiveMMR);
                totalLaneDiff += laneDiff;
                maxLaneDiff = Math.max(maxLaneDiff, laneDiff);
            }
        }
        
        const avgLaneDiff = totalLaneDiff / roles.length;
        
        // Count role penalties (autofills and secondaries)
        const team1Autofills = match.team1.filter(p => p.roleType === 'autofill').length;
        const team2Autofills = match.team2.filter(p => p.roleType === 'autofill').length;
        const autofillImbalance = Math.abs(team1Autofills - team2Autofills);
        
        // Scoring weights (prioritize in this order):
        // 1. Average lane MMR difference (most important for competitive fairness)
        // 2. Maximum lane MMR difference (avoid any one lane being too unbalanced)
        // 3. Team MMR difference (overall balance)
        // 4. Autofill imbalance (fairness in role assignments)
        const matchScore = 
            (avgLaneDiff * 10) +           // Heavily weight average lane balance
            (maxLaneDiff * 5) +            // Weight maximum lane imbalance
            (teamMMRDiff * 2) +            // Moderate weight on team balance
            (autofillImbalance * 100);     // Penalize autofill imbalance between teams
        
        totalScore += matchScore;
    }
    
    return totalScore;
}

// Optimize matches by swapping players between teams
async function optimizeMatches(matches, debug) {
    const roles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
    let improved = true;
    let passCount = 0;
    const maxPasses = 15;
    
    while (improved && passCount < maxPasses) {
        improved = false;
        passCount++;
        
        for (let matchIndex = 0; matchIndex < matches.length; matchIndex++) {
            const match = matches[matchIndex];
            const currentScore = calculateMatchScore(match);
            
            // Try swapping each role between teams
            for (const role of roles) {
                const team1Player = match.team1.find(p => p.assignedRole === role);
                const team2Player = match.team2.find(p => p.assignedRole === role);
                
                if (!team1Player || !team2Player) continue;
                
                // Calculate new metrics if we swap these players
                const newTeam1MMR = match.team1MMR - team1Player.effectiveMMR + team2Player.effectiveMMR;
                const newTeam2MMR = match.team2MMR - team2Player.effectiveMMR + team1Player.effectiveMMR;
                
                // Create temporary match to calculate new score
                const tempMatch = {
                    team1: match.team1.map(p => p.assignedRole === role ? team2Player : p),
                    team2: match.team2.map(p => p.assignedRole === role ? team1Player : p),
                    team1MMR: newTeam1MMR,
                    team2MMR: newTeam2MMR
                };
                
                const newScore = calculateMatchScore(tempMatch);
                
                // Swap if it improves the score
                if (newScore < currentScore) {
                    match.team1 = tempMatch.team1;
                    match.team2 = tempMatch.team2;
                    match.team1MMR = newTeam1MMR;
                    match.team2MMR = newTeam2MMR;
                    
                    improved = true;
                    await debug.info(`**Optimization**: Match ${matchIndex + 1} - Swapped ${role} players, score: ${currentScore.toFixed(2)} → ${newScore.toFixed(2)}`);
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

// Calculate match score (used for optimization)
function calculateMatchScore(match) {
    const roles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
    
    // Team MMR difference
    const teamMMRDiff = Math.abs(match.team1MMR - match.team2MMR);
    
    // Lane MMR differences
    let totalLaneDiff = 0;
    let maxLaneDiff = 0;
    
    for (const role of roles) {
        const team1Player = match.team1.find(p => p.assignedRole === role);
        const team2Player = match.team2.find(p => p.assignedRole === role);
        
        if (team1Player && team2Player) {
            const laneDiff = Math.abs(team1Player.effectiveMMR - team2Player.effectiveMMR);
            totalLaneDiff += laneDiff;
            maxLaneDiff = Math.max(maxLaneDiff, laneDiff);
        }
    }
    
    const avgLaneDiff = totalLaneDiff / roles.length;
    
    // Role penalties
    const team1Autofills = match.team1.filter(p => p.roleType === 'autofill').length;
    const team2Autofills = match.team2.filter(p => p.roleType === 'autofill').length;
    const autofillImbalance = Math.abs(team1Autofills - team2Autofills);
    
    const score = 
        (avgLaneDiff * 10) +
        (maxLaneDiff * 5) +
        (teamMMRDiff * 2) +
        (autofillImbalance * 100);
    
    return score;
}

// Calculate lane balance metrics for display
function calculateLaneBalanceMetrics(match) {
    const roles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
    let totalLaneDiff = 0;
    let maxLaneDiff = 0;
    
    for (const role of roles) {
        const team1Player = match.team1.find(p => p.assignedRole === role);
        const team2Player = match.team2.find(p => p.assignedRole === role);
        
        if (team1Player && team2Player) {
            const laneDiff = Math.abs(team1Player.effectiveMMR - team2Player.effectiveMMR);
            totalLaneDiff += laneDiff;
            maxLaneDiff = Math.max(maxLaneDiff, laneDiff);
        }
    }
    
    return {
        avgLaneDiff: totalLaneDiff / roles.length,
        maxLaneDiff
    };
}

// Main matchmaking algorithm
async function runRoleFirstMatchmaking(players, numMatches, debug) {
    await debug.info(`**Matchmaking2**: Starting role-first matchmaking algorithm`);
    
    // STEP 2: Assign roles to all players first
    const roleAssignments = await assignRolesToPlayers(players, numMatches, debug);
    
    // STEP 3: Create balanced matches from role assignments
    const matches = await createBalancedMatches(roleAssignments, numMatches, debug);
    
    return matches;
}

// Expose internals for unit / variety tests without affecting the slash-command interface.
Object.assign(module.exports, {
    _test: {
        fisherYatesShuffle,
        runRoleFirstMatchmaking,
        selectPlayersEvenly,
        calculateMatchScore,
        calculateScenarioScore,
        crossMatchOptimization,
        assignRolesToPlayers,
        createBalancedMatches,
    }
});
