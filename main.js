require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,          // basic guild info
    GatewayIntentBits.GuildMessages,   // to read messages
    GatewayIntentBits.MessageContent   // to access message content
  ]
});

client.once('ready', () => {
    console.log('ArabastaBot is Online!');
    client.user.setActivity('Watching Arabasta 👑');
});
client.on('messageCreate', (message) => {
    if (message.content.toLowerCase() === 'ping') {
        message.channel.send('Pong! ArabastaSystem works ✅');
    }
});




client.login(process.env.DISCORD_TOKEN)