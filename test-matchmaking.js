const { GoogleSheetsService } = require('./services/googleSheets');
require('dotenv').config();

// Import matchmaking functions from run-matchmaking.js
function createOptimalMatches(players) {
    const roles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
    const numMatches = Math.floor(players.length / 10);
    
    if (numMatches === 0) return [];
    
    const playersToUse = players.slice(0, numMatches * 10);
    let bestMatches = null;
    let bestScore = Infinity;
    
    // Run multiple iterations to find best matches
    for (let run = 0; run < 10; run++) {
        for (let iteration = 0; iteration < 10; iteration++) {
            const shuffled = [...playersToUse].sort(() => Math.random() - 0.5);
            const matches = createMatchesFromPlayers(shuffled, numMatches);
            
            if (matches.length > 0) {
                const score = calculateOverallScore(matches);
                if (score < bestScore) {
                    bestScore = score;
                    bestMatches = matches;
                }
            }
        }
    }
    
    return bestMatches || [];
}

function createMatchesFromPlayers(players, numMatches) {
    const matches = [];
    const availablePlayers = [...players];
    
    for (let matchIndex = 0; matchIndex < numMatches; matchIndex++) {
        const matchPlayers = availablePlayers.splice(0, 10);
        const match = createSingleMatch(matchPlayers);
        
        if (match) {
            matches.push(match);
        }
    }
    
    return matches;
}

function createSingleMatch(players) {
    const roles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
    const team1 = [];
    const team2 = [];
    const usedPlayers = new Set();
    
    // Assign players to roles
    for (const role of roles) {
        const availablePlayers = players.filter(p => !usedPlayers.has(p.userId));
        
        // Sort by role preference
        availablePlayers.sort((a, b) => {
            const aScore = getRolePreferenceScore(a, role);
            const bScore = getRolePreferenceScore(b, role);
            return aScore - bScore;
        });
        
        if (availablePlayers.length >= 2) {
            // Assign best two players to each team
            const player1 = availablePlayers[0];
            const player2 = availablePlayers[1];
            
            team1.push(assignPlayerToRole(player1, role));
            team2.push(assignPlayerToRole(player2, role));
            
            usedPlayers.add(player1.userId);
            usedPlayers.add(player2.userId);
        } else {
            return null; // Can't create valid match
        }
    }
    
    const team1MMR = team1.reduce((sum, p) => sum + p.effectiveMMR, 0);
    const team2MMR = team2.reduce((sum, p) => sum + p.effectiveMMR, 0);
    
    return {
        team1,
        team2,
        team1MMR,
        team2MMR,
        mmrDifference: Math.abs(team1MMR - team2MMR)
    };
}

function getRolePreferenceScore(player, role) {
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

function calculateOverallScore(matches) {
    let totalScore = 0;
    
    for (const match of matches) {
        // MMR difference penalty
        totalScore += match.mmrDifference;
        
        // Role assignment penalties
        for (const team of [match.team1, match.team2]) {
            for (const player of team) {
                if (player.roleType === 'autofill') {
                    totalScore += 100; // Heavy penalty for autofill
                } else if (player.roleType === 'secondary') {
                    totalScore += 10; // Light penalty for secondary
                }
            }
        }
    }
    
    return totalScore;
}

async function testMatchmakingWithRealData() {
    console.log('⚔️ Testing matchmaking algorithm with real Google Sheets data...\n');
    
    try {
        const googleSheetsService = new GoogleSheetsService();
        
        // Get 20 random players for testing
        const randomPlayers = await googleSheetsService.getRandomPlayers(20);
        console.log(`📊 Retrieved ${randomPlayers.length} players from Google Sheets`);
        
        // Convert to format expected by matchmaking algorithm
        const playersWithData = randomPlayers.map((player, index) => ({
            userId: `test_${player.username}_${index}`,
            username: player.username,
            displayName: player.username,
            joinTime: Date.now(),
            mmr: player.mmr,
            primaryRole: player.primaryRole,
            secondaryRole: player.secondaryRole,
            riotId: player.riotId
        }));
        
        console.log('\n👥 Test Players:');
        playersWithData.forEach((player, index) => {
            console.log(`  ${index + 1}. ${player.username} (${player.riotId}) - ${player.primaryRole}/${player.secondaryRole} - MMR: ${player.mmr}`);
        });
        
        // Run matchmaking algorithm
        console.log('\n🎯 Running matchmaking algorithm...');
        const startTime = Date.now();
        const matches = createOptimalMatches(playersWithData);
        const endTime = Date.now();
        
        console.log(`⏱️ Matchmaking completed in ${endTime - startTime}ms`);
        console.log(`🏆 Created ${matches.length} matches`);
        
        // Display match results
        if (matches.length > 0) {
            matches.forEach((match, index) => {
                console.log(`\n🥊 Match ${index + 1}:`);
                console.log(`   MMR Difference: ${match.mmrDifference}`);
                
                console.log('   Team 1:');
                match.team1.forEach(player => {
                    const roleIndicator = player.roleType === 'primary' ? '✅' : 
                                        player.roleType === 'secondary' ? '🔶' : '❌';
                    console.log(`     ${roleIndicator} ${player.assignedRole}: ${player.username} (MMR: ${player.effectiveMMR})`);
                });
                
                console.log('   Team 2:');
                match.team2.forEach(player => {
                    const roleIndicator = player.roleType === 'primary' ? '✅' : 
                                        player.roleType === 'secondary' ? '🔶' : '❌';
                    console.log(`     ${roleIndicator} ${player.assignedRole}: ${player.username} (MMR: ${player.effectiveMMR})`);
                });
            });
            
            // Calculate statistics
            const totalMMRDifference = matches.reduce((sum, match) => sum + match.mmrDifference, 0);
            const avgMMRDifference = totalMMRDifference / matches.length;
            
            let totalAutofills = 0;
            let totalSecondaries = 0;
            let totalPrimaries = 0;
            
            matches.forEach(match => {
                [...match.team1, ...match.team2].forEach(player => {
                    if (player.roleType === 'autofill') totalAutofills++;
                    else if (player.roleType === 'secondary') totalSecondaries++;
                    else totalPrimaries++;
                });
            });
            
            console.log('\n📈 Match Statistics:');
            console.log(`   Average MMR Difference: ${avgMMRDifference.toFixed(1)}`);
            console.log(`   Primary Role Assignments: ${totalPrimaries} (${((totalPrimaries / (matches.length * 10)) * 100).toFixed(1)}%)`);
            console.log(`   Secondary Role Assignments: ${totalSecondaries} (${((totalSecondaries / (matches.length * 10)) * 100).toFixed(1)}%)`);
            console.log(`   Autofill Assignments: ${totalAutofills} (${((totalAutofills / (matches.length * 10)) * 100).toFixed(1)}%)`);
        }
        
        // Test flex queue (remaining players)
        const flexPlayers = playersWithData.slice(matches.length * 10);
        if (flexPlayers.length > 0) {
            console.log(`\n🔄 Flex Queue (${flexPlayers.length} players):`);
            flexPlayers.forEach(player => {
                console.log(`   • ${player.username} (${player.riotId}) - ${player.primaryRole}/${player.secondaryRole}`);
            });
        }
        
        return true;
    } catch (error) {
        console.error('❌ Matchmaking test failed:', error);
        return false;
    }
}

// Run the test
testMatchmakingWithRealData().catch(console.error);
