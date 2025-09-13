const { SlashCommandBuilder } = require('discord.js');
const { GoogleSheetsService } = require('../services/googleSheets');

const googleSheetsService = new GoogleSheetsService();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-user')
        .setDescription('Add a user to the Active Players List')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Discord username to add')
                .setRequired(true)),
    
    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can add users.',
                ephemeral: true
            });
        }
        
        const username = interaction.options.getString('username');
        
        try {
            // Check if user exists in Google Sheets
            const playerData = await googleSheetsService.findPlayerByUsername(username);
            
            if (!playerData) {
                return await interaction.reply({
                    content: `❌ User "${username}" could not be found in the Google Sheet.`,
                    ephemeral: true
                });
            }
            
            // Check if user is already in Active Players List
            const existingPlayer = interaction.client.activePlayersList.find(p => 
                p.username.toLowerCase() === username.toLowerCase()
            );
            
            if (existingPlayer) {
                return await interaction.reply({
                    content: `❌ User "${username}" is already in the Active Players List.`,
                    ephemeral: true
                });
            }
            
            // Find the Discord member to get display name
            const guild = interaction.guild;
            const member = guild.members.cache.find(m => 
                m.user.username.toLowerCase() === username.toLowerCase()
            );
            
            const displayName = member ? member.displayName : username;
            
            // Add user to Active Players List
            const newPlayer = {
                userId: member ? member.id : `manual_${Date.now()}`,
                username: username,
                displayName: displayName,
                joinTime: Date.now()
            };
            
            interaction.client.activePlayersList.push(newPlayer);
            
            // Send confirmation with player parameters
            let confirmMessage = `✅ **User Added Successfully**\n\n`;
            confirmMessage += `**Player:** ${displayName} (@${username})\n`;
            confirmMessage += `**Riot ID:** ${playerData.riotId}\n`;
            confirmMessage += `**MMR:** ${playerData.mmr}\n`;
            confirmMessage += `**Primary Role:** ${playerData.primaryRole}\n`;
            confirmMessage += `**Secondary Role:** ${playerData.secondaryRole}\n`;
            confirmMessage += `**Added to Active Players List at:** ${new Date().toLocaleTimeString()}`;
            
            await interaction.reply({
                content: confirmMessage,
                ephemeral: false
            });
            
            // Send debug message with full list
            const debugChannel = interaction.guild.channels.cache.find(ch => ch.name === 'list-status-and-debug');
            if (debugChannel) {
                let debugMessage = `🔧 **Active Players List Updated** - User Added\n\n`;
                debugMessage += `**Added:** ${displayName} (@${username}) ⭐\n\n`;
                debugMessage += `**Current Active Players List (${interaction.client.activePlayersList.length} players):**\n`;
                
                for (let i = 0; i < interaction.client.activePlayersList.length; i++) {
                    const player = interaction.client.activePlayersList[i];
                    const joinTime = new Date(player.joinTime).toLocaleTimeString();
                    const isNewlyAdded = player.username === username ? ' ⭐' : '';
                    debugMessage += `${i + 1}. ${player.displayName} (@${player.username}) - ${joinTime}${isNewlyAdded}\n`;
                }
                await debugChannel.send(debugMessage);
            }
            
        } catch (error) {
            console.error('Error in add-user command:', error);
            await interaction.reply({
                content: '❌ An error occurred while adding the user.',
                ephemeral: true
            });
        }
    }
};
