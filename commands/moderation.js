const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mod')
        .setDescription('Moderation commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(subcommand =>
            subcommand
                .setName('kick')
                .setDescription('Kick a member from the server')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The member to kick')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the kick')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ban')
                .setDescription('Ban a member from the server')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The member to ban')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the ban'))
                .addIntegerOption(option =>
                    option.setName('delete_days')
                        .setDescription('Days of messages to delete (0-7)')
                        .setMinValue(0)
                        .setMaxValue(7)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('timeout')
                .setDescription('Timeout a member')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The member to timeout')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('duration')
                        .setDescription('Timeout duration in minutes')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(40320))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the timeout')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('untimeout')
                .setDescription('Remove timeout from a member')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The member to remove timeout from')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('warn')
                .setDescription('Warn a member')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The member to warn')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the warning')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Clear messages from a channel')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to delete (1-100)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(100))
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('Only delete messages from this user'))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'kick':
                await this.handleKick(interaction);
                break;
            case 'ban':
                await this.handleBan(interaction);
                break;
            case 'timeout':
                await this.handleTimeout(interaction);
                break;
            case 'untimeout':
                await this.handleUntimeout(interaction);
                break;
            case 'warn':
                await this.handleWarn(interaction);
                break;
            case 'clear':
                await this.handleClear(interaction);
                break;
        }
    },

    async handleKick(interaction) {
        const target = interaction.options.getMember('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!target) {
            return interaction.reply({
                content: 'User not found in this server.',
                ephemeral: true
            });
        }

        if (!target.kickable) {
            return interaction.reply({
                content: 'I cannot kick this user. They may have higher permissions than me.',
                ephemeral: true
            });
        }

        if (target.id === interaction.user.id) {
            return interaction.reply({
                content: 'You cannot kick yourself!',
                ephemeral: true
            });
        }

        try {
            await target.kick(reason);

            const embed = new EmbedBuilder()
                .setColor(0xFF6B35)
                .setTitle('👢 Member Kicked')
                .addFields(
                    { name: 'User', value: `${target.user.tag} (${target.id})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error kicking user:', error);
            await interaction.reply({
                content: 'An error occurred while trying to kick the user.',
                ephemeral: true
            });
        }
    },

    async handleBan(interaction) {
        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const deleteDays = interaction.options.getInteger('delete_days') || 0;

        try {
            await interaction.guild.members.ban(target, {
                deleteMessageDays: deleteDays,
                reason: reason
            });

            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🔨 Member Banned')
                .addFields(
                    { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Messages Deleted', value: `${deleteDays} days`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error banning user:', error);
            await interaction.reply({
                content: 'An error occurred while trying to ban the user.',
                ephemeral: true
            });
        }
    },

    async handleTimeout(interaction) {
        const target = interaction.options.getMember('target');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!target) {
            return interaction.reply({
                content: 'User not found in this server.',
                ephemeral: true
            });
        }

        if (!target.moderatable) {
            return interaction.reply({
                content: 'I cannot timeout this user. They may have higher permissions than me.',
                ephemeral: true
            });
        }

        if (target.id === interaction.user.id) {
            return interaction.reply({
                content: 'You cannot timeout yourself!',
                ephemeral: true
            });
        }

        try {
            const timeoutDuration = duration * 60 * 1000; // Convert minutes to milliseconds
            await target.timeout(timeoutDuration, reason);

            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⏰ Member Timed Out')
                .addFields(
                    { name: 'User', value: `${target.user.tag} (${target.id})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Duration', value: `${duration} minutes`, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error timing out user:', error);
            await interaction.reply({
                content: 'An error occurred while trying to timeout the user.',
                ephemeral: true
            });
        }
    },

    async handleUntimeout(interaction) {
        const target = interaction.options.getMember('target');

        if (!target) {
            return interaction.reply({
                content: 'User not found in this server.',
                ephemeral: true
            });
        }

        if (!target.isCommunicationDisabled()) {
            return interaction.reply({
                content: 'This user is not currently timed out.',
                ephemeral: true
            });
        }

        try {
            await target.timeout(null);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Timeout Removed')
                .addFields(
                    { name: 'User', value: `${target.user.tag} (${target.id})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error removing timeout:', error);
            await interaction.reply({
                content: 'An error occurred while trying to remove the timeout.',
                ephemeral: true
            });
        }
    },

    async handleWarn(interaction) {
        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason');
        const db = interaction.client.db;

        try {
            // Store warning in database (you might want to create a warnings table)
            const embed = new EmbedBuilder()
                .setColor(0xFFFF00)
                .setTitle('⚠️ Member Warned')
                .addFields(
                    { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Try to DM the user about the warning
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xFFFF00)
                    .setTitle('⚠️ You have been warned')
                    .setDescription(`You have received a warning in **${interaction.guild.name}**`)
                    .addFields(
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Moderator', value: interaction.user.tag, inline: true }
                    )
                    .setTimestamp();

                await target.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log('Could not DM user about warning');
            }
        } catch (error) {
            console.error('Error warning user:', error);
            await interaction.reply({
                content: 'An error occurred while trying to warn the user.',
                ephemeral: true
            });
        }
    },

    async handleClear(interaction) {
        const amount = interaction.options.getInteger('amount');
        const target = interaction.options.getUser('target');

        try {
            const messages = await interaction.channel.messages.fetch({ limit: amount });
            
            let messagesToDelete = messages;
            if (target) {
                messagesToDelete = messages.filter(msg => msg.author.id === target.id);
            }

            const deleted = await interaction.channel.bulkDelete(messagesToDelete, true);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🧹 Messages Cleared')
                .addFields(
                    { name: 'Messages Deleted', value: deleted.size.toString(), inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true }
                )
                .setTimestamp();

            if (target) {
                embed.addFields({ name: 'Target User', value: target.tag, inline: true });
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error clearing messages:', error);
            await interaction.reply({
                content: 'An error occurred while trying to clear messages. Note: Messages older than 14 days cannot be bulk deleted.',
                ephemeral: true
            });
        }
    }
};
