const { SlashCommandBuilder } = require('discord.js');
const { GoogleSheetsService } = require('../services/googleSheets');
const { DebugLogger } = require('../utils/debugLogger');

const googleSheetsService = new GoogleSheetsService();
const debugLogger = new DebugLogger();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list-all-discord-users-in-server')
        .setDescription('List all Discord users in server with roles and Google Sheets data'),
    
    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can list all server users.',
                ephemeral: true
            });
        }
        
        try {
            await interaction.deferReply();
            
            const debug = debugLogger.createLogger(interaction.guild);
            await debug.info(`**List All Users**: Command initiated by ${interaction.user.username}`);
            
            const guild = interaction.guild;
            
            // Fetch all guild members to ensure we have complete data
            await guild.members.fetch();
            
            const allMembers = guild.members.cache.filter(member => !member.user.bot);
            await debug.info(`**List All Users**: Found ${allMembers.size} non-bot members in server`);
            
            if (allMembers.size === 0) {
                return await interaction.editReply({
                    content: '📋 **No Users Found**\n\nNo non-bot users found in this server.'
                });
            }
            
            // Process each member
            const userDetails = [];
            let processedCount = 0;
            
            for (const [memberId, member] of allMembers) {
                try {
                    processedCount++;
                    
                    // Get member roles (excluding @everyone)
                    const roles = member.roles.cache
                        .filter(role => role.name !== '@everyone')
                        .map(role => role.name)
                        .join(', ') || 'No roles';
                    
                    // Try to find user in Google Sheets
                    let sheetData = null;
                    try {
                        sheetData = await googleSheetsService.findPlayerByUsername(member.user.username);
                    } catch (error) {
                        console.error(`Error looking up ${member.user.username} in sheets:`, error);
                    }
                    
                    const userInfo = {
                        displayName: member.displayName,
                        username: member.user.username,
                        roles: roles,
                        riotId: sheetData ? sheetData.riotId : 'Not found in Google Sheet',
                        mmr: sheetData ? sheetData.mmr : 'N/A',
                        inSheet: !!sheetData
                    };
                    
                    userDetails.push(userInfo);
                    
                    // Log progress every 10 users
                    if (processedCount % 10 === 0) {
                        await debug.info(`**List All Users**: Processed ${processedCount}/${allMembers.size} users`);
                    }
                    
                } catch (error) {
                    console.error(`Error processing member ${member.user.username}:`, error);
                    await debug.error(`**List All Users**: Error processing ${member.user.username}: ${error.message}`);
                }
            }
            
            await debug.success(`**List All Users**: Successfully processed all ${userDetails.length} users`);
            
            // Sort users: those in Google Sheets first, then alphabetically
            userDetails.sort((a, b) => {
                if (a.inSheet && !b.inSheet) return -1;
                if (!a.inSheet && b.inSheet) return 1;
                return a.displayName.localeCompare(b.displayName);
            });
            
            // Build response message
            let message = `📋 **All Discord Users in Server** (${userDetails.length} users)\n\n`;
            
            // Add users in Google Sheets first
            const usersInSheet = userDetails.filter(user => user.inSheet);
            const usersNotInSheet = userDetails.filter(user => !user.inSheet);
            
            if (usersInSheet.length > 0) {
                message += `🟢 **Users in Google Sheet** (${usersInSheet.length}):\n\n`;
                
                for (let i = 0; i < usersInSheet.length; i++) {
                    const user = usersInSheet[i];
                    message += `**${i + 1}. ${user.displayName}** (@${user.username})\n`;
                    message += `   🎭 **Roles:** ${user.roles}\n`;
                    message += `   🎮 **Riot ID:** ${user.riotId}\n`;
                    message += `   📊 **MMR:** ${user.mmr}\n\n`;
                }
            }
            
            if (usersNotInSheet.length > 0) {
                message += `🔴 **Users NOT in Google Sheet** (${usersNotInSheet.length}):\n\n`;
                
                for (let i = 0; i < usersNotInSheet.length; i++) {
                    const user = usersNotInSheet[i];
                    message += `**${i + 1}. ${user.displayName}** (@${user.username})\n`;
                    message += `   🎭 **Roles:** ${user.roles}\n`;
                    message += `   ❌ **Google Sheet:** Could not find them in the Google Sheet\n\n`;
                }
            }
            
            // Handle message length limits
            if (message.length > 2000) {
                // Send first chunk
                const firstChunk = message.substring(0, 1900) + '...\n\n*(Continued in next message)*';
                await interaction.editReply(firstChunk);
                
                // Send remaining chunks
                let remainingMessage = message.substring(1900);
                while (remainingMessage.length > 0) {
                    const chunk = remainingMessage.substring(0, 1900);
                    await interaction.followUp(chunk);
                    remainingMessage = remainingMessage.substring(1900);
                }
            } else {
                await interaction.editReply(message);
            }
            
            await debug.success(`**List All Users**: Command completed successfully`);
            
        } catch (error) {
            console.error('Error in list-all-discord-users-in-server command:', error);
            const debug = debugLogger.createLogger(interaction.guild);
            await debug.error(`**List All Users**: Command failed: ${error.message}`);
            
            await interaction.editReply({
                content: '❌ An error occurred while retrieving the server user list.'
            });
        }
    }
};
