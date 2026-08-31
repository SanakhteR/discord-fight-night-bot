const { SlashCommandBuilder } = require('discord.js');
const { GoogleSheetsService } = require('../services/googleSheets');
const { DebugLogger } = require('../utils/debugLogger');

const googleSheetsService = new GoogleSheetsService();
const debugLogger = new DebugLogger();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-random-users-to-active-list')
        .setDescription('Add random users from Google Sheets to the Active Players list')
        .addIntegerOption(option =>
            option.setName('count')
                .setDescription('Number of random users to add')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(50)),
    
    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can add random users to the active list.',
                ephemeral: true
            });
        }
        
        try {
            await interaction.deferReply();
            
            const debug = debugLogger.createLogger(interaction.guild);
            const count = interaction.options.getInteger('count');
            
            await debug.info(`**Add Random Users**: Command initiated by ${interaction.user.username} to add ${count} random users`);
            
            // Get all players from Google Sheets
            const allPlayers = await googleSheetsService.getAllPlayers();
            
            if (!allPlayers || allPlayers.length === 0) {
                return await interaction.editReply('❌ No players found in Google Sheets database.');
            }
            
            await debug.info(`**Add Random Users**: Found ${allPlayers.length} total players in Google Sheets`);
            
            // Get current active players list
            const activePlayersList = interaction.client.activePlayersList || [];
            const activeUsernames = new Set(activePlayersList.map(p => p.username));
            
            // Filter out players already in active list
            const availablePlayers = allPlayers.filter(player => 
                player.discordUsername && !activeUsernames.has(player.discordUsername)
            );
            
            if (availablePlayers.length === 0) {
                return await interaction.editReply('❌ No available players to add. All players with Discord usernames are already in the active list.');
            }
            
            await debug.info(`**Add Random Users**: ${availablePlayers.length} players available to add (excluding already active players)`);
            
            // Determine how many players we can actually add
            const playersToAdd = Math.min(count, availablePlayers.length);
            
            // Randomly shuffle and select players
            const shuffled = availablePlayers.sort(() => Math.random() - 0.5);
            const selectedPlayers = shuffled.slice(0, playersToAdd);
            
            // Add selected players to active list
            const guild = interaction.guild;
            let addedCount = 0;
            let failedCount = 0;
            const addedPlayers = [];
            
            for (const player of selectedPlayers) {
                try {
                    // Try to find the Discord member
                    let member = null;
                    try {
                        member = guild.members.cache.find(m => m.user.username === player.discordUsername);
                        if (!member) {
                            // Try to fetch if not in cache
                            await guild.members.fetch();
                            member = guild.members.cache.find(m => m.user.username === player.discordUsername);
                        }
                    } catch (error) {
                        await debug.warn(`**Add Random Users**: Could not find Discord member for ${player.discordUsername}`);
                    }
                    
                    if (member) {
                        // Add to active players list
                        const playerData = {
                            userId: member.id,
                            username: player.discordUsername,
                            displayName: member.displayName,
                            joinTime: Date.now()
                        };
                        
                        activePlayersList.push(playerData);
                        addedPlayers.push({
                            displayName: member.displayName,
                            username: player.discordUsername,
                            riotId: player.riotId || 'Unknown',
                            mmr: player.mmr || 'N/A'
                        });
                        addedCount++;
                        
                        await debug.success(`**Add Random Users**: Added ${member.displayName} (@${player.discordUsername}) to active list`);
                    } else {
                        failedCount++;
                        await debug.warn(`**Add Random Users**: Could not find Discord member for ${player.discordUsername} - skipping`);
                    }
                } catch (error) {
                    failedCount++;
                    await debug.error(`**Add Random Users**: Error adding ${player.discordUsername}: ${error.message}`);
                }
            }
            
            // Update the client's active players list
            interaction.client.activePlayersList = activePlayersList;
            
            // Build response message header
            let responseMessage = `✅ **Random Users Added to Active List**\n\n`;
            responseMessage += `**Successfully added:** ${addedCount} players\n`;
            if (failedCount > 0) {
                responseMessage += `**Failed to add:** ${failedCount} players (Discord members not found)\n`;
            }
            responseMessage += `**Total active players:** ${activePlayersList.length}\n\n`;
            
            // Send the header message
            await interaction.editReply(responseMessage);
            
            // Send added players in chunks to avoid 2000 character limit
            if (addedPlayers.length > 0) {
                let playerListMessage = `**Added Players:**\n`;
                let currentChunk = playerListMessage;
                
                for (let i = 0; i < addedPlayers.length; i++) {
                    const player = addedPlayers[i];
                    const playerLine = `• ${player.displayName} (@${player.username}) - ${player.riotId} (MMR: ${player.mmr})\n`;
                    
                    // Check if adding this line would exceed the limit
                    if (currentChunk.length + playerLine.length > 1900) {
                        // Send current chunk and start a new one
                        await interaction.followUp(currentChunk);
                        currentChunk = playerLine;
                    } else {
                        currentChunk += playerLine;
                    }
                }
                
                // Send remaining chunk if any
                if (currentChunk.length > 0) {
                    await interaction.followUp(currentChunk);
                }
            }
            
            await debug.success(`**Add Random Users**: Command completed - Added ${addedCount} players, ${failedCount} failed`);
            
        } catch (error) {
            console.error('Error in add-random-users-to-active-list command:', error);
            const debug = debugLogger.createLogger(interaction.guild);
            await debug.error(`**Add Random Users**: Error occurred: ${error.message}`);
            await interaction.editReply('❌ An error occurred while adding random users to the active list.');
        }
    }
};
