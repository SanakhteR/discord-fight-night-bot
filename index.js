const { Client, GatewayIntentBits, Events, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { GoogleSheetsService } = require('./services/googleSheets');

const googleSheetsService = new GoogleSheetsService();
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration
    ]
});

// Initialize collections
client.commands = new Collection();
client.activePlayersList = [];
client.hereForPointsList = [];
client.verificationSessions = new Map();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Bot ready event
client.once(Events.Ready, async () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    
    // Initialize Active Players List
    client.activePlayersList = [];
    console.log('Initialized Active Players List with 0 players');
    
    // Initialize Here for Points List
    client.hereForPointsList = [];
    console.log('Initialized Here for Points List with 0 players');
    
    // Test Google Sheets connection
    try {
        const players = await googleSheetsService.getAllPlayers();
        console.log(`✅ Google Sheets connected successfully! Found ${players.length} players.`);
    } catch (error) {
        console.error('❌ Failed to connect to Google Sheets:', error);
    }
    
    // Send startup message
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (guild) {
        const generalChannel = guild.channels.cache.find(ch => ch.name === 'fight-night-general');
        if (generalChannel) {
            await generalChannel.send('Hi, this is TonyBot running! 🤖');
        }
    }

    // Initialize voice channel monitoring
    try {
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (guild) {
            const stagingChannel = guild.channels.cache.find(ch => ch.name === 'Fight Night Staging Area');
            const pointsChannel = guild.channels.cache.find(ch => ch.name === "I'm here for the points!");
            
            if (stagingChannel && stagingChannel.members) {
                stagingChannel.members.forEach(member => {
                    client.activePlayersList.push({
                        userId: member.id,
                        username: member.user.username,
                        displayName: member.displayName,
                        joinTime: Date.now()
                    });
                });
                console.log(`Initialized Active Players List with ${client.activePlayersList.length} players`);
            }
            
            if (pointsChannel && pointsChannel.members) {
                pointsChannel.members.forEach(member => {
                    client.hereForPointsList.push({
                        userId: member.id,
                        username: member.user.username,
                        displayName: member.displayName,
                        joinTime: Date.now()
                    });
                });
                console.log(`Initialized Here for Points List with ${client.hereForPointsList.length} players`);
            }
        }
    } catch (error) {
        console.error('Error initializing voice channel monitoring:', error);
    }
});

// Voice state update handler
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const member = newState.member;
    const guild = member.guild;
    
    const stagingChannel = guild.channels.cache.find(ch => ch.name === 'Fight Night Staging Area');
    const pointsChannel = guild.channels.cache.find(ch => ch.name === "I'm here for the points!");
    
    // Handle Fight Night Staging Area
    if (stagingChannel) {
        const wasInStaging = oldState.channelId === stagingChannel.id;
        const isInStaging = newState.channelId === stagingChannel.id;
        
        if (!wasInStaging && isInStaging) {
            // User joined staging area
            const playerData = {
                userId: member.id,
                username: member.user.username,
                displayName: member.displayName,
                joinTime: Date.now()
            };
            client.activePlayersList.push(playerData);
            console.log(`${member.user.username} joined Fight Night Staging Area`);
            
        } else if (wasInStaging && !isInStaging) {
            // User left staging area
            client.activePlayersList = client.activePlayersList.filter(p => p.userId !== member.id);
            console.log(`${member.user.username} left Fight Night Staging Area`);
        }
    }
    
    // Handle I'm here for the points!
    if (pointsChannel) {
        const wasInPoints = oldState.channelId === pointsChannel.id;
        const isInPoints = newState.channelId === pointsChannel.id;
        
        if (!wasInPoints && isInPoints) {
            // User joined points channel
            const playerData = {
                userId: member.id,
                username: member.user.username,
                displayName: member.displayName,
                joinTime: Date.now()
            };
            client.hereForPointsList.push(playerData);
            console.log(`${member.user.username} joined I'm here for the points!`);
            
        } else if (wasInPoints && !isInPoints) {
            // User left points channel
            client.hereForPointsList = client.hereForPointsList.filter(p => p.userId !== member.id);
            console.log(`${member.user.username} left I'm here for the points!`);
        }
    }
});

