const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { GoogleSheetsService } = require('./googleSheets');

const googleSheetsService = new GoogleSheetsService();

const TIMEZONE = 'America/Los_Angeles';

// Persist the schedule config next to the SQLite DB on the Fly persistent
// volume (/app/data) so it survives machine restarts / redeploys. Falls back to
// a local ./data directory when running outside Fly.
const DATA_DIR = path.dirname(process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'bot.db'));
const SCHEDULE_FILE = path.join(DATA_DIR, 'schedules.json');

function loadSchedules() {
    try {
        if (fs.existsSync(SCHEDULE_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf-8'));
            return { season: parsed.season || null, offSeason: parsed.offSeason || null };
        }
    } catch (error) {
        console.error('Failed to read schedules file:', error.message);
    }
    return { season: null, offSeason: null };
}

function writeSchedules(data) {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Failed to write schedules file:', error.message);
    }
}

// Save regular-season config. Leaves any off-season config untouched.
function persistSeason(state) {
    const data = loadSchedules();
    data.season = state;
    writeSchedules(data);
}

// Save off-season config. Clears the regular-season config to mirror the
// runtime behavior where starting the off season stops the regular season.
function persistOffSeason(state) {
    const data = loadSchedules();
    data.offSeason = state;
    data.season = null;
    writeSchedules(data);
}

function clearSeason() {
    const data = loadSchedules();
    data.season = null;
    writeSchedules(data);
}

function clearOffSeason() {
    const data = loadSchedules();
    data.offSeason = null;
    writeSchedules(data);
}

// Opens /check-in for 8 hours after a reminder fires, with a silent auto-disable.
function openCheckInFor8Hours(client) {
    client.checkInOpen = true;
    if (client.checkInAutoOffTimeout) {
        clearTimeout(client.checkInAutoOffTimeout);
    }
    const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
    client.checkInAutoOffTimeout = setTimeout(() => {
        client.checkInOpen = false;
        client.checkInAutoOffTimeout = null;
        console.log('Auto-disabled /check-in after 8 hours (silent)');
    }, EIGHT_HOURS_MS);
}

async function sendSeasonReminder(client) {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
        console.error('Guild not found for scheduled message');
        return;
    }
    const generalChannel = guild.channels.cache.find(ch => ch.name === 'fight-night-general');
    if (!generalChannel) {
        console.error('fight-night-general channel not found');
        return;
    }

    const topPlayers = await googleSheetsService.getTopPlayersByScore(10);

    let message = '🎮 **FIGHT NIGHT REMINDER** 🎮\n\n';
    message += '⚔️ Fight Night is happening soon! Get ready to compete! ⚔️\n\n';

    if (topPlayers.length > 0) {
        message += '🏆 **Current Season Leaderboard - Top Players:**\n\n';
        for (let i = 0; i < topPlayers.length; i++) {
            const player = topPlayers[i];
            const rank = i + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
            const rioterBadge = player.isRioter ? '🔷 ' : '';
            message += `${medal} **#${rank}** - ${rioterBadge}${player.realName} (${player.riotId}) - **${player.score} points**\n`;
        }
        message += '\n';
    }

    message += '📍 Join the **Fight Night Staging Area** voice channel to participate, or use the /check-in command!\n';
    message += '📝 Check-in is now **OPEN** — use `/check-in` to join the Active Players List!';

    await generalChannel.send(message);
    console.log('Successfully sent Fight Night season reminder');

    openCheckInFor8Hours(client);
    console.log('Enabled /check-in for 8 hours via Fight Night season schedule');
}

async function sendOffSeasonReminder(client) {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
        console.error('Guild not found for scheduled message');
        return;
    }
    const generalChannel = guild.channels.cache.find(ch => ch.name === 'fight-night-general');
    if (!generalChannel) {
        console.error('fight-night-general channel not found');
        return;
    }

    let message = '🎮 **FIGHT NIGHT OFF SEASON** 🎮\n\n';
    message += "We are in Fight Night off season, but we'll have in-houses tonight starting at 9:30pm! Use `/check-in` to guarantee your spot!\n\n";
    message += '📍 Join the **Fight Night Staging Area** voice channel to participate, or use the `/check-in` command!\n';
    message += '📝 Check-in is now **OPEN** — use `/check-in` to join the Active Players List!';

    await generalChannel.send(message);
    console.log('Successfully sent Fight Night off season reminder');

    openCheckInFor8Hours(client);
    console.log('Enabled /check-in for 8 hours via Fight Night off season schedule');
}

