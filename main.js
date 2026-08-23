require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Set FFmpeg executable path
const ffmpegPath = path.join(__dirname, 'bin/ffmpeg');
process.env.FFMPEG_PATH = ffmpegPath;

// Append the bin directory to system PATH so prism-media / discord.js find ffmpeg automatically
const binDir = path.join(__dirname, 'bin');
if (!process.env.PATH.includes(binDir)) {
    process.env.PATH = `${binDir}:${process.env.PATH}`;
}

try {
    if (fs.existsSync(ffmpegPath)) {
        fs.chmodSync(ffmpegPath, '755');
        console.log('[music] Granted execution permissions to bin/ffmpeg');
    }
} catch (e) {
    console.warn('[music] Could not set ffmpeg permissions:', e.message);
}

const { Client, GatewayIntentBits } = require('discord.js');
const db = require('./db');

const handleButton  = require('./interactions/buttons');
const handleSelect  = require('./interactions/selects');
const handleModal   = require('./interactions/modals');
const commandHandler = require('./commands/commandHandler');
const rewardService = require('./services/rewardService');
const taskService = require('./services/taskService');
const progressionService = require('./services/progressionService');
const restartGuardService = require('./services/restartGuardService');
const moderationService = require('./services/moderationService');
const clanService = require('./services/clanService');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

const OWNER_ID = process.env.OWNER_ID || '1156642624770424902';
const ACTIVE_CHANNEL_ID = '1486699040581353545';
const ACTIVE_HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000;

// Background cleanup interval (ms)
const GIF_CLEANUP_INTERVAL_MS = 60 * 1000; // run every 60s
const VOICE_PROGRESS_TICK_MS = 30 * 1000;  // award voice task progress every 30s
const BLACKLIST_CHECK_INTERVAL_MS = 60 * 1000;

// Lazy require of shopService to avoid circular dependency at module load
const shopService = require('./services/shopService');

// ── error guards ──────────────────────────────────────────────
client.on('error', console.error);
let fatalExitInProgress = false;

function scheduleFatalExit(type, err) {
    if (fatalExitInProgress) return;
    fatalExitInProgress = true;

    console.error(`[fatal] ${type}:`, err);
    restartGuardService.markPendingCrash(type, err);

    // Give logs a tiny moment to flush before exiting non-zero.
    setTimeout(() => process.exit(1), 500);
}

