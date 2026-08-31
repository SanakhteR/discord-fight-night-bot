const { SlashCommandBuilder } = require('discord.js');
const { GoogleSheetsService } = require('../services/googleSheets');

const googleSheetsService = new GoogleSheetsService();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('check-in')
        .setDescription('Check in to the Active Players List for tonight\'s Fight Night'),

    async execute(interaction) {
        try {
            // Gate by check-in open state
            if (!interaction.client.checkInOpen) {
                return await interaction.reply({
                    content: "Sorry, you can't queue for Fight Night right now",
                    ephemeral: true
                });
            }

            const member = interaction.member;
            const username = member.user.username;
            const displayName = member.displayName || username;

            // Already in list?
            const alreadyIn = interaction.client.activePlayersList.some(
                p => p.userId === member.id ||
                     (p.username && p.username.toLowerCase() === username.toLowerCase())
            );
            if (alreadyIn) {
                return await interaction.reply({
                    content: `ℹ️ ${displayName}, you are already in the Active Players List.`,
                    ephemeral: true
                });
            }

            await interaction.deferReply();

            // Look up player profile from Google Sheets
            let playerData = null;
            try {
                playerData = await googleSheetsService.findPlayerByUsername(username);
            } catch (err) {
                console.error('check-in: error fetching sheet data:', err);
            }

            // Add to Active Players List
            interaction.client.activePlayersList.push({
                userId: member.id,
                username: username,
                displayName: displayName,
                joinTime: Date.now()
            });

            const count = interaction.client.activePlayersList.length;

            // Build profile string: Name / MMR / Roles
            const name = playerData && playerData.realName ? playerData.realName : displayName;
            const mmr = playerData && playerData.mmr !== undefined && playerData.mmr !== null && playerData.mmr !== ''
                ? playerData.mmr
                : 'N/A';
            const primary = playerData && playerData.primaryRole ? playerData.primaryRole : 'N/A';
            const secondary = playerData && playerData.secondaryRole ? playerData.secondaryRole : 'N/A';
            const roles = `${primary}/${secondary}`;

            const message =
                `✅ **${displayName}** (${name} / MMR: ${mmr} / Roles: ${roles}) has joined the queue, ` +
                `we now have **${count}** player${count === 1 ? '' : 's'} waiting for Fight Night tonight!`;

            await interaction.editReply({ content: message });

            // Debug log
            const debugChannel = interaction.guild.channels.cache.find(ch => ch.name === 'list-status-and-debug');
            if (debugChannel) {
                await debugChannel.send(
                    `🔧 **Check-in**: ${displayName} (@${username}) self-checked-in. Active Players List size: ${count}`
                );
            }
        } catch (error) {
            console.error('Error in /check-in command:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ An error occurred during check-in.' });
            } else {
                await interaction.reply({ content: '❌ An error occurred during check-in.', ephemeral: true });
            }
        }
    }
};
