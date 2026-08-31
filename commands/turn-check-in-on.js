const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('turn-check-in-on')
        .setDescription('Enable the /check-in command for all users'),

    async execute(interaction) {
        const hasModeratorRole = interaction.member.roles.cache.some(role =>
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );

        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can change check-in state.',
                ephemeral: true
            });
        }

        if (interaction.client.checkInOpen) {
            return await interaction.reply({
                content: 'ℹ️ Check-in is already **ON**.',
                ephemeral: true
            });
        }

        interaction.client.checkInOpen = true;

        // Cancel any existing auto-off timeout
        if (interaction.client.checkInAutoOffTimeout) {
            clearTimeout(interaction.client.checkInAutoOffTimeout);
            interaction.client.checkInAutoOffTimeout = null;
        }

        await interaction.reply({
            content: '✅ **Check-in is now ON.** Players can use `/check-in` to join the Active Players List.'
        });

        const debugChannel = interaction.guild.channels.cache.find(ch => ch.name === 'list-status-and-debug');
        if (debugChannel) {
            await debugChannel.send(`🔧 **Check-in toggled ON** by ${interaction.user.username}`);
        }
    }
};
