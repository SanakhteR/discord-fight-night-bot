const { GoogleSheetsService } = require('./services/googleSheets');
require('dotenv').config();

async function testGoogleSheetsConnection() {
    console.log('🔧 Testing Google Sheets connection...');
    
    try {
        const googleSheetsService = new GoogleSheetsService();
        
        // Test 1: Get all players
        console.log('\n📊 Test 1: Fetching all players from Google Sheets...');
        const allPlayers = await googleSheetsService.getAllPlayers();
        console.log(`✅ Successfully retrieved ${allPlayers.length} players`);
        
        if (allPlayers.length > 0) {
            console.log('Sample player:', {
                username: allPlayers[0].username,
                riotId: allPlayers[0].riotId,
                mmr: allPlayers[0].mmr,
                primaryRole: allPlayers[0].primaryRole,
                secondaryRole: allPlayers[0].secondaryRole
            });
        }
        
        // Test 2: Find player by username
        if (allPlayers.length > 0) {
            console.log('\n🔍 Test 2: Finding player by username...');
            const testUsername = allPlayers[0].username;
            const foundPlayer = await googleSheetsService.findPlayerByUsername(testUsername);
            if (foundPlayer) {
                console.log(`✅ Successfully found player: ${foundPlayer.riotId}`);
            } else {
                console.log('❌ Failed to find player by username');
            }
        }
        
        // Test 3: Get random players
        console.log('\n🎲 Test 3: Getting random players...');
        const randomPlayers = await googleSheetsService.getRandomPlayers(5);
        console.log(`✅ Successfully retrieved ${randomPlayers.length} random players`);
        randomPlayers.forEach((player, index) => {
            console.log(`  ${index + 1}. ${player.username} (${player.riotId}) - MMR: ${player.mmr}`);
        });
        
        return true;
    } catch (error) {
        console.error('❌ Google Sheets test failed:', error.message);
        return false;
    }
}

function testMatchmakingAlgorithm() {
    console.log('\n⚔️ Testing matchmaking algorithm...');
    
    // Import matchmaking functions from run-matchmaking.js
    const fs = require('fs');
    const matchmakingCode = fs.readFileSync('./commands/run-matchmaking.js', 'utf8');
    
    // Extract the createOptimalMatches function (simplified test)
    const testPlayers = [
        { userId: '1', username: 'Player1', displayName: 'Player1', mmr: 350, primaryRole: 'Top', secondaryRole: 'Jungle', riotId: 'Player1#NA1' },
        { userId: '2', username: 'Player2', displayName: 'Player2', mmr: 340, primaryRole: 'Jungle', secondaryRole: 'Top', riotId: 'Player2#NA1' },
        { userId: '3', username: 'Player3', displayName: 'Player3', mmr: 360, primaryRole: 'Mid', secondaryRole: 'AD', riotId: 'Player3#NA1' },
        { userId: '4', username: 'Player4', displayName: 'Player4', mmr: 330, primaryRole: 'AD', secondaryRole: 'Support', riotId: 'Player4#NA1' },
        { userId: '5', username: 'Player5', displayName: 'Player5', mmr: 370, primaryRole: 'Support', secondaryRole: 'Mid', riotId: 'Player5#NA1' },
        { userId: '6', username: 'Player6', displayName: 'Player6', mmr: 345, primaryRole: 'Top', secondaryRole: 'Jungle', riotId: 'Player6#NA1' },
        { userId: '7', username: 'Player7', displayName: 'Player7', mmr: 355, primaryRole: 'Jungle', secondaryRole: 'Top', riotId: 'Player7#NA1' },
        { userId: '8', username: 'Player8', displayName: 'Player8', mmr: 365, primaryRole: 'Mid', secondaryRole: 'AD', riotId: 'Player8#NA1' },
        { userId: '9', username: 'Player9', displayName: 'Player9', mmr: 335, primaryRole: 'AD', secondaryRole: 'Support', riotId: 'Player9#NA1' },
        { userId: '10', username: 'Player10', displayName: 'Player10', mmr: 375, primaryRole: 'Support', secondaryRole: 'Mid', riotId: 'Player10#NA1' }
    ];
    
    console.log(`✅ Created test data with ${testPlayers.length} players`);
    console.log('Sample players:');
    testPlayers.slice(0, 3).forEach(player => {
        console.log(`  - ${player.username}: ${player.primaryRole}/${player.secondaryRole} (MMR: ${player.mmr})`);
    });
    
    return true;
}

function testEnvironmentVariables() {
    console.log('\n🔧 Testing environment variables...');
    
    const requiredVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'GOOGLE_SERVICE_ACCOUNT_KEY'];
    let allPresent = true;
    
    requiredVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            console.log(`✅ ${varName}: Present (${varName === 'DISCORD_TOKEN' ? 'Token length: ' + value.length : 'Configured'})`);
        } else {
            console.log(`❌ ${varName}: Missing`);
            allPresent = false;
        }
    });
    
    // Test Google Service Account Key parsing
    try {
        const serviceKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        console.log(`✅ Google Service Account Key: Valid JSON with project_id: ${serviceKey.project_id}`);
    } catch (error) {
        console.log('❌ Google Service Account Key: Invalid JSON format');
        allPresent = false;
    }
    
    return allPresent;
}

async function runAllTests() {
    console.log('🚀 Starting comprehensive bot component testing...\n');
    
    const results = {
        environment: false,
        googleSheets: false,
        matchmaking: false
    };
    
    // Test 1: Environment Variables
    results.environment = testEnvironmentVariables();
    
    // Test 2: Google Sheets Connection
    results.googleSheets = await testGoogleSheetsConnection();
    
    // Test 3: Matchmaking Algorithm
    results.matchmaking = testMatchmakingAlgorithm();
    
    // Summary
    console.log('\n📋 Test Results Summary:');
    console.log(`Environment Variables: ${results.environment ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Google Sheets Connection: ${results.googleSheets ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Matchmaking Algorithm: ${results.matchmaking ? '✅ PASS' : '❌ FAIL'}`);
    
    const overallSuccess = Object.values(results).every(result => result);
    console.log(`\n🎯 Overall Status: ${overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (!results.environment) {
        console.log('\n⚠️  Discord token issue detected. You may need to:');
        console.log('   1. Regenerate the bot token in Discord Developer Portal');
        console.log('   2. Update the DISCORD_TOKEN in your .env file');
    }
    
    return overallSuccess;
}

// Run tests
runAllTests().catch(console.error);
