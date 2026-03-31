require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('./db');

const handleButton  = require('./interactions/buttons');
const handleSelect  = require('./interactions/selects');
const handleModal   = require('./interactions/modals');
const commandHandler = require('./commands/commandHandler');
const rewardService = require('./services/rewardService');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const OWNER_ID = process.env.OWNER_ID || '1156642624770424902';

// ── error guards ──────────────────────────────────────────────
client.on('error', console.error);
process.on('unhandledRejection', console.error);
process.on('uncaughtException', (err) => { console.error(err); process.exit(1); });

// ── ready ─────────────────────────────────────────────────────
client.once('clientReady', () => {
    console.log(`✅ ${client.user.tag} is online!`);
    client.user.setActivity('Watching Arabasta 👑');
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
        const phrases = ['نورت المكان', 'نورت السيرفر', 'يا هلا بالزين', 'أهلاً وسهلاً بك', 'سعداء بوجودك'];
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
