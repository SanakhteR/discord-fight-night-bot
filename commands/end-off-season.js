const { SlashCommandBuilder } = require('discord.js');
const { stopOffSeasonSchedule } = require('../services/seasonScheduler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('end-off-season')
        .setDescription('Stop weekly Fight Night off season reminders'),
    
    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can end the Fight Night off season.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply();

            // Check if there's an active off season schedule
            if (!interaction.client.offSeasonSchedule) {
                return await interaction.editReply({
                    content: '❌ There is no active Fight Night off season schedule to stop.\n\n' +
                            'Use `/start-off-season` to create a new off season schedule.'
                });
            }

            // Stop the schedule and clear the persisted config
            stopOffSeasonSchedule(interaction.client);

            await interaction.editReply({
                content: '✅ **Fight Night Off Season Ended!**\n\n' +
                        '📅 Weekly off season reminders have been stopped.\n' +
                        'Use `/start-off-season` to start a new off season schedule.'
            });

            console.log(`Fight Night off season ended by ${interaction.user.username}`);

        } catch (error) {
            console.error('Error in end-off-season command:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ An error occurred while ending the Fight Night off season.'
                });
            } else {
                await interaction.reply({
                    content: '❌ An error occurred while ending the Fight Night off season.',
                    ephemeral: true
                });
            }
        }
    }
};
