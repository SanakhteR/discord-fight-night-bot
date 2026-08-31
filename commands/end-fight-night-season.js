const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('end-fight-night-season')
        .setDescription('Stop weekly Fight Night season reminders'),
    
    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can end the Fight Night season.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply();

            // Check if there's an active schedule
            if (!interaction.client.seasonSchedule) {
                return await interaction.editReply({
                    content: '❌ There is no active Fight Night season schedule to stop.\n\n' +
                            'Use `/start-fight-night-season` to create a new schedule.'
                });
            }

            // Stop the schedule
            interaction.client.seasonSchedule.stop();
            interaction.client.seasonSchedule = null;

            await interaction.editReply({
                content: '✅ **Fight Night Season Ended!**\n\n' +
                        '📅 Weekly reminders have been stopped.\n' +
                        'Use `/start-fight-night-season` to start a new schedule.'
            });

            console.log(`Fight Night season ended by ${interaction.user.username}`);

        } catch (error) {
            console.error('Error in end-fight-night-season command:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ An error occurred while ending the Fight Night season.'
                });
            } else {
                await interaction.reply({
                    content: '❌ An error occurred while ending the Fight Night season.',
                    ephemeral: true
                });
            }
        }
    }
};
