const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear-chat')
        .setDescription('Delete all messages in fight-night-general, fightnightmods, and welcome channels'),
    
    async execute(interaction) {
        // Check permissions - only Admin or Power can use this command
        const hasAdminRole = interaction.member.roles.cache.some(role => role.name === 'Admin' || role.name === 'Power');
        
        if (!hasAdminRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Admins and Power users can clear chat messages.',
                ephemeral: true
            });
        }
        
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const guild = interaction.guild;
            const fightNightGeneral = guild.channels.cache.find(ch => ch.name === 'fight-night-general');
            const fightNightMods = guild.channels.cache.find(ch => ch.name === 'fightnightmods');
            const welcomeChannel = guild.channels.cache.find(ch => ch.name === 'welcome');
            
            let deletedCount = 0;
            
            // Clear fight-night-general channel
            if (fightNightGeneral) {
                try {
                    const messages = await fightNightGeneral.messages.fetch({ limit: 100 });
                    await fightNightGeneral.bulkDelete(messages);
                    deletedCount += messages.size;
                    console.log(`Cleared ${messages.size} messages from #fight-night-general`);
                } catch (error) {
                    console.error('Error clearing fight-night-general:', error);
                }
            }
            
            // Clear fightnightmods channel
            if (fightNightMods) {
                try {
                    const messages = await fightNightMods.messages.fetch({ limit: 100 });
                    await fightNightMods.bulkDelete(messages);
                    deletedCount += messages.size;
                    console.log(`Cleared ${messages.size} messages from #fightnightmods`);
                } catch (error) {
                    console.error('Error clearing fightnightmods:', error);
                }
            }
            
            // Clear welcome channel
            if (welcomeChannel) {
                try {
                    const messages = await welcomeChannel.messages.fetch({ limit: 100 });
                    await welcomeChannel.bulkDelete(messages);
                    deletedCount += messages.size;
                    console.log(`Cleared ${messages.size} messages from #welcome`);
                } catch (error) {
                    console.error('Error clearing welcome:', error);
                }
            }
            
            await interaction.editReply(`✅ Successfully cleared ${deletedCount} messages from the channels.`);
            
        } catch (error) {
            console.error('Error in clear-chat command:', error);
            await interaction.editReply('❌ An error occurred while clearing messages.');
        }
    }
};
