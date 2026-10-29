const { SlashCommandBuilder } = require('discord.js');
const { startOffSeasonSchedule } = require('../services/seasonScheduler');

// Map day names to cron day numbers (0 = Sunday, 1 = Monday, etc.)
const DAY_MAP = {
    'sunday': 0,
    'sun': 0,
    'monday': 1,
    'mon': 1,
    'tuesday': 2,
    'tues': 2,
    'tue': 2,
    'wednesday': 3,
    'weds': 3,
    'wed': 3,
    'thursday': 4,
    'thurs': 4,
    'thu': 4,
    'friday': 5,
    'fri': 5,
    'saturday': 6,
    'sat': 6
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('start-off-season')
        .setDescription('Start weekly Fight Night OFF SEASON reminders (in-houses, no leaderboard)')
        .addStringOption(option =>
            option.setName('day')
                .setDescription('Day of the week (e.g., monday, tues, wed)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Time in PST (24-hour format, e.g., 18:00 or 18:30)')
                .setRequired(true)),
    
    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can start the Fight Night off season.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply();

            const dayInput = interaction.options.getString('day').toLowerCase();
            const timeInput = interaction.options.getString('time');

            // Validate day
            const dayOfWeek = DAY_MAP[dayInput];
            if (dayOfWeek === undefined) {
                return await interaction.editReply({
                    content: `❌ Invalid day: **${dayInput}**. Please use one of: monday, tuesday, wednesday, thursday, friday, saturday, sunday (or their abbreviations like mon, tues, wed, etc.)`
                });
            }

            // Validate and parse time (format: HH:MM in 24-hour)
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
            const timeMatch = timeInput.match(timeRegex);
            
            if (!timeMatch) {
                return await interaction.editReply({
                    content: `❌ Invalid time format: **${timeInput}**. Please use 24-hour format like 18:00 or 18:30`
                });
            }

            const hour = parseInt(timeMatch[1]);
            const minute = parseInt(timeMatch[2]);

            // Create + persist the weekly off season schedule (survives bot restarts).
            // Also stops the regular season so reminders don't collide.
            const stoppedRegularSeason = startOffSeasonSchedule(interaction.client, { hour, minute, dayOfWeek, timeInput, dayInput });

            // Get full day name for display
            const fullDayName = Object.keys(DAY_MAP).find(key => 
                DAY_MAP[key] === dayOfWeek && key.length > 3
            ) || dayInput;

            let replyMessage = `✅ **Fight Night Off Season Started!**\n\n` +
                    `📅 Weekly off season reminders will be posted every **${fullDayName.charAt(0).toUpperCase() + fullDayName.slice(1)}** at **${timeInput} PST**\n` +
                    `📍 Messages will appear in #fight-night-general\n` +
                    `🏆 No leaderboard will be displayed during off season\n\n` +
                    `Use \`/end-off-season\` to stop the weekly off season reminders.`;

            if (stoppedRegularSeason) {
                replyMessage += `\n\n⚠️ The regular Fight Night season schedule was stopped to avoid duplicate reminders.`;
            }

            await interaction.editReply({ content: replyMessage });

            console.log(`Fight Night off season started by ${interaction.user.username}: ${fullDayName} at ${timeInput} PST`);

        } catch (error) {
            console.error('Error in start-off-season command:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ An error occurred while starting the Fight Night off season.'
                });
            } else {
                await interaction.reply({
                    content: '❌ An error occurred while starting the Fight Night off season.',
                    ephemeral: true
                });
            }
        }
    }
};
