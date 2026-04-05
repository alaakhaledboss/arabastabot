require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('./db');

const handleButton  = require('./interactions/buttons');
const handleSelect  = require('./interactions/selects');
const handleModal   = require('./interactions/modals');
const commandHandler = require('./commands/commandHandler');
const rewardService = require('./services/rewardService');
const taskService = require('./services/taskService');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const OWNER_ID = process.env.OWNER_ID || '1156642624770424902';

// Background cleanup interval (ms)
const GIF_CLEANUP_INTERVAL_MS = 60 * 1000; // run every 60s
const VOICE_PROGRESS_TICK_MS = 30 * 1000;  // award voice task progress every 30s

// Lazy require of shopService to avoid circular dependency at module load
const shopService = require('./services/shopService');

// ── error guards ──────────────────────────────────────────────
client.on('error', console.error);
process.on('unhandledRejection', console.error);
process.on('uncaughtException', (err) => { console.error(err); process.exit(1); });

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
                        await taskService.addVoiceSeconds(userId, deltaSeconds);
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

client.on('clientReady', () => {
    console.log('Starting voice task progress tracker...');
    setInterval(trackVoiceTaskProgress, VOICE_PROGRESS_TICK_MS);
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

    const content = message.content.trim();

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

    await rewardService.handleRewards(message);
    await taskService.handleMessageTask(message);

    if (content.startsWith('%')) {
        const args = content.slice(1).split(/ +/);
        const cmd = args.shift().toLowerCase();
        try {
            await commandHandler(client, message, cmd, args, OWNER_ID);
        } catch (err) {
            console.error('Command error:', err);
            message.reply('Error running that command. خطأ في تنفيذ الأمر.').catch(() => {});
        }
    }
});

// ── start ─────────────────────────────────────────────────────
db.initDB()
    .then(() => client.login(process.env.DISCORD_TOKEN))
    .catch(err => { console.error('Startup failed:', err); process.exit(1); });