// Creates (but does not persist) a weekly cron task in the PST/PDT timezone.
function createCronTask(client, { hour, minute, dayOfWeek }, isOffSeason) {
    const cronExpression = `${minute} ${hour} * * ${dayOfWeek}`;
    console.log(`Scheduling Fight Night ${isOffSeason ? 'off season' : 'season'} reminder: ${cronExpression} (${TIMEZONE})`);
    return cron.schedule(cronExpression, async () => {
        try {
            console.log(`Running scheduled Fight Night ${isOffSeason ? 'off season' : 'season'} reminder...`);
            if (isOffSeason) {
                await sendOffSeasonReminder(client);
            } else {
                await sendSeasonReminder(client);
            }
        } catch (error) {
            console.error('Error sending scheduled Fight Night reminder:', error);
        }
    }, { timezone: TIMEZONE });
}

// Starts the regular season schedule: stops any existing one, creates the cron
// task, stores it on the client, and persists the config.
function startSeasonSchedule(client, { hour, minute, dayOfWeek, timeInput, dayInput }) {
    if (client.seasonSchedule) {
        client.seasonSchedule.stop();
        console.log('Stopped existing Fight Night season schedule');
    }
    client.seasonSchedule = createCronTask(client, { hour, minute, dayOfWeek }, false);
    persistSeason({ hour, minute, dayOfWeek, timeInput, dayInput });
}

// Starts the off season schedule. Mirrors prior behavior: stops the regular
// season too so reminders don't collide. Returns whether a regular season was
// stopped (for the command's reply message).
function startOffSeasonSchedule(client, { hour, minute, dayOfWeek, timeInput, dayInput }) {
    let stoppedRegularSeason = false;
    if (client.seasonSchedule) {
        client.seasonSchedule.stop();
        client.seasonSchedule = null;
        stoppedRegularSeason = true;
        console.log('Stopped existing Fight Night (regular) season schedule when starting off season');
    }
    if (client.offSeasonSchedule) {
        client.offSeasonSchedule.stop();
        console.log('Stopped existing Fight Night off season schedule');
    }
    client.offSeasonSchedule = createCronTask(client, { hour, minute, dayOfWeek }, true);
    persistOffSeason({ hour, minute, dayOfWeek, timeInput, dayInput });
    return stoppedRegularSeason;
}

function stopSeasonSchedule(client) {
    if (client.seasonSchedule) {
        client.seasonSchedule.stop();
        client.seasonSchedule = null;
    }
    clearSeason();
}

function stopOffSeasonSchedule(client) {
    if (client.offSeasonSchedule) {
        client.offSeasonSchedule.stop();
        client.offSeasonSchedule = null;
    }
    clearOffSeason();
}

// Re-creates any persisted schedules after a restart. Call once the client is
// Ready (so guild/channel caches are populated when reminders eventually fire).
function restoreSchedules(client) {
    const data = loadSchedules();
    if (data.season) {
        client.seasonSchedule = createCronTask(client, data.season, false);
        console.log(`Restored regular season schedule: ${data.season.dayInput || data.season.dayOfWeek} at ${data.season.timeInput || `${data.season.hour}:${data.season.minute}`} PST`);
    }
    if (data.offSeason) {
        client.offSeasonSchedule = createCronTask(client, data.offSeason, true);
        console.log(`Restored off season schedule: ${data.offSeason.dayInput || data.offSeason.dayOfWeek} at ${data.offSeason.timeInput || `${data.offSeason.hour}:${data.offSeason.minute}`} PST`);
    }
    if (!data.season && !data.offSeason) {
        console.log('No persisted Fight Night schedules to restore');
    }
}

module.exports = {
    startSeasonSchedule,
    startOffSeasonSchedule,
    stopSeasonSchedule,
    stopOffSeasonSchedule,
    restoreSchedules,
    loadSchedules
};
