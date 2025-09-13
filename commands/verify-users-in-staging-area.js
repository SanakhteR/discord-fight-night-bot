const { SlashCommandBuilder } = require('discord.js');
const { GoogleSheetsService } = require('../services/googleSheets');
const { DebugLogger } = require('../utils/debugLogger');

const googleSheetsService = new GoogleSheetsService();
const debugLogger = new DebugLogger();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify_users_in_staging_area')
        .setDescription('Run verification process for all users in the Fight Night Staging Area voice channel'),
    
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
            await debug.info(`**Staging Area User Verification**: Command initiated by ${interaction.user.username}`);
            
            const guild = interaction.guild;
            
            // Find the Fight Night Staging Area voice channel
            const stagingChannel = guild.channels.cache.find(ch => ch.name === 'Fight Night Staging Area');
            
            if (!stagingChannel) {
                await debug.error(`**Staging Area User Verification**: Fight Night Staging Area voice channel not found`);
                return await interaction.editReply({
                    content: '❌ **Voice Channel Not Found**\n\nThe "Fight Night Staging Area" voice channel could not be found.'
                });
            }
            
            // Get all users currently in the staging area voice channel
            const usersToVerify = stagingChannel.members.filter(member => {
                return !member.user.bot;
            });
            
            await debug.info(`**Staging Area User Verification**: Found ${usersToVerify.size} users in Fight Night Staging Area (excluding bots)`);
            
            if (usersToVerify.size === 0) {
                return await interaction.editReply({
                    content: '✅ **No Users to Verify**\n\nNo users found in the Fight Night Staging Area voice channel (excluding bots).'
                });
            }
            
            let responseMessage = `🔄 **Staging Area User Verification Started**\n\n`;
            responseMessage += `**Found ${usersToVerify.size} users in Fight Night Staging Area** (excluding bots)\n`;
            responseMessage += `Processing verification for each user...\n\n`;
            
            await interaction.editReply(responseMessage);
            
            let processedCount = 0;
            let verifiedCount = 0;
            let unverifiedCount = 0;
            let errorCount = 0;
            
            // Get roles once to avoid repeated lookups
            const verifiedRole = guild.roles.cache.find(role => role.name === 'Verified');
            const unverifiedRole = guild.roles.cache.find(role => role.name === 'Unverified');
            
            if (!verifiedRole || !unverifiedRole) {
                return await interaction.editReply({
                    content: '❌ **Missing Roles**\n\nVerified or Unverified roles not found in server.'
                });
            }
            
            // Process each user to verify
            for (const [memberId, member] of usersToVerify) {
                try {
                    processedCount++;
                    const username = member.user.username;
                    
                    // Check if user exists in Google Sheets
                    const existingPlayer = await googleSheetsService.findPlayerByUsername(username);
                    
                    if (existingPlayer) {
                        // User exists in Google Sheets - assign Verified role and remove Unverified
                        try {
                            await member.roles.add(verifiedRole);
                            
                            // Remove Unverified role if present
                            if (member.roles.cache.has(unverifiedRole.id)) {
                                await member.roles.remove(unverifiedRole);
                            }
                            
                            verifiedCount++;
                        } catch (error) {
                            console.error(`Error assigning Verified role to ${username}:`, error);
                            errorCount++;
                        }
                    } else {
                        // User not found in Google Sheets - assign Unverified role and remove Verified
                        try {
                            await member.roles.add(unverifiedRole);
                            
                            // Remove Verified role if present
                            if (member.roles.cache.has(verifiedRole.id)) {
                                await member.roles.remove(verifiedRole);
                            }
                            
                            unverifiedCount++;
                        } catch (error) {
                            console.error(`Error assigning Unverified role to ${username}:`, error);
                            errorCount++;
                        }
                    }
                    
                    // Reduced delay to speed up processing
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                } catch (error) {
                    console.error(`Error processing user ${member.user.username}:`, error);
                    errorCount++;
                }
            }
            
            // Send completion summary
            let summaryMessage = `✅ **Staging Area User Verification Complete**\n\n`;
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
            await debug.success(`**Staging Area User Verification**: Process completed - ${verifiedCount} auto-verified, ${unverifiedCount} assigned unverified, ${errorCount} errors`);
            
        } catch (error) {
            console.error('Error in verify-users-in-staging-area command:', error);
            const debug = debugLogger.createLogger(interaction.guild);
            await debug.error(`**Staging Area User Verification**: Command failed: ${error.message}`);
            
            await interaction.editReply({
                content: '❌ An error occurred while running staging area user verification.'
            });
        }
    }
};
