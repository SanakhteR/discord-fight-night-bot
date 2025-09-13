const { SlashCommandBuilder } = require('discord.js');
const { GoogleSheetsService } = require('../services/googleSheets');

const googleSheetsService = new GoogleSheetsService();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list-active-players')
        .setDescription('List current Active Players with detailed information'),
    
    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can view the active players list.',
                ephemeral: true
            });
        }
        
        try {
            await interaction.deferReply();
            
            const activePlayersList = interaction.client.activePlayersList;
            
            if (activePlayersList.length === 0) {
                return await interaction.editReply({
                    content: '📋 **Active Players List is empty**\n\nNo players are currently in the Fight Night Staging Area.'
                });
            }
            
            // Get guild for member lookup
            const guild = interaction.guild;
            
            // Prepare detailed player information
            const playerDetails = [];
            
            for (const player of activePlayersList) {
                try {
                    // Get Discord member for display name
                    const member = guild.members.cache.get(player.userId) || 
                                 await guild.members.fetch(player.userId).catch(() => null);
                    
                    // Get player data from Google Sheets
                    const sheetData = await googleSheetsService.findPlayerByUsername(player.username);
                    
                    const playerInfo = {
                        displayName: member ? member.displayName : player.displayName,
                        username: player.username,
                        joinTime: new Date(player.joinTime).toLocaleTimeString(),
                        riotId: sheetData ? sheetData.riotId : 'Not found',
                        mmr: sheetData ? sheetData.mmr : 'N/A',
                        primaryRole: sheetData ? sheetData.primaryRole : 'N/A',
                        secondaryRole: sheetData ? sheetData.secondaryRole : 'N/A'
                    };
                    
                    playerDetails.push(playerInfo);
                } catch (error) {
                    console.error(`Error getting data for player ${player.username}:`, error);
                    // Add basic info if detailed lookup fails
                    playerDetails.push({
                        displayName: player.displayName,
                        username: player.username,
                        joinTime: new Date(player.joinTime).toLocaleTimeString(),
                        riotId: 'Error loading',
                        mmr: 'N/A',
                        primaryRole: 'N/A',
                        secondaryRole: 'N/A'
                    });
                }
            }
            
            // Build message with detailed information
            let message = `📋 **Active Players List** (${activePlayersList.length} players)\n\n`;
            
            for (let i = 0; i < playerDetails.length; i++) {
                const player = playerDetails[i];
                message += `**${i + 1}. ${player.displayName}** (@${player.username})\n`;
                message += `   🎮 **Riot ID:** ${player.riotId}\n`;
                message += `   📊 **MMR:** ${player.mmr}\n`;
                message += `   🎯 **Primary Role:** ${player.primaryRole}\n`;
                message += `   🔄 **Secondary Role:** ${player.secondaryRole}\n`;
                message += `   ⏰ **Joined at:** ${player.joinTime}\n\n`;
            }
            
            // Check message length and chunk if necessary
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
            
        } catch (error) {
            console.error('Error in list-active-players command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while retrieving the active players list.'
            });
        }
    }
};
