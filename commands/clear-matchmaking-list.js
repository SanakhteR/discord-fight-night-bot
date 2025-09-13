const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear-matchmaking-list')
        .setDescription('Clear the Active Players List'),
    
    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can clear the matchmaking list.',
                ephemeral: true
            });
        }
        
        try {
            // Store removed players for debug message
            const removedPlayers = [...interaction.client.activePlayersList];
            
            // Clear the Active Players List
            interaction.client.activePlayersList = [];
            
            // Send confirmation
            await interaction.reply({
                content: `✅ **Active Players List Cleared**\n\nRemoved ${removedPlayers.length} players from the list. The Active Players List is now empty.`,
                ephemeral: false
            });
            
            // Send debug message with removed players
            const debugChannel = interaction.guild.channels.cache.find(ch => ch.name === 'list-status-and-debug');
            if (debugChannel) {
                let debugMessage = `🔧 **Active Players List Cleared**\n\n`;
                
                if (removedPlayers.length === 0) {
                    debugMessage += `**Previous Status:** List was already empty\n`;
                } else {
                    debugMessage += `**Removed ${removedPlayers.length} players:**\n`;
                    for (let i = 0; i < removedPlayers.length; i++) {
                        const player = removedPlayers[i];
                        const joinTime = new Date(player.joinTime).toLocaleTimeString();
                        debugMessage += `${i + 1}. ${player.displayName} (@${player.username}) - Joined: ${joinTime}\n`;
                    }
                }
                
                debugMessage += `\n**Current Status:** Active Players List is now EMPTY`;
                
                await debugChannel.send(debugMessage);
            }
            
        } catch (error) {
            console.error('Error in clear-matchmaking-list command:', error);
            await interaction.reply({
                content: '❌ An error occurred while clearing the matchmaking list.',
                ephemeral: true
            });
        }
    }
};
