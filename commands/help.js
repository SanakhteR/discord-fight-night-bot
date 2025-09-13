const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('List all bot commands and their descriptions'),
    
    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can view the help menu.',
                ephemeral: true
            });
        }
        
        const helpMessage = `📋 **TonyBot Commands Help**

**🎮 Matchmaking Commands:**
• \`/run-matchmaking\` - Run matchmaking for players in the matchmaking list (by default, players in the staging area channel)

**👥 Player Management - Manage who will be included in matchmaking**
• \`/list-active-players\` - List players who will be included when using /run-matchmaking
• \`/add-user\` - Add user to Active Players List. Use this if someone was removed but then decide to play.
• \`/remove-user\` - Remove user from list. Use this if someone is in staging area but won't play.
• \`/clear-matchmaking-list\` - Clear entire list. Players will be automatically added when joining the staging area channel.

**🔧 Admin Commands - MUST BE USED IN fightnightmods CHANNEL**
• \`/test-matchmaking-algorithm\` - Test algo with random players
• \`/register-user\` - Use this if someone is new to fight night, or if the bot isn't finding them in the MMR spreadsheet. Trigger this command and tell them to go to the #welcome channel and answer the prompts. You need to use their discord USER NAME (not the display name) - it's the lowercase name below their display name in their profile.
• \`/verify-users\` - Check every user in the server and mark them as verified (are in MMR spreadsheet) or unverified (are not). This will take a lot of time so use wisely.
• \`/verify_users_in_staging_area\` - Same as above but only for users who are currently in the staging area. Use this before running matchmaking if someone is unverified. If it doesn't verify them, use the register-user function to add them.• 
• \`/list-all-discord-users-in-server\` - List all server users with roles and Google Sheets data
• \`/clear-chat\` - Delete messages (Admin/Power only)
• \`/help\` - Show this menu

**🤖 Features:**
Automatically adds people to the matchmaking list when they join the staging area, incl. a timestamp. Will select the first N*10 to matchmake.

Debug logs: #list-status-and-debug`;
        
        await interaction.reply({
            content: helpMessage,
            ephemeral: false
        });
    }
};
