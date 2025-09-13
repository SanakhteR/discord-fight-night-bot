const { SlashCommandBuilder } = require('discord.js');
const { GoogleSheetsService } = require('../services/googleSheets');

const googleSheetsService = new GoogleSheetsService();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove-user')
        .setDescription('Remove a user from the Active Players List')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Discord username to remove')
                .setRequired(true)),
    
    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can remove users.',
                ephemeral: true
            });
        }
        
        const username = interaction.options.getString('username');
        
        try {
            // Find user in Active Players List
            const playerIndex = interaction.client.activePlayersList.findIndex(p => 
                p.username.toLowerCase() === username.toLowerCase()
            );
            
            if (playerIndex === -1) {
                return await interaction.reply({
                    content: `❌ User "${username}" was not on the Active Players List.`,
                    ephemeral: true
                });
            }
            
            // Get player data before removing
            const removedPlayer = interaction.client.activePlayersList[playerIndex];
            
            // Get additional player info from Google Sheets
            const playerData = await googleSheetsService.findPlayerByUsername(username);
            
            // Remove user from Active Players List
            interaction.client.activePlayersList.splice(playerIndex, 1);
            
            // Send confirmation with player parameters
            let confirmMessage = `✅ **User Removed Successfully**\n\n`;
            confirmMessage += `**Player:** ${removedPlayer.displayName} (@${removedPlayer.username})\n`;
            if (playerData) {
                confirmMessage += `**Riot ID:** ${playerData.riotId}\n`;
                confirmMessage += `**MMR:** ${playerData.mmr}\n`;
                confirmMessage += `**Primary Role:** ${playerData.primaryRole}\n`;
                confirmMessage += `**Secondary Role:** ${playerData.secondaryRole}\n`;
            }
            confirmMessage += `**Was in list since:** ${new Date(removedPlayer.joinTime).toLocaleTimeString()}\n`;
            confirmMessage += `**Removed at:** ${new Date().toLocaleTimeString()}`;
            
            await interaction.reply({
                content: confirmMessage,
                ephemeral: false
            });
            
            // Send debug message with updated list
            const debugChannel = interaction.guild.channels.cache.find(ch => ch.name === 'list-status-and-debug');
            if (debugChannel) {
                let debugMessage = `🔧 **Active Players List Updated** - User Removed\n\n`;
                debugMessage += `**Removed:** ${removedPlayer.displayName} (@${removedPlayer.username}) ❌\n\n`;
                
                if (interaction.client.activePlayersList.length === 0) {
                    debugMessage += `**Current Active Players List: EMPTY**`;
                } else {
                    debugMessage += `**Current Active Players List (${interaction.client.activePlayersList.length} players):**\n`;
                    
                    for (let i = 0; i < interaction.client.activePlayersList.length; i++) {
                        const player = interaction.client.activePlayersList[i];
                        const joinTime = new Date(player.joinTime).toLocaleTimeString();
                        debugMessage += `${i + 1}. ${player.displayName} (@${player.username}) - ${joinTime}\n`;
                    }
                }
                
                await debugChannel.send(debugMessage);
            }
            
        } catch (error) {
            console.error('Error in remove-user command:', error);
            await interaction.reply({
                content: '❌ An error occurred while removing the user.',
                ephemeral: true
            });
        }
    }
};