// Monitor Discord audit logs for new member joins
setInterval(async () => {
    try {
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) return;

        // Fetch recent audit log entries for member joins
        const auditLogs = await guild.fetchAuditLogs({
            type: 20, // MEMBER_JOIN (correct audit log type)
            limit: 10
        });

        const debugChannel = guild.channels.cache.find(ch => ch.name === 'list-status-and-debug');
        
        for (const entry of auditLogs.entries.values()) {
            // Check if this is a recent join (within last 2 minutes)
            const timeDiff = Date.now() - entry.createdTimestamp;
            if (timeDiff > 120000) continue; // Skip entries older than 2 minutes
            
            // Check if we've already processed this member
            const processedKey = `processed_${entry.target.id}_${entry.createdTimestamp}`;
            if (client.processedMembers?.has(processedKey)) continue;
            
            // Initialize processed members set if it doesn't exist
            if (!client.processedMembers) {
                client.processedMembers = new Set();
            }
            
            // Mark as processed
            client.processedMembers.add(processedKey);
            
            // Get the member object
            const member = guild.members.cache.get(entry.target.id);
            if (member) {
                if (debugChannel) {
                    await debugChannel.send(`🔧 **Discord Log Monitor**: Detected new member join: ${member.user.username}`);
                }
                await handleNewMemberVerification(member);
            }
        }
    } catch (error) {
        console.error('Error monitoring Discord audit logs:', error);
    }
}, 30000); // Check every 30 seconds

// New member verification handler
async function handleNewMemberVerification(member) {
    try {
        // Find debug channel for status messages
        const debugChannel = member.guild.channels.cache.find(ch => ch.name === 'list-status-and-debug');
        
        // Helper function to send debug messages
        const sendDebugMessage = async (message) => {
            if (debugChannel) {
                try {
                    await debugChannel.send(`🔧 **New Member Verification**: ${message}`);
                } catch (error) {
                    console.error('Error sending debug message:', error);
                }
            }
        };

        await sendDebugMessage(`New user ${member.user.username} (${member.displayName}) joined the server`);

        // Move user to welcome channel (this is handled by Discord permissions/roles)
        const welcomeChannel = member.guild.channels.cache.find(ch => ch.name === 'welcome');
        if (!welcomeChannel) {
            console.error('Welcome channel not found');
            await sendDebugMessage('❌ Welcome channel not found');
            return;
        }

        // Send greeting message
        await welcomeChannel.send(`Welcome to Fight Night, ${member}! 🎮`);
        await sendDebugMessage('Sent greeting message to #welcome channel');
        
        // Check if user exists in Google Sheets (Column A - Discord username)
        await sendDebugMessage(`Checking Google Sheets for existing user: ${member.user.username}`);
        const existingPlayer = await googleSheetsService.findPlayerByUsername(member.user.username);
        
        if (existingPlayer) {
            // User exists, auto-verify and show their parameters
            await sendDebugMessage(`✅ Found existing player in Google Sheets: ${existingPlayer.riotId}`);
            await member.roles.set([]);
            const verifiedRole = member.guild.roles.cache.find(role => role.name === 'Verified');
            if (verifiedRole) {
                await member.roles.add(verifiedRole);
                await sendDebugMessage(`Assigned Verified role to ${member.user.username}`);
                
                // Send welcome message with player parameters
                let welcomeMessage = `Welcome back, ${member}! ✅\n\n`;
                welcomeMessage += `**Your Fight Night Profile:**\n`;
                welcomeMessage += `• **Display Name:** ${member.displayName}\n`;
                welcomeMessage += `• **Riot ID:** ${existingPlayer.riotId}\n`;
                welcomeMessage += `• **MMR:** ${existingPlayer.mmr}\n`;
                welcomeMessage += `• **Primary Role:** ${existingPlayer.primaryRole}\n`;
                welcomeMessage += `• **Secondary Role:** ${existingPlayer.secondaryRole}\n\n`;
                welcomeMessage += `You have been automatically verified and can participate in Fight Night!`;
                
                await welcomeChannel.send(welcomeMessage);
                await sendDebugMessage(`Auto-verified existing player with profile display`);
                console.log(`Auto-verified existing player: ${member.user.username}`);
            }
        } else {
            // New user, assign Unverified role and start verification process
            await sendDebugMessage(`❌ User not found in Google Sheets, starting verification process`);
            const unverifiedRole = member.guild.roles.cache.find(role => role.name === 'Unverified');
            if (unverifiedRole) {
                await member.roles.add(unverifiedRole);
                await sendDebugMessage(`Assigned Unverified role to ${member.user.username}`);
            }
            
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`verify_yes_${member.id}`)
                        .setLabel('Yes')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`verify_no_${member.id}`)
                        .setLabel('No')
                        .setStyle(ButtonStyle.Danger)
                );
            
            await welcomeChannel.send({
                content: `${member}, have you played in Fight Night before?`,
                components: [row]
            });
            await sendDebugMessage(`Posted verification question with Yes/No buttons`);
            
            // Set up verification session
            client.verificationSessions.set(member.id, {
                step: 'initial',
                userId: member.id,
                startTime: Date.now()
            });
        }
    } catch (error) {
        console.error('Error in new member verification:', error);
        // Send debug message about error
        const debugChannel = member.guild.channels.cache.find(ch => ch.name === 'list-status-and-debug');
        if (debugChannel) {
            try {
                await debugChannel.send(`🔧 **New Member Verification**: ❌ Error occurred: ${error.message}`);
            } catch (debugError) {
                console.error('Error sending debug error message:', debugError);
            }
        }
        // Fallback: assign Unverified role
        const unverifiedRole = member.guild.roles.cache.find(role => role.name === 'Unverified');
        if (unverifiedRole) {
            await member.roles.add(unverifiedRole);
        }
    }
}

