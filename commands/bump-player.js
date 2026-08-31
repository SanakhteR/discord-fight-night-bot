const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bumpplayer')
        .setDescription('Move a player to the top of the Active Players List')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Discord username of the player to bump')
                .setRequired(true)),
    
    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can bump players.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply();

            const username = interaction.options.getString('username');
            const activePlayersList = interaction.client.activePlayersList;

            if (activePlayersList.length === 0) {
                return await interaction.editReply({
                    content: '❌ The Active Players List is empty. No players to bump.'
                });
            }

            // Find the player in the active players list
            const playerIndex = activePlayersList.findIndex(p => 
                p.username.toLowerCase() === username.toLowerCase()
            );

            if (playerIndex === -1) {
                return await interaction.editReply({
                    content: `❌ Player **${username}** is not in the Active Players List.`
                });
            }

            // If player is already at the top (index 0), no need to bump
            if (playerIndex === 0) {
                return await interaction.editReply({
                    content: `ℹ️ Player **${username}** is already at the top of the Active Players List.`
                });
            }

            // Remove the player from their current position
            const [player] = activePlayersList.splice(playerIndex, 1);
            
            // Update their join time to now (to reflect the bump)
            player.joinTime = Date.now();
            
            // Add them to the front of the list
            activePlayersList.unshift(player);
            
            // Update the client's list
            interaction.client.activePlayersList = activePlayersList;

            await interaction.editReply({
                content: `✅ Successfully bumped **${username}** to the top of the Active Players List! They are now in position #1.`
            });

            console.log(`${interaction.user.username} bumped ${username} to the top of the active players list`);

        } catch (error) {
            console.error('Error in bumpplayer command:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ An error occurred while bumping the player.'
                });
            } else {
                await interaction.reply({
                    content: '❌ An error occurred while bumping the player.',
                    ephemeral: true
                });
            }
        }
    }
};
