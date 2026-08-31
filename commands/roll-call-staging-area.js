const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roll-call-staging-area')
        .setDescription('Remove Active Players List entries who are not in the Fight Night Staging Area voice channel'),

    async execute(interaction) {
        const hasModeratorRole = interaction.member.roles.cache.some(role =>
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );

        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can run roll call.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply();

            const guild = interaction.guild;
            const stagingChannel = guild.channels.cache.find(ch => ch.name === 'Fight Night Staging Area');

            if (!stagingChannel) {
                return await interaction.editReply({
                    content: '❌ Could not find the **Fight Night Staging Area** voice channel.'
                });
            }

            const presentIds = new Set(stagingChannel.members.map(m => m.id));
            const before = interaction.client.activePlayersList;

            const kept = [];
            const removed = [];

            for (const player of before) {
                if (presentIds.has(player.userId)) {
                    kept.push(player);
                } else {
                    removed.push(player);
                }
            }

            interaction.client.activePlayersList = kept;

            let message;
            if (removed.length === 0) {
                message = `✅ **Roll call complete.** All ${kept.length} player${kept.length === 1 ? '' : 's'} on the Active Players List are present in the Fight Night Staging Area.`;
            } else {
                message = `📣 **Roll call complete.** Removed **${removed.length}** player${removed.length === 1 ? '' : 's'} not present in the Fight Night Staging Area:\n\n`;
                removed.forEach((p, i) => {
                    message += `${i + 1}. ${p.displayName} (@${p.username})\n`;
                });
                message += `\n👥 **${kept.length}** player${kept.length === 1 ? '' : 's'} remaining on the Active Players List.`;
            }

            // Chunk if too long
            if (message.length > 1900) {
                const chunks = [];
                let remaining = message;
                while (remaining.length > 0) {
                    chunks.push(remaining.substring(0, 1900));
                    remaining = remaining.substring(1900);
                }
                await interaction.editReply({ content: chunks[0] });
                for (let i = 1; i < chunks.length; i++) {
                    await interaction.followUp({ content: chunks[i] });
                }
            } else {
                await interaction.editReply({ content: message });
            }

            const debugChannel = guild.channels.cache.find(ch => ch.name === 'list-status-and-debug');
            if (debugChannel) {
                await debugChannel.send(
                    `🔧 **Roll Call**: removed ${removed.length}, kept ${kept.length} (run by ${interaction.user.username})`
                );
            }
        } catch (error) {
            console.error('Error in /roll-call-staging-area command:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ An error occurred during roll call.' });
            } else {
                await interaction.reply({ content: '❌ An error occurred during roll call.', ephemeral: true });
            }
        }
    }
};
