const db = require('../db');
const { EmbedBuilder } = require('discord.js');

// Import command modules
const bankCmd = require('./bank');
const shopCmd = require('./shop');
const miscCmd = require('./misc');
const profileCmd = require('./profile');
const leaderboardCmd = require('./leaderboard');
const permissionCmd = require('./permission');
const productCmd = require('./product');

async function showHelp(message) {
    try {
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('📖 ArabastaBot Commands')
            .setDescription('User-accessible commands')
            .addFields(
                {
                    name: '� User Profile',
                    value: '`%p` or `%profile` [@user] - View your or someone\'s profile',
                    inline: false
                },
                {
                    name: '🏆 Rankings',
                    value: '`%lb` or `%leaderboard` [field] - View top 10 players\n**Fields:** `xp`, `gold`, `gems`, `honor`',
                    inline: false
                },
                {
                    name: '🛍️ Shop',
                    value: '`%s` or `%shop` - Browse and buy products',
                    inline: false
                },
                {
                    name: '💰 Bank',
                    value: '`%b` or `%bank` - Access bank (if authorized)',
                    inline: false
                },
                {
                    name: '🔧 Utility',
                    value: '`%ping` - Check if bot is online',
                    inline: false
                }
            )
            .setFooter({ text: 'Type %command for admin commands' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    } catch (err) {
        console.error('showHelp error:', err);
        return message.reply('❌ Error displaying help. خطأ في عرض المساعدة.').catch(() => {});
    }
}

async function showAllCommands(message, OWNER_ID) {
    try {
        const isOwner = message.author.id === OWNER_ID;
        
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('📖 ArabastaBot - All Commands')
            .setDescription('Complete command reference')
            .addFields(
                {
                    name: '👤 User Profile',
                    value: '`%p` or `%profile` [@user] - View profile stats\n`%lb` or `%leaderboard` [field] - View rankings',
                    inline: false
                },
                {
                    name: '🛍️ Shop System',
                    value: '`%s` or `%shop` - Open shop menu\nBrowse products, check prices, manage inventory',
                    inline: false
                },
                {
                    name: '💰 Bank System',
                    value: '`%b` or `%bank` - Open bank menu\nView balance, withdraw, deposit gold',
                    inline: false
                },
                {
                    name: '🔧 Utility',
                    value: '`%ping` - Check bot responsiveness\n`%help` - Show user commands\n`%command` - Show all commands',
                    inline: false
                }
            );

        if (isOwner) {
            embed.addFields(
                {
                    name: '👑 Owner Commands (Admin Only)',
                    value: '`%a @user` - Grant user bank access\n`%da @user` - Revoke user bank access\n`%ap` or `%addproduct` - Add new shop product',
                    inline: false
                }
            );
        }

        embed.setFooter({ text: isOwner ? 'You are the owner' : 'Contact owner for admin access' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    } catch (err) {
        console.error('showAllCommands error:', err);
        return message.reply('❌ Error displaying commands. خطأ في عرض الأوامر.').catch(() => {});
    }
}

module.exports = async function (client, message, cmd, args, OWNER_ID) {
    try {
        // Validate message object
        if (!message || !message.author || typeof message.reply !== 'function') {
            console.error('Invalid message object passed to commandHandler.');
            return;
        }

        if (!cmd) return; // silently ignore empty commands

        switch (cmd) {
            case 'help':
                return await showHelp(message);

            case 'command':
            case 'commands':
            case '':
                return await showAllCommands(message, OWNER_ID);

            case 'b':
            case 'bank':
                return await bankCmd(message, OWNER_ID);

            case 's':
            case 'shop':
                return await shopCmd(message);

            case 'ping':
                return miscCmd.ping(message);

            case 'p':
            case 'profile':
                return await profileCmd(message, args);

            case 'lb':
            case 'leaderboard':
                return await leaderboardCmd(message, args);

            case 'a':
            case 'da':
                return await permissionCmd.handlePermission(message, cmd, args, OWNER_ID);

            case 'ap':
            case 'addproduct':
                return await productCmd.addProduct(message, args, OWNER_ID);

            default:
                return message.reply(`❌ Unknown command. Type \`%help\` for user commands or \`%command\` for all commands.`);
        }
    } catch (err) {
        console.error('Command execution error:', err);
        if (message && typeof message.reply === 'function') {
            return message.reply('❌ Error running that command. خطأ في تنفيذ الأمر.').catch(() => {});
        }
    }
};