const { SlashCommandBuilder } = require('discord.js');
const { loadSchedules } = require('../services/seasonScheduler');

// Map cron day numbers (0 = Sunday ... 6 = Saturday) back to display names.
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function describe(state) {
    if (!state) return null;
    const dayName = state.dayInput
        ? state.dayInput.charAt(0).toUpperCase() + state.dayInput.slice(1)
        : (DAY_NAMES[state.dayOfWeek] || `day ${state.dayOfWeek}`);
    const time = state.timeInput || `${String(state.hour).padStart(2, '0')}:${String(state.minute).padStart(2, '0')}`;
    return { dayName, time };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('check-fight-night-season')
        .setDescription('Check whether a Fight Night season or off season is active and its day/time'),

    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role =>
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );

        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can check the Fight Night season.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply();

            const schedules = loadSchedules();
            const season = describe(schedules.season);
            const offSeason = describe(schedules.offSeason);

            let message;
            if (season) {
                message = '✅ **Fight Night REGULAR SEASON is active.**\n\n' +
                    `📅 Weekly reminder: every **${season.dayName}** at **${season.time} PST**\n` +
                    '📍 Posts in #fight-night-general (with Top 10 leaderboard)\n\n' +
                    'Use `/end-fight-night-season` to stop it.';
            } else if (offSeason) {
                message = '✅ **Fight Night OFF SEASON is active.**\n\n' +
                    `📅 Weekly reminder: every **${offSeason.dayName}** at **${offSeason.time} PST**\n` +
                    '📍 Posts in #fight-night-general (in-houses, no leaderboard)\n\n' +
                    'Use `/end-off-season` to stop it.';
            } else {
                message = '❌ **No active Fight Night schedule.**\n\n' +
                    'There is currently no regular season or off season reminder set.\n' +
                    'Use `/start-fight-night-season` or `/start-off-season` to create one.';
            }

            await interaction.editReply({ content: message });

        } catch (error) {
            console.error('Error in check-fight-night-season command:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ An error occurred while checking the Fight Night season.'
                });
            } else {
                await interaction.reply({
                    content: '❌ An error occurred while checking the Fight Night season.',
                    ephemeral: true
                });
            }
        }
    }
};
