const { SlashCommandBuilder } = require('discord.js');
const { GoogleSheetsService } = require('../services/googleSheets');
const { DebugLogger } = require('../utils/debugLogger');

const googleSheetsService = new GoogleSheetsService();
const debugLogger = new DebugLogger();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register-user')
        .setDescription('Manually register a new user to Fight Night')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Discord username to verify')
                .setRequired(true)),
    
    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can trigger user verification.',
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
        
        const username = interaction.options.getString('username');
        
        // Use centralized debug logger
        const debug = debugLogger.createLogger(interaction.guild);
        
        try {
            await interaction.deferReply();
            await debug.info(`**Manual User Verification**: Manual verification initiated for username: ${username}`);
            
            // Check if user exists in Google Sheets
            const existingPlayer = await googleSheetsService.findPlayerByUsername(username);
            
            if (existingPlayer) {
                await debug.success(`**Manual User Verification**: User ${username} already exists in Google Sheets`);
                
                // Find the Discord member to assign Verified role
                const guild = interaction.guild;
                let member = guild.members.cache.find(m => 
                    m.user.username.toLowerCase() === username.toLowerCase()
                );
                
                // If not found in cache, try fetching from Discord API
                if (!member) {
                    try {
                        await guild.members.fetch();
                        member = guild.members.cache.find(m => 
                            m.user.username.toLowerCase() === username.toLowerCase()
                        );
                    } catch (error) {
                        console.error('Error fetching guild members:', error);
                        await debug.error(`**Manual New User Verification**: Error fetching guild members: ${error.message}`);
                    }
                }
                
                let responseMessage = `✅ **User Already Exists**\n\n`;
                responseMessage += `**Discord Username:** ${username}\n`;
                responseMessage += `**Display Name:** ${existingPlayer.username}\n`;
                responseMessage += `**Riot ID:** ${existingPlayer.riotId}\n`;
                responseMessage += `**MMR:** ${existingPlayer.mmr}\n`;
                responseMessage += `**Primary Role:** ${existingPlayer.primaryRole}\n`;
                responseMessage += `**Secondary Role:** ${existingPlayer.secondaryRole}\n\n`;
                responseMessage += `This user is already registered in the Google Sheet.`;
                
                // Debug: Log member search details
                await debug.info(`**Manual User Verification**: 🔍 Searching for Discord member with username: ${username}`);
                
                // Assign Verified role if member found
                if (member) {
                    await debug.success(`**Manual User Verification**: Found Discord member: ${member.displayName} (@${member.user.username}) - ID: ${member.id}`);
                    
                    const verifiedRole = guild.roles.cache.find(role => role.name === 'Verified');
                    const unverifiedRole = guild.roles.cache.find(role => role.name === 'Unverified');
                    
                    if (verifiedRole) {
                        try {
                            await member.roles.add(verifiedRole);
                            await debug.success(`**Manual User Verification**: Assigned Verified role to ${member.user.username}`);
                            
                            // Remove Unverified role if present
                            if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
                                await member.roles.remove(unverifiedRole);
                                await debug.success(`**Manual User Verification**: Removed Unverified role from ${member.user.username}`);
                            }
                            
                            responseMessage += `\n\n🎉 **Verified role has been assigned to ${member.displayName}!**`;
                        } catch (error) {
                            console.error('Error assigning Verified role:', error);
                            await debug.error(`**Manual User Verification**: Failed to assign Verified role to ${member.user.username}: ${error.message}`);
                            responseMessage += `\n\n⚠️ **Note:** Could not assign Verified role (permission error).`;
                        }
                    } else {
                        await debug.error(`**Manual User Verification**: Verified role not found in server`);
                        responseMessage += `\n\n⚠️ **Note:** Verified role not found in server.`;
                    }
                } else {
                    // Enhanced debugging for member not found
                    const allMembers = guild.members.cache.map(m => `${m.displayName} (@${m.user.username})`).join(', ');
                    await debug.error(`**Manual User Verification**: Discord member ${username} not found in server. Available members: ${allMembers.substring(0, 500)}...`);
                    responseMessage += `\n\n⚠️ **Note:** Discord user "${username}" not found in server for role assignment.`;
                }
                
                return await interaction.editReply({
                    content: responseMessage
                });
            }
            
            // User not found, start verification process
            await debug.error(`**Manual User Verification**: User ${username} not found in Google Sheets, starting verification process`);
            
            // Find the Discord member
            const guild = interaction.guild;
            let member = guild.members.cache.find(m => 
                m.user.username.toLowerCase() === username.toLowerCase()
            );
            
            // If not found in cache, try fetching from Discord API
            if (!member) {
                try {
                    await guild.members.fetch();
                    member = guild.members.cache.find(m => 
                        m.user.username.toLowerCase() === username.toLowerCase()
                    );
                } catch (error) {
                    console.error('Error fetching guild members:', error);
                    await debug.error(`**Manual User Verification**: Error fetching guild members: ${error.message}`);
                }
            }
            
            if (!member) {
                await debug.error(`**Manual User Verification**: Discord member ${username} not found in server`);
                return await interaction.editReply({
                    content: `❌ Discord user "${username}" not found in this server.`
                });
            }
            
            await debug.success(`**Manual User Verification**: Found Discord member: ${member.displayName} (@${member.user.username})`);
            
            // Find welcome channel
            const welcomeChannel = guild.channels.cache.find(ch => ch.name === 'welcome');
            if (!welcomeChannel) {
                await debug.error('**Manual User Verification**: Welcome channel not found');
                return await interaction.editReply({
                    content: '❌ Welcome channel not found. Cannot start verification process.'
                });
            }
            
            // Assign Unverified role and remove Verified role if present
            const unverifiedRole = guild.roles.cache.find(role => role.name === 'Unverified');
            const verifiedRole = guild.roles.cache.find(role => role.name === 'Verified');
            
            if (unverifiedRole) {
                await member.roles.add(unverifiedRole);
                await debug.success(`**Manual User Verification**: Assigned Unverified role to ${member.user.username}`);
                
                // Remove Verified role if present
                if (verifiedRole && member.roles.cache.has(verifiedRole.id)) {
                    await member.roles.remove(verifiedRole);
                    await debug.success(`**Manual User Verification**: Removed Verified role from ${member.user.username}`);
                }
            }
            
            // Send verification message to welcome channel
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            
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
                content: `${member}, have you played in Fight Night before? (Manual verification initiated by moderator)`,
                components: [row]
            });
            
            await debug.success(`**Manual User Verification**: Posted verification question with Yes/No buttons in #welcome`);
            
            // Set up verification session
            if (!interaction.client.verificationSessions) {
                interaction.client.verificationSessions = new Map();
            }
            interaction.client.verificationSessions.set(member.id, {
                step: 'initial',
                userId: member.id,
                startTime: Date.now()
            });
            
            await debug.success(`**Manual User Verification**: Created verification session for ${member.user.username}`);
            
            await interaction.editReply({
                content: `✅ **Manual Verification Started**\n\nVerification process initiated for ${member.displayName} (@${username}) in the #welcome channel.`
            });
            
        } catch (error) {
            console.error('Error in register-user command:', error);
            await debug.error(`**Manual User Verification**: Error occurred: ${error.message}`);
            
            // Check if interaction has already been replied to or deferred
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({
                    content: '❌ An error occurred while starting the verification process.'
                });
            } else if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while starting the verification process.',
                    ephemeral: true
                });
            }
        }
    }
};
