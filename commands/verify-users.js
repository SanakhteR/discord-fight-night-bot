const { SlashCommandBuilder } = require('discord.js');
const { GoogleSheetsService } = require('../services/googleSheets');
const { DebugLogger } = require('../utils/debugLogger');

const googleSheetsService = new GoogleSheetsService();
const debugLogger = new DebugLogger();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify-users')
        .setDescription('Run verification process for all users in the server'),
    
    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can run bulk user verification.',
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
        
        try {
            await interaction.deferReply();
            
            const debug = debugLogger.createLogger(interaction.guild);
            await debug.info(`**Bulk User Verification**: Command initiated by ${interaction.user.username}`);
            
            const guild = interaction.guild;
            
            // Fetch all guild members to ensure we have complete data
            await guild.members.fetch();
            
            // Find ALL users (excluding bots)
            const usersToVerify = guild.members.cache.filter(member => {
                return !member.user.bot;
            });
            
            await debug.info(`**Bulk User Verification**: Found ${usersToVerify.size} users to verify (excluding bots)`);
            
            if (usersToVerify.size === 0) {
                return await interaction.editReply({
                    content: '✅ **No Users to Verify**\n\nNo users found in the server (excluding bots).'
                });
            }
            
            let responseMessage = `🔄 **Bulk User Verification Started**\n\n`;
            responseMessage += `**Found ${usersToVerify.size} users to verify** (excluding bots)\n`;
            responseMessage += `Processing verification for each user...\n\n`;
            
            await interaction.editReply(responseMessage);
            
            let processedCount = 0;
            let verifiedCount = 0;
            let unverifiedCount = 0;
            let errorCount = 0;
            
            // Process each user to verify
            for (const [memberId, member] of usersToVerify) {
                try {
                    processedCount++;
                    const username = member.user.username;
                    
                    await debug.info(`**Bulk User Verification**: Processing ${processedCount}/${usersToVerify.size}: ${username}`);
                    
                    // Check if user exists in Google Sheets
                    const existingPlayer = await googleSheetsService.findPlayerByUsername(username);
                    
                    if (existingPlayer) {
                        // User exists in Google Sheets - assign Verified role and remove Unverified
                        const verifiedRole = guild.roles.cache.find(role => role.name === 'Verified');
                        const unverifiedRole = guild.roles.cache.find(role => role.name === 'Unverified');
                        
                        if (verifiedRole) {
                            try {
                                await member.roles.add(verifiedRole);
                                await debug.success(`**Bulk User Verification**: Assigned Verified role to ${username}`);
                                
                                // Remove Unverified role if present
                                if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
                                    await member.roles.remove(unverifiedRole);
                                    await debug.success(`**Bulk User Verification**: Removed Unverified role from ${username}`);
                                }
                                
                                verifiedCount++;
                            } catch (error) {
                                console.error(`Error assigning Verified role to ${username}:`, error);
                                await debug.error(`**Bulk User Verification**: Failed to assign Verified role to ${username}: ${error.message}`);
                                errorCount++;
                            }
                        } else {
                            await debug.error(`**Bulk User Verification**: Verified role not found in server`);
                            errorCount++;
                        }
                    } else {
                        // User not found in Google Sheets - assign Unverified role and remove Verified
                        await debug.info(`**Bulk User Verification**: ${username} not found in Google Sheets, assigning Unverified role`);
                        
                        // Assign Unverified role
                        const unverifiedRole = guild.roles.cache.find(role => role.name === 'Unverified');
                        const verifiedRole = guild.roles.cache.find(role => role.name === 'Verified');
                        
                        if (unverifiedRole) {
                            try {
                                await member.roles.add(unverifiedRole);
                                await debug.success(`**Bulk User Verification**: Assigned Unverified role to ${username}`);
                                
                                // Remove Verified role if present
                                if (verifiedRole && member.roles.cache.has(verifiedRole.id)) {
                                    await member.roles.remove(verifiedRole);
                                    await debug.success(`**Bulk User Verification**: Removed Verified role from ${username}`);
                                }
                                
                                unverifiedCount++;
                            } catch (error) {
                                console.error(`Error assigning Unverified role to ${username}:`, error);
                                await debug.error(`**Bulk User Verification**: Failed to assign Unverified role to ${username}: ${error.message}`);
                                errorCount++;
                            }
                        } else {
                            await debug.error(`**Bulk User Verification**: Unverified role not found in server`);
                            errorCount++;
                        }
                    }
                    
                    // Add small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    console.error(`Error processing user ${member.user.username}:`, error);
                    await debug.error(`**Bulk User Verification**: Error processing ${member.user.username}: ${error.message}`);
                    errorCount++;
                }
            }
            
            // Send completion summary
            let summaryMessage = `✅ **Bulk User Verification Complete**\n\n`;
            summaryMessage += `**Summary:**\n`;
            summaryMessage += `• **Total Processed:** ${processedCount} users\n`;
            summaryMessage += `• **Auto-Verified:** ${verifiedCount} users (found in Google Sheets)\n`;
            summaryMessage += `• **Assigned Unverified:** ${unverifiedCount} users (not found in Google Sheets)\n`;
            summaryMessage += `• **Errors:** ${errorCount} users\n\n`;
            
            if (unverifiedCount > 0) {
                summaryMessage += `Users not found in Google Sheets have been assigned the "Unverified" role.\n`;
            }
            if (verifiedCount > 0) {
                summaryMessage += `Users found in Google Sheets have been assigned the "Verified" role.`;
            }
            
            await interaction.followUp(summaryMessage);
            await debug.success(`**Bulk User Verification**: Process completed - ${verifiedCount} auto-verified, ${unverifiedCount} assigned unverified, ${errorCount} errors`);
            
        } catch (error) {
            console.error('Error in verify-users command:', error);
            const debug = debugLogger.createLogger(interaction.guild);
            await debug.error(`**Bulk User Verification**: Command failed: ${error.message}`);
            
            await interaction.editReply({
                content: '❌ An error occurred while running bulk user verification.'
            });
        }
    },

    async handleVerificationButton(interaction) {
        const debug = debugLogger.createLogger(interaction.guild);
        
        try {
            const userId = interaction.customId.split('_')[2];
            const response = interaction.customId.split('_')[1]; // 'yes' or 'no'
            
            // Check if this is the correct user
            if (interaction.user.id !== userId) {
                return await interaction.reply({
                    content: '❌ This verification prompt is not for you.',
                    ephemeral: true
                });
            }
            
            const session = interaction.client.verificationSessions.get(userId);
            if (!session) {
                return await interaction.reply({
                    content: '❌ Verification session not found or expired.',
                    ephemeral: true
                });
            }
            
            if (response === 'yes') {
                // User has played before - ask for Riot ID
                const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                
                const modal = new ModalBuilder()
                    .setCustomId(`riot_id_${userId}`)
                    .setTitle('Enter Your Riot ID');
                
                const riotIdInput = new TextInputBuilder()
                    .setCustomId('riot_id')
                    .setLabel('What is your Riot ID? (e.g., Username#TAG)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('Enter your Riot ID (Username#TAG)');
                
                const firstActionRow = new ActionRowBuilder().addComponents(riotIdInput);
                modal.addComponents(firstActionRow);
                
                await interaction.showModal(modal);
                
                // Update session
                interaction.client.verificationSessions.set(userId, {
                    ...session,
                    step: 'riot_id'
                });
                
                await debug.info(`**Verification**: User ${interaction.user.username} indicated they have played before, showing Riot ID modal`);
                
            } else {
                // User hasn't played before - show rank selection first, then dual role selection
                const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
                
                const rankSelectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`rank_select_${userId}`)
                    .setPlaceholder('Select your estimated rank')
                    .addOptions([
                        {
                            label: 'Iron',
                            description: 'Iron rank',
                            value: 'Iron'
                        },
                        {
                            label: 'Bronze',
                            description: 'Bronze rank',
                            value: 'Bronze'
                        },
                        {
                            label: 'Silver',
                            description: 'Silver rank',
                            value: 'Silver'
                        },
                        {
                            label: 'Gold',
                            description: 'Gold rank',
                            value: 'Gold'
                        },
                        {
                            label: 'Platinum',
                            description: 'Platinum rank',
                            value: 'Platinum'
                        },
                        {
                            label: 'Emerald',
                            description: 'Emerald rank',
                            value: 'Emerald'
                        },
                        {
                            label: 'Diamond',
                            description: 'Diamond rank',
                            value: 'Diamond'
                        }
                    ]);
                
                const rankRow = new ActionRowBuilder().addComponents(rankSelectMenu);
                
                await interaction.reply({
                    content: '🎮 **New Player Setup**\n\nFirst, what is your estimated rank?',
                    components: [rankRow],
                    ephemeral: true
                });
                
                // Update session
                interaction.client.verificationSessions.set(userId, {
                    ...session,
                    step: 'rank_selection'
                });
                
                await debug.info(`**Verification**: User ${interaction.user.username} indicated they are new, showing rank selection`);
            }
            
        } catch (error) {
            console.error('Error in handleVerificationButton:', error);
            await debug.error(`**Verification**: Error in button handler: ${error.message}`);
            await interaction.reply({
                content: '❌ An error occurred during verification.',
                ephemeral: true
            });
        }
    },

    async handleRiotIdSubmission(interaction) {
        const debug = debugLogger.createLogger(interaction.guild);
        
        try {
            const userId = interaction.customId.split('_')[2];
            const riotId = interaction.fields.getTextInputValue('riot_id');
            
            await interaction.deferReply({ ephemeral: true });
            
            const session = interaction.client.verificationSessions.get(userId);
            if (!session) {
                return await interaction.editReply({
                    content: '❌ Verification session not found or expired.'
                });
            }
            
            await debug.info(`**Verification**: User ${interaction.user.username} submitted Riot ID: ${riotId}`);
            
            // Search for existing player by Riot ID
            const existingPlayer = await googleSheetsService.findPlayerByRiotId(riotId);
            
            if (existingPlayer) {
                // Player found - update Google Sheets with Discord username
                const updateSuccess = await googleSheetsService.updatePlayerDiscordUsername(riotId, interaction.user.username);
                
                if (updateSuccess) {
                    await debug.success(`**Verification**: Updated Google Sheets - Discord username for Riot ID ${riotId} set to ${interaction.user.username}`);
                } else {
                    await debug.error(`**Verification**: Failed to update Google Sheets with Discord username for ${interaction.user.username}`);
                }
                
                // Assign Verified role and remove Unverified
                const guild = interaction.guild;
                const member = guild.members.cache.get(userId);
                
                if (member) {
                    const verifiedRole = guild.roles.cache.find(role => role.name === 'Verified');
                    const unverifiedRole = guild.roles.cache.find(role => role.name === 'Unverified');
                    
                    if (verifiedRole) {
                        await member.roles.add(verifiedRole);
                        await debug.success(`**Verification**: Assigned Verified role to ${member.user.username}`);
                    }
                    
                    if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
                        await member.roles.remove(unverifiedRole);
                        await debug.success(`**Verification**: Removed Unverified role from ${member.user.username}`);
                    }
                }
                
                await interaction.editReply({
                    content: `✅ **Verification Complete!**\n\nWelcome back, ${existingPlayer.username}!\nYou have been verified and assigned the Verified role.\n\n*Your Discord username has been updated in our records.*`
                });
                
                await debug.success(`**Verification**: Successfully verified returning player ${interaction.user.username} with Riot ID ${riotId} and updated Google Sheets`);
                
            } else {
                // Riot ID not found - start new player flow
                await debug.error(`**Verification**: Riot ID ${riotId} not found for user ${interaction.user.username}, starting new player registration`);
                
                // Show rank selection for new player
                const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
                
                const rankSelectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`rank_select_${userId}`)
                    .setPlaceholder('Select your estimated rank')
                    .addOptions([
                        {
                            label: 'Iron',
                            description: 'Iron rank',
                            value: 'Iron'
                        },
                        {
                            label: 'Bronze',
                            description: 'Bronze rank',
                            value: 'Bronze'
                        },
                        {
                            label: 'Silver',
                            description: 'Silver rank',
                            value: 'Silver'
                        },
                        {
                            label: 'Gold',
                            description: 'Gold rank',
                            value: 'Gold'
                        },
                        {
                            label: 'Platinum',
                            description: 'Platinum rank',
                            value: 'Platinum'
                        },
                        {
                            label: 'Emerald',
                            description: 'Emerald rank',
                            value: 'Emerald'
                        },
                        {
                            label: 'Diamond',
                            description: 'Diamond rank',
                            value: 'Diamond'
                        }
                    ]);
                
                const rankRow = new ActionRowBuilder().addComponents(rankSelectMenu);
                
                await interaction.editReply({
                    content: `❌ **Riot ID Not Found**\n\nThe Riot ID "${riotId}" was not found in our records. Let's register you as a new player!\n\n🎮 **New Player Setup**\n\nFirst, what is your estimated rank?`,
                    components: [rankRow]
                });
                
                // Update session to new player flow
                interaction.client.verificationSessions.set(userId, {
                    ...session,
                    step: 'rank_selection'
                });
                
                await debug.info(`**Verification**: Started new player registration for ${interaction.user.username} after Riot ID not found`);
            }
            
            // Clean up session only if verification was successful (existingPlayer found)
            if (existingPlayer) {
                interaction.client.verificationSessions.delete(userId);
            }
            
        } catch (error) {
            console.error('Error in handleRiotIdSubmission:', error);
            await debug.error(`**Verification**: Error in Riot ID submission: ${error.message}`);
            await interaction.editReply({
                content: '❌ An error occurred during verification.'
            });
        }
    },

    async handleNewPlayerRegistration(interaction) {
        const debug = debugLogger.createLogger(interaction.guild);
        
        try {
            const userId = interaction.customId.split('_')[2];
            const riotId = interaction.fields.getTextInputValue('riot_id');
            const primaryRole = interaction.fields.getTextInputValue('primary_role');
            const secondaryRole = interaction.fields.getTextInputValue('secondary_role');
            
            await interaction.deferReply({ ephemeral: true });
            
            const session = interaction.client.verificationSessions.get(userId);
            if (!session) {
                return await interaction.editReply({
                    content: '❌ Verification session not found or expired.'
                });
            }
            
            await debug.info(`**Verification**: New player registration for ${interaction.user.username} - Riot ID: ${riotId}, Primary: ${primaryRole}, Secondary: ${secondaryRole}`);
            
            // Validate roles
            const validRoles = ['Top', 'Jungle', 'Mid', 'AD', 'Support'];
            const normalizedPrimary = primaryRole.charAt(0).toUpperCase() + primaryRole.slice(1).toLowerCase();
            const normalizedSecondary = secondaryRole.charAt(0).toUpperCase() + secondaryRole.slice(1).toLowerCase();
            
            if (!validRoles.includes(normalizedPrimary) || !validRoles.includes(normalizedSecondary)) {
                return await interaction.editReply({
                    content: `❌ **Invalid Roles**\n\nPlease use valid roles: ${validRoles.join(', ')}`
                });
            }
            
            // Check if Riot ID already exists
            const existingPlayer = await googleSheetsService.findPlayerByRiotId(riotId);
            if (existingPlayer) {
                return await interaction.editReply({
                    content: `❌ **Riot ID Already Registered**\n\nThe Riot ID "${riotId}" is already registered to ${existingPlayer.username}. If this is your account, please contact a moderator.`
                });
            }
            
            // Add new player to Google Sheets with default MMR
            const newPlayerData = {
                username: interaction.user.username,  // Column A - Discord Username
                realName: 'N/A',                     // Column B - Real Name
                riotId: riotId,                      // Column C - Riot ID
                estimatedElo: 'Silver',              // Column D - Elo
                mmr: 300,                            // Column E - MMR (Default Silver)
                primaryRole: normalizedPrimary,      // Column F - Primary Role
                secondaryRole: normalizedSecondary   // Column G - Secondary Role
            };
            
            await googleSheetsService.addNewPlayer(newPlayerData);
            
            // Assign Verified role and remove Unverified
            const guild = interaction.guild;
            const member = guild.members.cache.get(userId);
            
            if (member) {
                const verifiedRole = guild.roles.cache.find(role => role.name === 'Verified');
                const unverifiedRole = guild.roles.cache.find(role => role.name === 'Unverified');
                
                if (verifiedRole) {
                    await member.roles.add(verifiedRole);
                    await debug.success(`**Verification**: Assigned Verified role to ${member.user.username}`);
                }
                
                if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
                    await member.roles.remove(unverifiedRole);
                    await debug.success(`**Verification**: Removed Unverified role from ${member.user.username}`);
                }
            }
            
            await interaction.editReply({
                content: `✅ **Registration Complete!**\n\nWelcome to Fight Night, ${interaction.user.username}!\n\n**Your Details:**\n• **Riot ID:** ${riotId}\n• **Primary Role:** ${normalizedPrimary}\n• **Secondary Role:** ${normalizedSecondary}\n• **Starting MMR:** 300 (Silver)\n\nYou have been verified and assigned the Verified role.`
            });
            
            await debug.success(`**Verification**: Successfully registered new player ${interaction.user.username} with Riot ID ${riotId}`);
            
            // Clean up session
            interaction.client.verificationSessions.delete(userId);
            
        } catch (error) {
            console.error('Error in handleNewPlayerRegistration:', error);
            await debug.error(`**Verification**: Error in new player registration: ${error.message}`);
            await interaction.editReply({
                content: '❌ An error occurred during registration.'
            });
        }
    },

    async handleRoleSelection(interaction) {
        const debug = debugLogger.createLogger(interaction.guild);
        
        try {
            const userId = interaction.customId.split('_')[3];
            const selectedRole = interaction.values[0];
            
            // Check if this is the correct user
            if (interaction.user.id !== userId) {
                return await interaction.reply({
                    content: '❌ This selection is not for you.',
                    ephemeral: true
                });
            }
            
            const session = interaction.client.verificationSessions.get(userId);
            if (!session) {
                return await interaction.reply({
                    content: '❌ Verification session not found or expired.',
                    ephemeral: true
                });
            }
            
            // Update session with selected primary role and wait for secondary role
            interaction.client.verificationSessions.set(userId, {
                ...session,
                step: 'waiting_secondary_role',
                primaryRole: selectedRole
            });
            
            // Remove primary role dropdown, keep only secondary role dropdown
            const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
            
            const secondaryRoleSelectMenu = new StringSelectMenuBuilder()
                .setCustomId(`secondary_role_select_${userId}`)
                .setPlaceholder('Select your secondary role')
                .addOptions([
                    {
                        label: 'Top',
                        description: 'Top lane',
                        value: 'Top'
                    },
                    {
                        label: 'Jungle',
                        description: 'Jungle',
                        value: 'Jungle'
                    },
                    {
                        label: 'Mid',
                        description: 'Mid lane',
                        value: 'Mid'
                    },
                    {
                        label: 'AD',
                        description: 'Bot lane AD',
                        value: 'AD'
                    },
                    {
                        label: 'Support',
                        description: 'Bot lane Support',
                        value: 'Support'
                    },
                    {
                        label: 'Fill',
                        description: 'Any role needed',
                        value: 'Fill'
                    }
                ]);
            
            const secondaryRoleRow = new ActionRowBuilder().addComponents(secondaryRoleSelectMenu);
            
            await interaction.update({
                content: `🎮 **New Player Setup**\n\n✅ Estimated Rank: **${session.estimatedRank}**\n✅ Primary Role: **${selectedRole}**\n\nNow select your secondary role:`,
                components: [secondaryRoleRow]
            });
            
            await debug.info(`**Verification**: User ${interaction.user.username} selected primary role: ${selectedRole}, waiting for secondary role`);
            
        } catch (error) {
            console.error('Error in handleRoleSelection:', error);
            await debug.error(`**Verification**: Error in role selection: ${error.message}`);
            await interaction.reply({
                content: '❌ An error occurred during role selection.',
                ephemeral: true
            });
        }
    },

    async handleRankSelection(interaction) {
        const debug = debugLogger.createLogger(interaction.guild);
        
        try {
            const userId = interaction.customId.split('_')[2];
            const selectedRank = interaction.values[0];
            
            // Check if this is the correct user
            if (interaction.user.id !== userId) {
                return await interaction.reply({
                    content: '❌ This selection is not for you.',
                    ephemeral: true
                });
            }
            
            const session = interaction.client.verificationSessions.get(userId);
            if (!session) {
                return await interaction.reply({
                    content: '❌ Verification session not found or expired.',
                    ephemeral: true
                });
            }
            
            // Show primary role selection first
            const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
            
            const primaryRoleSelectMenu = new StringSelectMenuBuilder()
                .setCustomId(`primary_role_select_${userId}`)
                .setPlaceholder('Select your primary role')
                .addOptions([
                    {
                        label: 'Top',
                        description: 'Top lane',
                        value: 'Top'
                    },
                    {
                        label: 'Jungle',
                        description: 'Jungle',
                        value: 'Jungle'
                    },
                    {
                        label: 'Mid',
                        description: 'Mid lane',
                        value: 'Mid'
                    },
                    {
                        label: 'AD',
                        description: 'Bot lane AD',
                        value: 'AD'
                    },
                    {
                        label: 'Support',
                        description: 'Bot lane Support',
                        value: 'Support'
                    },
                    {
                        label: 'Fill',
                        description: 'Any role needed',
                        value: 'Fill'
                    }
                ]);
            
            const primaryRoleRow = new ActionRowBuilder().addComponents(primaryRoleSelectMenu);
            
            await interaction.update({
                content: `🎮 **New Player Setup**\n\n✅ Estimated Rank: **${selectedRank}**\n\nNow select your primary role:`,
                components: [primaryRoleRow]
            });
            
            // Update session with selected rank
            interaction.client.verificationSessions.set(userId, {
                ...session,
                step: 'primary_role_selection',
                estimatedRank: selectedRank
            });
            
            await debug.info(`**Verification**: User ${interaction.user.username} selected rank: ${selectedRank}, showing dual role selection`);
            
        } catch (error) {
            console.error('Error in handleRankSelection:', error);
            await debug.error(`**Verification**: Error in rank selection: ${error.message}`);
            await interaction.reply({
                content: '❌ An error occurred during rank selection.',
                ephemeral: true
            });
        }
    },

    async handleNewPlayerRiotId(interaction) {
        const debug = debugLogger.createLogger(interaction.guild);
        
        try {
            const userId = interaction.customId.split('_')[3];
            const riotId = interaction.fields.getTextInputValue('riot_id');
            const playerName = interaction.fields.getTextInputValue('player_name');
            
            await interaction.deferReply({ ephemeral: true });
            
            const session = interaction.client.verificationSessions.get(userId);
            if (!session) {
                return await interaction.editReply({
                    content: '❌ Verification session not found or expired.'
                });
            }
            
            await debug.info(`**Verification**: New player ${interaction.user.username} submitted Riot ID: ${riotId} and Name: ${playerName}`);
            
            // Check if Riot ID already exists
            const existingPlayer = await googleSheetsService.findPlayerByRiotId(riotId);
            if (existingPlayer) {
                return await interaction.editReply({
                    content: `❌ **Riot ID Already Registered**\n\nThe Riot ID "${riotId}" is already registered to ${existingPlayer.username}. If this is your account, please contact a moderator.`
                });
            }
            
            // Map rank to MMR
            const rankToMMR = {
                'Iron': 150,
                'Bronze': 250,
                'Silver': 300,
                'Gold': 350,
                'Platinum': 450,
                'Emerald': 600,
                'Diamond': 750
            };
            
            const mmr = rankToMMR[session.estimatedRank] || 300;
            
            // Add new player to Google Sheets
            const newPlayerData = {
                username: interaction.user.username,  // Column A - Discord Username
                realName: playerName,                 // Column B - Real Name
                riotId: riotId,                      // Column C - Riot ID
                estimatedElo: session.estimatedRank, // Column D - Elo
                mmr: mmr,                            // Column E - MMR
                primaryRole: session.primaryRole,    // Column F - Primary Role
                secondaryRole: session.secondaryRole // Column G - Secondary Role
            };
            
            await googleSheetsService.addNewPlayer(newPlayerData);
            
            // Assign Verified role and remove Unverified
            const guild = interaction.guild;
            const member = guild.members.cache.get(userId);
            
            if (member) {
                const verifiedRole = guild.roles.cache.find(role => role.name === 'Verified');
                const unverifiedRole = guild.roles.cache.find(role => role.name === 'Unverified');
                
                if (verifiedRole) {
                    await member.roles.add(verifiedRole);
                    await debug.success(`**Verification**: Assigned Verified role to ${member.user.username}`);
                }
                
                if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
                    await member.roles.remove(unverifiedRole);
                    await debug.success(`**Verification**: Removed Unverified role from ${member.user.username}`);
                }
            }
            
            await interaction.editReply({
                content: `✅ **Registration Complete!**\n\nWelcome to Fight Night, ${interaction.user.username}!\n\n**Your Details:**\n• **Name:** ${playerName}\n• **Riot ID:** ${riotId}\n• **Primary Role:** ${session.primaryRole}\n• **Secondary Role:** ${session.secondaryRole}\n• **Estimated Rank:** ${session.estimatedRank}\n• **MMR:** ${mmr}\n\nYou have been verified and assigned the Verified role.`
            });
            
            await debug.success(`**Verification**: Successfully registered new player ${interaction.user.username} with Riot ID ${riotId}`);
            
            // Clean up session
            interaction.client.verificationSessions.delete(userId);
            
        } catch (error) {
            console.error('Error in handleNewPlayerRiotId:', error);
            await debug.error(`**Verification**: Error in new player Riot ID submission: ${error.message}`);
            await interaction.editReply({
                content: '❌ An error occurred during registration.'
            });
        }
    },

    async handleSecondaryRoleSelection(interaction) {
        const debug = debugLogger.createLogger(interaction.guild);
        
        try {
            const userId = interaction.customId.split('_')[3];
            const selectedSecondaryRole = interaction.values[0];
            
            // Check if this is the correct user
            if (interaction.user.id !== userId) {
                return await interaction.reply({
                    content: '❌ This selection is not for you.',
                    ephemeral: true
                });
            }
            
            const session = interaction.client.verificationSessions.get(userId);
            if (!session) {
                return await interaction.reply({
                    content: '❌ Verification session not found or expired.',
                    ephemeral: true
                });
            }
            
            // Show Riot ID and Name input modal since we now have both roles
            const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
            
            const modal = new ModalBuilder()
                .setCustomId(`riot_id_new_${userId}`)
                .setTitle('Enter Your Details');
            
            const riotIdInput = new TextInputBuilder()
                .setCustomId('riot_id')
                .setLabel('What is your Riot ID? (e.g., Username#TAG)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('Enter your Riot ID (Username#TAG)');
            
            const nameInput = new TextInputBuilder()
                .setCustomId('player_name')
                .setLabel('What is your name?')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('Enter your real name or preferred name');
            
            const firstActionRow = new ActionRowBuilder().addComponents(riotIdInput);
            const secondActionRow = new ActionRowBuilder().addComponents(nameInput);
            modal.addComponents(firstActionRow, secondActionRow);
            
            await interaction.showModal(modal);
            
            // Update session with selected secondary role
            interaction.client.verificationSessions.set(userId, {
                ...session,
                step: 'riot_id_new',
                secondaryRole: selectedSecondaryRole
            });
            
            await debug.info(`**Verification**: User ${interaction.user.username} selected secondary role: ${selectedSecondaryRole}`);
            
        } catch (error) {
            console.error('Error in handleSecondaryRoleSelection:', error);
            await debug.error(`**Verification**: Error in secondary role selection: ${error.message}`);
            await interaction.reply({
                content: '❌ An error occurred during secondary role selection.',
                ephemeral: true
            });
        }
    }
};
