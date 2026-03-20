// ...existing code...
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const db = require('./db');

const prefix = process.env.PREFIX || '%';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Global handlers
client.on('error', console.error);
process.on('unhandledRejection', (r) => console.error('Unhandled Rejection:', r));
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

// Initialize DB then login
db.initDB()
    .then(() => {
        console.log('Lowdb initialized ✅');
        client.login(process.env.DISCORD_TOKEN).catch(err => {
            console.error('Discord login failed:', err);
            process.exit(1);
        });
    })
    .catch(err => {
        console.error('DB init failed, aborting startup:', err);
        process.exit(1);
    });

// Bot ready — use clientReady to avoid deprecation warning
client.once('clientReady', () => {
    console.log('ArabastaBot is Online!');
    if (client.user) client.user.setActivity('Watching Arabasta 👑');
});

// Message handler
client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot) return; // Ignore bots

        const content = message.content.trim();
        const firstWord = content.toLowerCase().split(/\s+/)[0];

        // === COMMANDS ===
        if (content.startsWith(prefix)) {
            const args = content.slice(prefix.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            // --- Ping ---
            if (command === 'ping') return message.channel.send('**Pong!**');

            // --- Profile ---
            if (command === 'p' || command === 'profile') {
                const targetUser = message.mentions.users.first() || message.author;
                const user = await db.getUser(targetUser.id);

                const profileEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`${targetUser.username}'s Profile`)
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        { name: 'Level', value: `${user.level}`, inline: true },
                        { name: 'XP', value: `${user.xp} / ${100 * user.level}`, inline: true },
                        { name: 'Gold', value: `${user.gold / 10}`, inline: true },
                        { name: 'Gems', value: `${user.gems}`, inline: true },
                        { name: 'Honor', value: `${user.honor}`, inline: true }
                    )
                    .setFooter({ text: 'ArabastaBot • Profile Info' })
                    .setTimestamp();

                return message.channel.send({ embeds: [profileEmbed] });
            }

            // --- Leaderboard ---
            if (command === 'leaderboard' || command === 'lb') {
                const field = args[0] || 'xp';
                const topUsers = await db.getLeaderboard(field, 10);

                // Build the embed fields
                const fields = [];
                for (let i = 0; i < topUsers.length; i++) {
                    const u = topUsers[i];
                    let displayName = 'Unknown';
                    try {
                        const discordUser = await client.users.fetch(u.user_id);
                        displayName = `<@${discordUser.id}>`;
                    } catch {}

                    let value;
                    if (field === 'xp') {
                        value = `XP: ${u.totalField} (Level ${u.level})`;
                    } else {
                        value = `${field.toUpperCase()}: ${u[field] ?? 0}`;
                    }

                    fields.push({ name: `${i + 1}. ${displayName}`, value, inline: false });
                }

                const lbEmbed = new EmbedBuilder()
                    .setTitle(`Top 10 by ${field}`)
                    .setColor('#FFD700')
                    .addFields(fields);

                return message.channel.send({ embeds: [lbEmbed] });
            }
        }

        // === GREETINGS ===
        if (content.toLowerCase() === 'سلام') {
            return message.reply('**وعليكم السلام، في أمان الله، نراك على خير**');
        }
        if (firstWord === 'سلام' || firstWord === 'السلام') {
            const greetings = ['**نورت المكان**', '**نورت السيرفر**', '**سعداء بوجودك**', '**أهلاً وسهلاً بك**'];
            const gifs = ['<a:squish:1358122025016758444>'];
            const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
            const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
            message.reply(`**وعليكم السلام و رحمة الله و بركاته**\n${randomGreeting}\n${randomGif}`);
        }

        // === ECONOMY / LEVELING ===
        const user = await db.getUser(message.author.id);

        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;

        // Daily reset
        if (!user.last_daily_reset || now - user.last_daily_reset >= ONE_DAY) {
            user.daily_gold_earned = 0;
            user.last_daily_reset = now;
        }

        // Rewards
        const COOLDOWN = 60 * 1000;
        const DAILY_CAP = 350 * 10;
        const GOLD_REWARD = 7.5 * 10;

        if (!user.last_reward_time || (now - user.last_reward_time >= COOLDOWN && user.daily_gold_earned < DAILY_CAP)) {
            let goldToGive = GOLD_REWARD;
            if (user.daily_gold_earned + goldToGive > DAILY_CAP) goldToGive = DAILY_CAP - user.daily_gold_earned;

            user.gold += goldToGive;
            user.daily_gold_earned += goldToGive;
            user.xp += 15;
            user.last_reward_time = now;

            console.log(`${message.author.tag} got reward: +15 XP, +${goldToGive / 10} Gold`);
        }

        // Level up
        let requiredXP = 100 * user.level;
        while (user.xp >= requiredXP) {
            user.xp -= requiredXP;
            user.level += 1;
            console.log(`${message.author.tag} leveled up to ${user.level}`);
            requiredXP = 100 * user.level;
        }

        await db.saveUser(user);
    } catch (err) {
        console.error('Error in message handler:', err);
    }
});