// Interaction handler
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    } else if (interaction.isButton()) {
        // Handle verification buttons
        if (interaction.customId.startsWith('verify_')) {
            try {
                const verifyUsersCommand = require('./commands/verify-users');
                await verifyUsersCommand.handleVerificationButton(interaction);
            } catch (error) {
                console.error('Error handling verification button:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred during verification.',
                        ephemeral: true
                    });
                }
            }
        }
    } else if (interaction.isStringSelectMenu()) {
        // Handle dropdown selections
        if (interaction.customId.startsWith('role_select_')) {
            try {
                const verifyUsersCommand = require('./commands/verify-users');
                await verifyUsersCommand.handleRoleSelection(interaction);
            } catch (error) {
                console.error('Error handling role selection:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred during role selection.',
                        ephemeral: true
                    });
                }
            }
        } else if (interaction.customId.startsWith('primary_role_select_')) {
            try {
                const verifyUsersCommand = require('./commands/verify-users');
                await verifyUsersCommand.handleRoleSelection(interaction);
            } catch (error) {
                console.error('Error handling primary role selection:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred during primary role selection.',
                        ephemeral: true
                    });
                }
            }
        } else if (interaction.customId.startsWith('secondary_role_select_')) {
            try {
                const verifyUsersCommand = require('./commands/verify-users');
                await verifyUsersCommand.handleSecondaryRoleSelection(interaction);
            } catch (error) {
                console.error('Error handling secondary role selection:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred during secondary role selection.',
                        ephemeral: true
                    });
                }
            }
        } else if (interaction.customId.startsWith('rank_select_')) {
            try {
                const verifyUsersCommand = require('./commands/verify-users');
                await verifyUsersCommand.handleRankSelection(interaction);
            } catch (error) {
                console.error('Error handling rank selection:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred during rank selection.',
                        ephemeral: true
                    });
                }
            }
        }
    } else if (interaction.isModalSubmit()) {
        // Handle modal submissions
        if (interaction.customId.startsWith('riot_id_new_')) {
            try {
                const verifyUsersCommand = require('./commands/verify-users');
                await verifyUsersCommand.handleNewPlayerRiotId(interaction);
            } catch (error) {
                console.error('Error handling new player Riot ID submission:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred during registration.',
                        ephemeral: true
                    });
                }
            }
        } else if (interaction.customId.startsWith('riot_id_')) {
            try {
                const verifyUsersCommand = require('./commands/verify-users');
                await verifyUsersCommand.handleRiotIdSubmission(interaction);
            } catch (error) {
                console.error('Error handling Riot ID submission:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred during verification.',
                        ephemeral: true
                    });
                }
            }
        } else if (interaction.customId.startsWith('new_player_')) {
            try {
                const verifyUsersCommand = require('./commands/verify-users');
                await verifyUsersCommand.handleNewPlayerRegistration(interaction);
            } catch (error) {
                console.error('Error handling new player registration:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred during registration.',
                        ephemeral: true
                    });
                }
            }
        }
    }
});