process.on('unhandledRejection', (reason) => {
    scheduleFatalExit('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)));
});

process.on('uncaughtException', (err) => {
    scheduleFatalExit('uncaughtException', err);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

// ── ready ─────────────────────────────────────────────────────
client.once('clientReady', () => {
    console.log(`✅ ${client.user.tag} is online!`);
    client.user.setActivity('Watching Arabasta 👑');
});

// Also start a periodic task on clientReady to remove expired GIF roles
client.on('clientReady', () => {
    console.log('Starting GIF expiry cleanup task...');

    setInterval(async () => {
        try {
            const { guildId, roleId } = shopService.getGifRoleInfo();
            if (!guildId || !roleId) return; // nothing configured

            const users = await db.getAllUsers();
            const now = Date.now();
            const expired = users.filter(u => u.gif_expires && Number(u.gif_expires) > 0 && now > Number(u.gif_expires));
            if (!expired.length) return;

            const guild = await client.guilds.fetch(guildId).catch(() => null);
            if (!guild) return;

            for (const u of expired) {
                try {
                    const member = await guild.members.fetch(u.user_id).catch(() => null);
                    if (member && member.roles.cache.has(roleId)) {
                        await member.roles.remove(roleId).catch(() => {});
                    }
                } catch (e) {
                    console.error('Error removing expired GIF role for user', u.user_id, e);
                }

                // Clear expiry metadata and save user
                delete u.gif_expires;
                await db.saveUser(u).catch(err => console.error('Failed to save user after GIF expiry cleanup:', err));
            }
        } catch (err) {
            console.error('GIF cleanup task error:', err);
        }
    }, GIF_CLEANUP_INTERVAL_MS);
});

// Live voice progress tracker (works during active calls and survives restarts)
const voiceTrackingState = new Map(); // userId -> lastSeenTimestampMs

async function trackVoiceTaskProgress() {
    try {
        const now = Date.now();
        const currentlyInVoice = new Set();

        for (const guild of client.guilds.cache.values()) {
            for (const channel of guild.channels.cache.values()) {
                // 2 = GuildVoice, 13 = GuildStageVoice
                if (channel.type !== 2 && channel.type !== 13) continue;

                for (const member of channel.members.values()) {
                    if (!member || member.user?.bot) continue;

                    const userId = member.id;
                    currentlyInVoice.add(userId);

                    const lastSeen = voiceTrackingState.get(userId);
                    voiceTrackingState.set(userId, now);

                    if (!lastSeen) continue;

                    const deltaSeconds = Math.floor((now - lastSeen) / 1000);
                    if (deltaSeconds > 0) {
                        await taskService.addVoiceSeconds(member, deltaSeconds);
                    }
                }
            }
        }

        // Clean up users no longer in voice
        for (const userId of voiceTrackingState.keys()) {
            if (!currentlyInVoice.has(userId)) {
                voiceTrackingState.delete(userId);
            }
        }
    } catch (err) {
        console.error('trackVoiceTaskProgress error:', err);
    }
}

function msUntilNextTenMinuteBoundary(now = Date.now()) {
    const date = new Date(now);
    const minutes = date.getMinutes();

    const minutesToAdd = 10 - (minutes % 10 || 10);
    const next = new Date(date);
    next.setSeconds(0, 0);
    next.setMinutes(minutes + minutesToAdd);

    return Math.max(0, next.getTime() - now);
}

async function sendActiveHeartbeat() {
    const channel = client.channels.cache.get(ACTIVE_CHANNEL_ID)
        || await client.channels.fetch(ACTIVE_CHANNEL_ID).catch(() => null);

    if (!channel || !channel.isTextBased()) {
        console.error(`[active-heartbeat] Channel ${ACTIVE_CHANNEL_ID} not found or not text-based.`);
        return;
    }

    await channel.send(`🔔 <@${OWNER_ID}> Bot is active.\n🔔 <@${OWNER_ID}> البوت شغال.\n────────────────────────`).catch((err) => {
        console.error('[active-heartbeat] Failed to send active message:', err?.message || err);
    });
}

async function notifyOwnerIfRecoveredFromCrash() {
    const pendingCrash = restartGuardService.consumePendingCrash();
    if (!pendingCrash) return;

    const channel = client.channels.cache.get(ACTIVE_CHANNEL_ID)
        || await client.channels.fetch(ACTIVE_CHANNEL_ID).catch(() => null);

    if (!channel || !channel.isTextBased()) {
        console.error(`[restart-guard] Cannot send recovery notice: channel ${ACTIVE_CHANNEL_ID} unavailable.`);
        return;
    }

    const crashTime = pendingCrash.timestamp ? new Date(pendingCrash.timestamp).toLocaleString('en-GB') : 'unknown';
    const crashType = pendingCrash.type || 'fatal_error';
    const crashMessage = pendingCrash.error?.message || 'Unknown error';

    const msg = [
        `⚠️ <@${OWNER_ID}> Bot recovered after an automatic restart.`,
        `🧯 Last crash type: **${crashType}**`,
        `🕒 Crash time: **${crashTime}**`,
        `🧾 Error: \`${String(crashMessage).slice(0, 250)}\``,
        `⚠️ <@${OWNER_ID}> تم إعادة تشغيل البوت تلقائياً بعد خطأ.`
    ].join('\n');

    await channel.send(msg).catch((err) => {
        console.error('[restart-guard] Failed to send recovery notice:', err?.message || err);
    });
}

function startActiveHeartbeatScheduler() {
    const delay = msUntilNextTenMinuteBoundary();
    console.log(`[active-heartbeat] Starting aligned scheduler in ${Math.ceil(delay / 1000)}s for channel ${ACTIVE_CHANNEL_ID}`);

    setTimeout(async () => {
        await sendActiveHeartbeat();

        setInterval(async () => {
            await sendActiveHeartbeat();
        }, ACTIVE_HEARTBEAT_INTERVAL_MS);
    }, delay);
}

client.on('clientReady', () => {
    console.log('Starting voice task progress tracker...');
    setInterval(trackVoiceTaskProgress, VOICE_PROGRESS_TICK_MS);
});

client.on('clientReady', () => {
    console.log('Starting blacklist expiry checker...');
    setInterval(() => {
        moderationService.checkExpiredBlacklists(client);
    }, BLACKLIST_CHECK_INTERVAL_MS);
});

client.on('clientReady', () => {
    console.log('Starting clan maintenance checker...');
    setInterval(() => {
        clanService.runClanMaintenance(client).catch((err) => {
            console.error('clan maintenance error:', err);
        });
    }, 60 * 60 * 1000);
});

client.on('clientReady', () => {
    startActiveHeartbeatScheduler();
});

client.on('clientReady', async () => {
    await notifyOwnerIfRecoveredFromCrash();
});

client.on('guildMemberAdd', async (member) => {
    try {
        await progressionService.syncMemberState(member, { allowRestoreFromDb: false });
    } catch (err) {
        console.error('guildMemberAdd progression sync error:', err);
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
        await moderationService.handleManualRemoval(oldMember, newMember);
        await progressionService.syncMemberState(newMember, { allowRestoreFromDb: false });
    } catch (err) {
        console.error('guildMemberUpdate progression sync error:', err);
    }
});

// ── interactions ──────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isButton())            return await handleButton(interaction);
        if (interaction.isStringSelectMenu())  return await handleSelect(interaction);
        if (interaction.isModalSubmit())       return await handleModal(interaction);
    } catch (err) {
        console.error('Interaction error:', err);
        try {
            const reply = { content: 'Something went wrong. حدث خطأ ما.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        } catch (e) {}
    }
});

// ── messages ──────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    try {
        const user = await db.getUser(message.author.id);
        user.lastActiveAt = Date.now();
        await db.saveUser(user);
    } catch (err) {
        console.error('lastActiveAt update error:', err);
    }

    const content = message.content.trim();
    const shouldCountForProgression = !content.startsWith('# ');

    const isCommandMessage = content.startsWith('%');

    if (content.startsWith('السلام')) {
        const phrases = ['نورت المكان', 'نورت السيرفر', 'أهلاً وسهلاً بك', 'سعداء بوجودك'];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        return message.reply(`وعليكم السلام ورحمة الله وبركاته\n**${phrase}** 🌟`);
    }

    if (content === 'سلام') {
        return message.reply('مع السلامة، عد مرة أخرى 👋');
    }

    if (content.startsWith('سلام')) {
        const phrases = ['نورت المكان', 'نورت السيرفر', 'يا هلا بالزين', 'أهلاً وسهلاً بك'];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        return message.reply(`**${phrase}** 🌟`);
    }

    const runMessageProgression = async () => {
        try {
            await progressionService.syncMemberState(message.member, { allowRestoreFromDb: false });
        } catch (err) {
            console.error('message progression sync error:', err);
        }

        try {
            const xpMultiplier = await progressionService.getXpMultiplierForMessage(message);
            await rewardService.handleRewards(message, { xpMultiplier });
            await taskService.handleMessageTask(message);
        } catch (err) {
            console.error('message reward/task error:', err);
        }
    };

    if (isCommandMessage) {
        if (shouldCountForProgression) {
            void runMessageProgression();
        }

        const args = content.slice(1).split(/ +/);
        const cmd = args.shift().toLowerCase();
        try {
            await commandHandler(client, message, cmd, args, OWNER_ID);
        } catch (err) {
            console.error('Command error:', err);
            message.reply('Error running that command. خطأ في تنفيذ الأمر.').catch(() => {});
        }

        return;
    }

    if (shouldCountForProgression) {
        await runMessageProgression();
    }
});

// ── start ─────────────────────────────────────────────────────
db.initDB()
    .then(() => client.login(process.env.DISCORD_TOKEN))
    .catch(err => { console.error('Startup failed:', err); process.exit(1); });
