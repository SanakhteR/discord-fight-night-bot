const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('turn-check-in-off')
        .setDescription('Disable the /check-in command for all users'),

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

        if (!interaction.client.checkInOpen) {
            return await interaction.reply({
                content: 'ℹ️ Check-in is already **OFF**.',
                ephemeral: true
            });
        }

        interaction.client.checkInOpen = false;

        if (interaction.client.checkInAutoOffTimeout) {
            clearTimeout(interaction.client.checkInAutoOffTimeout);
            interaction.client.checkInAutoOffTimeout = null;
        }

        await interaction.reply({
            content: '🛑 **Check-in is now OFF.** Players can no longer use `/check-in`.'
        });

        const debugChannel = interaction.guild.channels.cache.find(ch => ch.name === 'list-status-and-debug');
        if (debugChannel) {
            await debugChannel.send(`🔧 **Check-in toggled OFF** by ${interaction.user.username}`);
        }
    }
};
