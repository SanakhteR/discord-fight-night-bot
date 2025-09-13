const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('results')
        .setDescription('Report match results')
        .addSubcommand(subcommand =>
            subcommand
                .setName('report')
                .setDescription('Report the result of a match')
                .addIntegerOption(option =>
                    option.setName('match_id')
                        .setDescription('The ID of the match')
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('winner')
                        .setDescription('The winner of the match')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('View match history')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to view history for (defaults to yourself)')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('View the server leaderboard')
                .addStringOption(option =>
                    option.setName('sort')
                        .setDescription('Sort by')
                        .addChoices(
                            { name: 'Wins', value: 'wins' },
                            { name: 'Win Rate', value: 'winrate' },
                            { name: 'Total Matches', value: 'total' }
                        ))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const db = interaction.client.db;

        switch (subcommand) {
            case 'report':
                await this.handleReportResult(interaction, db);
                break;
            case 'history':
                await this.handleHistory(interaction, db);
                break;
            case 'leaderboard':
                await this.handleLeaderboard(interaction, db);
                break;
        }
    },

    async handleReportResult(interaction, db) {
        const matchId = interaction.options.getInteger('match_id');
        const winner = interaction.options.getUser('winner');

        try {
            // Get match details
            const match = await new Promise((resolve, reject) => {
                db.db.get(
                    'SELECT * FROM matches WHERE id = ? AND status = "pending"',
                    [matchId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (!match) {
                return interaction.reply({
                    content: 'Match not found or already completed.',
                    ephemeral: true
                });
            }

            // Verify the user is part of this match
            if (match.player1_id !== interaction.user.id && match.player2_id !== interaction.user.id) {
                return interaction.reply({
                    content: 'You are not part of this match.',
                    ephemeral: true
                });
            }

            // Verify the winner is part of this match
            if (winner.id !== match.player1_id && winner.id !== match.player2_id) {
                return interaction.reply({
                    content: 'The winner must be one of the players in this match.',
                    ephemeral: true
                });
            }

            // Complete the match
            await db.completeMatch(matchId, winner.id);

            // Update player stats
            const winnerId = winner.id;
            const loserId = winnerId === match.player1_id ? match.player2_id : match.player1_id;

            // Get current stats
            const winnerStats = await db.getUser(winnerId);
            const loserStats = await db.getUser(loserId);

            // Update winner stats
            await db.updateUserStats(winnerId, (winnerStats.wins || 0) + 1, winnerStats.losses || 0);
            
            // Update loser stats
            await db.updateUserStats(loserId, loserStats.wins || 0, (loserStats.losses || 0) + 1);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🏆 Match Result Recorded')
                .addFields(
                    { name: 'Match ID', value: matchId.toString(), inline: true },
                    { name: 'Winner', value: winner.username, inline: true },
                    { name: 'Game Mode', value: match.game_mode.replace('_', ' ').toUpperCase(), inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error reporting result:', error);
            await interaction.reply({
                content: 'An error occurred while reporting the match result.',
                ephemeral: true
            });
        }
    },

    async handleHistory(interaction, db) {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        try {
            const matches = await new Promise((resolve, reject) => {
                db.db.all(
                    `SELECT m.*, 
                            u1.username as player1_name, 
                            u2.username as player2_name,
                            w.username as winner_name
                     FROM matches m
                     JOIN users u1 ON m.player1_id = u1.id
                     JOIN users u2 ON m.player2_id = u2.id
                     LEFT JOIN users w ON m.winner_id = w.id
                     WHERE (m.player1_id = ? OR m.player2_id = ?) AND m.status = "completed"
                     ORDER BY m.completed_at DESC
                     LIMIT 10`,
                    [targetUser.id, targetUser.id],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });

            if (matches.length === 0) {
                return interaction.reply({
                    content: `${targetUser.username} has no completed matches.`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`📊 ${targetUser.username}'s Match History`)
                .setDescription('Last 10 completed matches');

            matches.forEach((match, index) => {
                const opponent = match.player1_id === targetUser.id ? match.player2_name : match.player1_name;
                const result = match.winner_id === targetUser.id ? '🏆 WIN' : '❌ LOSS';
                const gameMode = match.game_mode.replace('_', ' ').toUpperCase();
                
                embed.addFields({
                    name: `Match #${match.id}`,
                    value: `vs ${opponent} - ${result}\n${gameMode}`,
                    inline: true
                });
            });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error getting match history:', error);
            await interaction.reply({
                content: 'An error occurred while getting match history.',
                ephemeral: true
            });
        }
    },

    async handleLeaderboard(interaction, db) {
        const sortBy = interaction.options.getString('sort') || 'wins';

        try {
            let orderBy;
            switch (sortBy) {
                case 'wins':
                    orderBy = 'wins DESC';
                    break;
                case 'winrate':
                    orderBy = '(CAST(wins AS FLOAT) / NULLIF(wins + losses, 0)) DESC';
                    break;
                case 'total':
                    orderBy = '(wins + losses) DESC';
                    break;
                default:
                    orderBy = 'wins DESC';
            }

            const users = await new Promise((resolve, reject) => {
                db.db.all(
                    `SELECT username, wins, losses, skill_level,
                            (wins + losses) as total_matches,
                            CASE 
                                WHEN (wins + losses) > 0 
                                THEN ROUND((CAST(wins AS FLOAT) / (wins + losses)) * 100, 1)
                                ELSE 0 
                            END as win_rate
                     FROM users 
                     WHERE (wins + losses) > 0
                     ORDER BY ${orderBy}
                     LIMIT 10`,
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });

            if (users.length === 0) {
                return interaction.reply({
                    content: 'No players have completed any matches yet.',
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🏆 Server Leaderboard')
                .setDescription(`Sorted by ${sortBy}`);

            users.forEach((user, index) => {
                const rank = index + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
                
                embed.addFields({
                    name: `${medal} ${user.username}`,
                    value: `**${user.wins}W-${user.losses}L** (${user.win_rate}%)\nSkill: ${user.skill_level} | Matches: ${user.total_matches}`,
                    inline: true
                });
            });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error getting leaderboard:', error);
            await interaction.reply({
                content: 'An error occurred while getting the leaderboard.',
                ephemeral: true
            });
        }
    }
};
