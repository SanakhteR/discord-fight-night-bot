// Run this script after updating the Discord token to test live bot functions
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

async function testBotConnection() {
    console.log('🤖 Testing Discord bot connection...');
    
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Connection timeout after 10 seconds'));
        }, 10000);
        
        client.once('ready', () => {
            clearTimeout(timeout);
            console.log(`✅ Bot connected successfully as ${client.user.tag}`);
            console.log(`📊 Connected to ${client.guilds.cache.size} guild(s)`);
            
            // Test channel access
            const guild = client.guilds.cache.first();
            if (guild) {
                console.log(`🏠 Guild: ${guild.name} (${guild.memberCount} members)`);
                
                const channels = {
                    general: guild.channels.cache.find(ch => ch.name === 'fight-night-general'),
                    mods: guild.channels.cache.find(ch => ch.name === 'fightnightmods'),
                    welcome: guild.channels.cache.find(ch => ch.name === 'welcome'),
                    debug: guild.channels.cache.find(ch => ch.name === 'list-status-and-debug'),
                    staging: guild.channels.cache.find(ch => ch.name === 'Fight Night Staging Area'),
                    points: guild.channels.cache.find(ch => ch.name === "I'm here for the points!")
                };
                
                console.log('\n📺 Channel Access Test:');
                Object.entries(channels).forEach(([name, channel]) => {
                    console.log(`${channel ? '✅' : '❌'} ${name}: ${channel ? 'Found' : 'Not found'}`);
                });
                
                // Test roles
                const roles = {
                    admin: guild.roles.cache.find(role => role.name === 'Admin'),
                    moderator: guild.roles.cache.find(role => role.name === 'Moderator'),
                    verified: guild.roles.cache.find(role => role.name === 'Verified'),
                    unverified: guild.roles.cache.find(role => role.name === 'Unverified')
                };
                
                console.log('\n👥 Role Access Test:');
                Object.entries(roles).forEach(([name, role]) => {
                    console.log(`${role ? '✅' : '❌'} ${name}: ${role ? 'Found' : 'Not found'}`);
                });
            }
            
            client.destroy();
            resolve(true);
        });
        
        client.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
        
        // Attempt to login
        client.login(process.env.DISCORD_TOKEN).catch(reject);
    });
}

// Run the test
testBotConnection()
    .then(() => {
        console.log('\n🎯 Discord connection test completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Run: node index.js');
        console.log('2. Check for startup message in #fight-night-general');
        console.log('3. Test slash commands in Discord');
        console.log('4. Join voice channels to test monitoring');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Discord connection test failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Verify Discord token is correct in .env file');
        console.log('2. Check bot permissions in Discord server');
        console.log('3. Ensure bot is added to the correct guild');
        process.exit(1);
    });
