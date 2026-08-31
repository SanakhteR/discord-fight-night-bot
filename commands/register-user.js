const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { DebugLogger } = require('../utils/debugLogger');

const debugLogger = new DebugLogger();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register-user')
        .setDescription('Start the registration flow in #welcome for a target user (Moderators/Admins/Power only)')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Discord username of the user to register')
                .setRequired(true)),

    async execute(interaction) {
        // Check permissions
        const hasModeratorRole = interaction.member.roles.cache.some(role => 
            role.name === 'Moderator' || role.name === 'Admin' || role.name === 'Power'
        );
        
        if (!hasModeratorRole) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command. Only Moderators, Admins, and Power users can trigger user verification.',
                ephemeral: true
            });
        }
        
        const username = interaction.options.getString('username');
        const debug = debugLogger.createLogger(interaction.guild);

        try {
            await interaction.deferReply({ ephemeral: true });
            await debug.info(`**/register-user**: Started by ${interaction.user.username} for target username: ${username}`);

            const guild = interaction.guild;

            // Find target Discord member (cache, then API fallback)
            let member = guild.members.cache.find(m =>
                m.user.username.toLowerCase() === username.toLowerCase()
            );
            if (!member) {
                try {
                    await guild.members.fetch();
                    member = guild.members.cache.find(m =>
                        m.user.username.toLowerCase() === username.toLowerCase()
                    );
                } catch (err) {
                    console.error('Error fetching guild members:', err);
                    await debug.error(`**/register-user**: Error fetching guild members: ${err.message}`);
                }
            }

            if (!member) {
                await debug.error(`**/register-user**: Discord user "${username}" not found in server`);
                return await interaction.editReply({
                    content: `❌ Discord user "${username}" not found in this server.`
                });
            }

            // Find #welcome channel
            const welcomeChannel = guild.channels.cache.find(ch => ch.name === 'welcome');
            if (!welcomeChannel) {
                await debug.error('**/register-user**: #welcome channel not found');
                return await interaction.editReply({
                    content: '❌ #welcome channel not found. Cannot start registration.'
                });
            }

            // Ensure target has the Unverified role and not the Verified role
            const unverifiedRole = guild.roles.cache.find(role => role.name === 'Unverified');
            const verifiedRole = guild.roles.cache.find(role => role.name === 'Verified');
            if (unverifiedRole && !member.roles.cache.has(unverifiedRole.id)) {
                try { await member.roles.add(unverifiedRole); } catch (err) {
                    await debug.error(`**/register-user**: Failed to add Unverified role: ${err.message}`);
                }
            }
            if (verifiedRole && member.roles.cache.has(verifiedRole.id)) {
                try { await member.roles.remove(verifiedRole); } catch (err) {
                    await debug.error(`**/register-user**: Failed to remove Verified role: ${err.message}`);
                }
            }

            // Post the registration starter message with Yes/No buttons in #welcome
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`verify_yes_${member.id}`)
                        .setLabel('Yes')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`verify_no_${member.id}`)
                        .setLabel('No')
                        .setStyle(ButtonStyle.Danger)
                );

            await welcomeChannel.send({
                content: `${member}, have you played in Fight Night before?`,
                components: [row]
            });

            // Create / overwrite verification session for this target
            if (!interaction.client.verificationSessions) {
                interaction.client.verificationSessions = new Map();
            }
            interaction.client.verificationSessions.set(member.id, {
                step: 'initial',
                userId: member.id,
                startTime: Date.now()
            });

            await debug.success(`**/register-user**: Posted registration starter in #welcome for ${member.user.username}`);

            await interaction.editReply({
                content: `✅ Started registration for ${member.displayName} (@${member.user.username}) in <#${welcomeChannel.id}>.`
            });
        } catch (error) {
            console.error('Error in /register-user command:', error);
            try { await debug.error(`**/register-user**: Error occurred: ${error.message}`); } catch (_) {}

            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({ content: '❌ An error occurred while starting registration.' });
            } else if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ An error occurred while starting registration.', ephemeral: true });
            }
        }
    }
};
