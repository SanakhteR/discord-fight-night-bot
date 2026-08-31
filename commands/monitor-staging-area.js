const { SlashCommandBuilder } = require('discord.js');
const { GoogleSheetsService } = require('../services/googleSheets');

const googleSheetsService = new GoogleSheetsService();

// Store active monitoring sessions
const activeMonitoringSessions = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('monitor-staging-area')
        .setDescription('Monitor staging area users every 5 minutes for 30 minutes'),
    
    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can monitor the staging area.',
                ephemeral: true
            });
        }
        
        // Check if monitoring is already active for this guild
        if (activeMonitoringSessions.has(interaction.guild.id)) {
            return await interaction.reply({
                content: '⚠️ Monitoring is already active for this server. Please wait for it to complete or restart the bot to cancel.',
                ephemeral: true
            });
        }
        
        try {
            await interaction.reply('🔍 **Starting Staging Area Monitoring**\n\nWill post updates every 5 minutes for 30 minutes (6 updates total) in #fightnightmods.');
            
            // Find fightnightmods channel
            const modsChannel = interaction.guild.channels.cache.find(
                channel => channel.name === 'fightnightmods'
            );
            
            if (!modsChannel) {
                return await interaction.followUp('❌ Could not find #fightnightmods channel.');
            }
            
            // Start monitoring session
            await startMonitoring(interaction.client, interaction.guild, modsChannel);
            activeMonitoringSessions.set(interaction.guild.id, true);
            
        } catch (error) {
            console.error('Error in monitor-staging-area command:', error);
            await interaction.followUp('❌ An error occurred while starting monitoring.');
            activeMonitoringSessions.delete(interaction.guild.id);
        }
    }
};

async function startMonitoring(client, guild, modsChannel) {
    const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    const TOTAL_UPDATES = 6; // 30 minutes / 5 minutes
    let updateCount = 0;
    
    // Function to post staging area list
    const postUpdate = async () => {
        updateCount++;
        
        try {
            const activePlayersList = client.activePlayersList || [];
            
            // Build header with timestamp
            const timestamp = new Date().toLocaleTimeString('en-US', {
                timeZone: 'America/Los_Angeles',
                hour12: true,
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit'
            });
            
            let message = `📊 **Staging Area Monitor Update ${updateCount}/${TOTAL_UPDATES}** (${timestamp})\n\n`;
            
            if (activePlayersList.length === 0) {
                message += '📋 **No players currently in Fight Night Staging Area**\n';
            } else {
                message += `📋 **Players in Fight Night Staging Area** (${activePlayersList.length} total)\n\n`;
                
                // Get detailed player information
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
                            joinTime: new Date(player.joinTime).toLocaleTimeString('en-US', { 
                                timeZone: 'America/Los_Angeles',
                                hour12: true,
                                hour: 'numeric',
                                minute: '2-digit'
                            }),
                            riotId: sheetData ? sheetData.riotId : 'Not found',
                            mmr: sheetData ? sheetData.mmr : 'N/A',
                            primaryRole: sheetData ? sheetData.primaryRole : 'N/A',
                            secondaryRole: sheetData ? sheetData.secondaryRole : 'N/A',
                            realName: sheetData ? sheetData.realName : 'N/A',
                            isRioter: sheetData ? sheetData.isRioter : false
                        };
                        
                        playerDetails.push(playerInfo);
                    } catch (error) {
                        console.error(`Error getting data for player ${player.username}:`, error);
                        // Add basic info if detailed lookup fails
                        playerDetails.push({
                            displayName: player.displayName,
                            username: player.username,
                            joinTime: new Date(player.joinTime).toLocaleTimeString('en-US', { 
                                timeZone: 'America/Los_Angeles',
                                hour12: true,
                                hour: 'numeric',
                                minute: '2-digit'
                            }),
                            riotId: 'Error',
                            mmr: 'N/A',
                            realName: 'N/A',
                            isRioter: false
                        });
                    }
                }
                
                // Format player list
                for (let i = 0; i < playerDetails.length; i++) {
                    const player = playerDetails[i];
                    const counter = i + 1;
                    const rioterBadge = player.isRioter ? '🔷 ' : '';
                    
                    message += `${counter}. ${rioterBadge}${player.displayName} (${player.username} / ${player.realName} / ${player.riotId}) - MMR: ${player.mmr} - Joined: ${player.joinTime}\n`;
                }
            }
            
            // Add footer
            if (updateCount < TOTAL_UPDATES) {
                message += `\n⏱️ Next update in 5 minutes...`;
            } else {
                message += `\n✅ **Monitoring Complete** - All ${TOTAL_UPDATES} updates sent.`;
            }
            
            // Send to mods channel (split if too long)
            if (message.length > 2000) {
                const firstChunk = message.substring(0, 1900);
                await modsChannel.send(firstChunk);
                
                let remainingMessage = message.substring(1900);
                while (remainingMessage.length > 0) {
                    const chunk = remainingMessage.substring(0, 1900);
                    await modsChannel.send(chunk);
                    remainingMessage = remainingMessage.substring(1900);
                }
            } else {
                await modsChannel.send(message);
            }
            
        } catch (error) {
            console.error('Error posting monitoring update:', error);
            await modsChannel.send(`❌ Error posting update ${updateCount}/${TOTAL_UPDATES}: ${error.message}`);
        }
    };
    
    // Post initial update immediately
    await postUpdate();
    
    // Schedule remaining updates
    const intervalId = setInterval(async () => {
        if (updateCount >= TOTAL_UPDATES) {
            clearInterval(intervalId);
            activeMonitoringSessions.delete(guild.id);
            return;
        }
        
        await postUpdate();
    }, INTERVAL_MS);
}