// Message handler for verification process
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    
    const session = client.verificationSessions.get(message.author.id);
    if (!session || message.channel.name !== 'welcome') return;
    
    // Find debug channel for status messages
    const debugChannel = message.guild.channels.cache.find(ch => ch.name === 'list-status-and-debug');
    const sendDebugMessage = async (debugMsg) => {
        if (debugChannel) {
            try {
                await debugChannel.send(`🔧 **New Member Verification**: ${debugMsg}`);
            } catch (error) {
                console.error('Error sending debug message:', error);
            }
        }
    };
    
    try {
        if (session.step === 'riot_id') {
            const riotId = message.content.trim();
            await sendDebugMessage(`${message.author.username} provided Riot ID: ${riotId}`);
            
            const existingPlayer = await googleSheetsService.findPlayerByRiotId(riotId);
            
            if (existingPlayer) {
                await sendDebugMessage(`✅ Found existing player with Riot ID: ${riotId}`);
                // Update Discord username and verify
                await googleSheetsService.updatePlayerDiscordUsername(riotId, message.author.username);
                const member = message.guild.members.cache.get(message.author.id);
                const verifiedRole = message.guild.roles.cache.find(role => role.name === 'Verified');
                const unverifiedRole = message.guild.roles.cache.find(role => role.name === 'Unverified');
                
                if (unverifiedRole) await member.roles.remove(unverifiedRole);
                if (verifiedRole) await member.roles.add(verifiedRole);
                
                await sendDebugMessage(`Updated Discord username and assigned Verified role to ${message.author.username}`);
                await message.reply('✅ Riot ID found! You have been verified.');
                client.verificationSessions.delete(message.author.id);
            } else {
                await sendDebugMessage(`❌ Riot ID not found: ${riotId} - proceeding as new player`);
                await message.reply('❌ Riot ID not found. Please provide your real name to register as a new player:');
                session.step = 'real_name';
                client.verificationSessions.set(message.author.id, session);
            }
        } else if (session.step === 'real_name') {
            session.realName = message.content.trim();
            await sendDebugMessage(`${message.author.username} provided real name: ${session.realName}`);
            await message.reply('Please provide your Riot ID:');
            session.step = 'new_riot_id';
            client.verificationSessions.set(message.author.id, session);
        } else if (session.step === 'new_riot_id') {
            session.riotId = message.content.trim();
            await sendDebugMessage(`${message.author.username} provided new Riot ID: ${session.riotId}`);
            
            const roleRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId(`role_Top_${message.author.id}`).setLabel('Top').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`role_Jungle_${message.author.id}`).setLabel('Jungle').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`role_Mid_${message.author.id}`).setLabel('Mid').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`role_AD_${message.author.id}`).setLabel('AD').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`role_Support_${message.author.id}`).setLabel('Support').setStyle(ButtonStyle.Primary)
                );
            
            await message.reply({
                content: 'Please select your primary role:',
                components: [roleRow]
            });
            
            await sendDebugMessage(`Presented role selection buttons to ${message.author.username}`);
            session.step = 'role_selection';
            client.verificationSessions.set(message.author.id, session);
        }
    } catch (error) {
        console.error('Error in message handler:', error);
        await sendDebugMessage(`❌ Error in message handler for ${message.author.username}: ${error.message}`);
        await message.reply('❌ An error occurred. Please contact a moderator.');
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    
    try {
        // Shutdown message removed per user request
    } catch (error) {
        console.error('Error sending shutdown message:', error);
    }
    
    client.destroy();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
