const { EmbedBuilder } = require('discord.js');

const MANUALS = {
    man: {
        title: '%man <command>',
        functionality: 'Shows command manual only if you are allowed to use that command.',
        structure: '`%man <command>`',
        examples: ['`%man p`', '`%man pay`', '`%man shutdown`']
    },
    help: {
        title: '%help',
        functionality: 'Shows public command menu.',
        structure: '`%help`',
        examples: ['`%help`']
    },
    commands: {
        title: '%command / %commands',
        functionality: 'Shows restricted command menu for authorized/admin users.',
        structure: '`%command`',
        examples: ['`%commands`']
    },
    owner: {
        title: '%owner',
        functionality: 'Shows owner-only command menu.',
        structure: '`%owner`',
        examples: ['`%owner`']
    },
    bank: {
        title: '%bank / %b',
        functionality: 'Opens bank panel (balance, withdraw, deposit controls).',
        structure: '`%bank`',
        examples: ['`%b`']
    },
    shop: {
        title: '%shop / %s',
        functionality: 'Opens shop panel and product actions.',
        structure: '`%shop`',
        examples: ['`%s`']
    },
    ping: {
        title: '%ping',
        functionality: 'Checks bot responsiveness.',
        structure: '`%ping`',
        examples: ['`%ping`']
    },
    play: {
        title: '%play <query>',
        functionality: 'Searches/queues a track and starts playback if idle.',
        structure: '`%play <search query or URL>`',
        examples: ['`%play naruto opening`', '`%play https://youtu.be/...`']
    },
    song: {
        title: '%song <query>',
        functionality: 'Finds a YouTube URL from a query and sends only the URL in chat (no playback).',
        structure: '`%song <search query or YouTube URL>`',
        examples: ['`%song naruto opening`', '`%song https://youtu.be/...`']
    },
    pay: {
        title: '%pay',
        functionality: 'Creates manual transfer request pending approver confirmation.',
        structure: '`%pay gold|gems|honor @user <amount>`',
        examples: ['`%pay gold @User 500`']
    },
    give: {
        title: '%give',
        functionality: 'Creates bank-funded give request claimed by recipient button.',
        structure: '`%give gold|gems|honor @user <amount>`',
        examples: ['`%give gems @User 3`']
    },
    specialty: {
        title: '%specialty',
        functionality: 'Opens specialty selection flow for progression route.',
        structure: '`%specialty <name>`',
        examples: ['`%specialty duelist`']
    },
    prestige: {
        title: '%prestige',
        functionality: 'Starts prestige route selection/confirmation flow.',
        structure: '`%prestige <route>`',
        examples: ['`%prestige combat`']
    },
    rebirth: {
        title: '%rebirth',
        functionality: 'Starts rebirth route flow.',
        structure: '`%rebirth <route>`',
        examples: ['`%rebirth scholar`']
    },
    setlevel: {
        title: '%setlevel',
        functionality: 'Sets target user level and resets XP to 0.',
        structure: '`%setlevel @user <positive integer>`',
        examples: ['`%setlevel @User 25`']
    },
    setxp: {
        title: '%setxp',
        functionality: 'Sets target user XP inside current level cap.',
        structure: '`%setxp @user <non-negative integer>`',
        examples: ['`%setxp @User 40`']
    },
    warn: {
        title: '%warn',
        functionality: 'Adds one warning to a user. At 3 warnings, user is blacklisted for 7 days.',
        structure: '`%warn @user`',
        examples: ['`%warn @User`']
    },
    profile: {
        title: '%profile / %p',
        functionality: 'Shows profile card (level, route, balances).',
        structure: '`%profile [@user]`',
        examples: ['`%p`', '`%profile @User`']
    },
    tasks: {
        title: '%tasks / %task / %t',
        functionality: 'Shows daily task progress.',
        structure: '`%tasks`',
        examples: ['`%t`']
    },
    leaderboard: {
        title: '%leaderboard / %lb',
        functionality: 'Shows top users by selected field.',
        structure: '`%leaderboard [xp|gold|gems|honor]`',
        examples: ['`%lb`', '`%lb honor`']
    },
    permission: {
        title: '%a / %da',
        functionality: 'Owner grants/revokes special authorization.',
        structure: '`%a @user` | `%da @user`',
        examples: ['`%a @User`', '`%da @User`']
    },
    convert: {
        title: '%convert',
        functionality: 'Converts keyboard-layout text (English/Arabic).',
        structure: '`%convert [@user]` or reply to message with `%convert`',
        examples: ['`%convert`', '`%convert @User`']
    },
    showbanklog: {
        title: '%showbanklog',
        functionality: 'Shows latest bank log entries.',
        structure: '`%showbanklog`',
        examples: ['`%showbanklog`']
    },
    clan: {
        title: '%clan',
        functionality: 'Opens the clan system menu and clan management actions.',
        structure: '`%clan [admincreate|menu|status|leave|list|disband]`',
        examples: ['`%clan`', '`%clan admincreate @Leader @Deputy "Blue Tide" @Member3 @Member4`']
    },
    hunt: {
        title: '%hunt',
        functionality: 'Runs a forest or lake hunt and awards materials or gear.',
        structure: '`%hunt [forest|lake]`',
        examples: ['`%hunt forest`', '`%hunt lake`']
    },
    gear: {
        title: '%gear',
        functionality: 'Shows gear inventory and equipment management.',
        structure: '`%gear [status|inventory|equip|unequip]`',
        examples: ['`%gear status`', '`%gear equip weapon forest_dark_sword`']
    },
    craft: {
        title: '%craft',
        functionality: 'Opens the Atelier crafting panel and clan contribution buttons.',
        structure: '`%craft`',
        examples: ['`%craft`']
    },
    sell: {
        title: '%sell',
        functionality: 'Creates a merchant sale listing with a buy button.',
        structure: '`%sell <item> <price>`',
        examples: ['`%sell Dark Forest Sword 2500`']
    },
    log: {
        title: '%log',
        functionality: 'Shows conversion log.',
        structure: '`%log`',
        examples: ['`%log`']
    },
    logtransaction: {
        title: '%logtransaction',
        functionality: 'Shows transaction log pages.',
        structure: '`%logtransaction`',
        examples: ['`%logtransaction`']
    },
    logtransactionreset: {
        title: '%logtransactionreset',
        functionality: 'Clears transaction log.',
        structure: '`%logtransactionreset`',
        examples: ['`%logtransactionreset`']
    },
    logcommands: {
        title: '%logcommands',
        functionality: 'Shows command usage log pages.',
        structure: '`%logcommands`',
        examples: ['`%logcommands`']
    },
    logcommandsreset: {
        title: '%logcommandsreset',
        functionality: 'Clears command usage log.',
        structure: '`%logcommandsreset`',
        examples: ['`%logcommandsreset`']
    },
    reseteverything: {
        title: '%reseteverything',
        functionality: 'Resets all user/system economy data.',
        structure: '`%reseteverything`',
        examples: ['`%reseteverything`']
    },
    disablecommand: {
        title: '%disablecommand',
        functionality: 'Disables one command globally.',
        structure: '`%disablecommand <commandName>`',
        examples: ['`%disablecommand play`']
    },
    enablecommand: {
        title: '%enablecommand',
        functionality: 'Re-enables one disabled command.',
        structure: '`%enablecommand <commandName>`',
        examples: ['`%enablecommand play`']
    },
    disableallcommands: {
        title: '%disableallcommands',
        functionality: 'Locks all non-protected commands.',
        structure: '`%disableallcommands`',
        examples: ['`%disableallcommands`']
    },
    enableallcommands: {
        title: '%enableallcommands',
        functionality: 'Removes global command lock.',
        structure: '`%enableallcommands`',
        examples: ['`%enableallcommands`']
    },
    enableqa: {
        title: '%enableqa',
        functionality: 'Adds a user to QA access list.',
        structure: '`%enableqa @user`',
        examples: ['`%enableqa @User`']
    },
    disableqa: {
        title: '%disableqa',
        functionality: 'Removes a user from QA access list.',
        structure: '`%disableqa @user`',
        examples: ['`%disableqa @User`']
    },
    qalist: {
        title: '%qalist',
        functionality: 'Shows all QA users.',
        structure: '`%qalist`',
        examples: ['`%qalist`']
    },
    status: {
        title: '%status',
        functionality: 'Shows bot runtime/system status.',
        structure: '`%status`',
        examples: ['`%status`']
    },
    eval: {
        title: '%eval',
        functionality: 'Executes JavaScript expression in bot runtime.',
        structure: '`%eval <javascript>`',
        examples: ['`%eval process.uptime()`']
    },
    shutdown: {
        title: '%shutdown',
        functionality: 'Stops bot process.',
        structure: '`%shutdown`',
        examples: ['`%shutdown`']
    },
    restart: {
        title: '%restart',
        functionality: 'Restarts bot process (exit code 1).',
        structure: '`%restart`',
        examples: ['`%restart`']
    },
    update: {
        title: '%update',
        functionality: 'Runs git fast-forward pull.',
        structure: '`%update`',
        examples: ['`%update`']
    },
    exportdb: {
        title: '%exportdb',
        functionality: 'Exports DB file(s) as attachment.',
        structure: '`%exportdb all|users|bank|products|banklog|conversionlog|transactionlog|commandlog`',
        examples: ['`%exportdb all`', '`%exportdb users`']
    },
    importdb: {
        title: '%importdb',
        functionality: 'Imports DB file from attached JSON.',
        structure: '`%importdb users|bank|products|banklog|conversionlog|transactionlog|commandlog` + attach `.json` file',
        examples: ['`%importdb users` (with attachment)']
    },
    resetuser: {
        title: '%resetuser',
        functionality: 'Resets one user to default progression/economy state.',
        structure: '`%resetuser @user`',
        examples: ['`%resetuser @User`']
    },
    transferall: {
        title: '%transferall',
        functionality: 'Transfers full balance from one user to another.',
        structure: '`%transferall gold|gems|honor @from @to` OR `%transferall @from @to` (gold default)',
        examples: ['`%transferall @User1 @User2`', '`%transferall gems @User1 @User2`']
    },
    alert: {
        title: '%alert',
        functionality: 'Broadcasts owner/QA alert message.',
        structure: '`%alert [#channel] <message>`',
        examples: ['`%alert Maintenance in 10 min`', '`%alert #announcements Restart completed`']
    },
    simulate: {
        title: '%simulate',
        functionality: 'Runs dry simulation for rewards/action with no data mutation.',
        structure: '`%simulate @user <messageCount|action>`',
        examples: ['`%simulate @User 25`', '`%simulate @User rebirth`']
    },
    forceprestige: {
        title: '%forceprestige',
        functionality: 'Forces prestige state for user.',
        structure: '`%forceprestige @user [combat|scholar|atelier|merchant]`',
        examples: ['`%forceprestige @User`', '`%forceprestige @User merchant`']
    },
    forcerebirth: {
        title: '%forcerebirth / %forcerrebirth',
        functionality: 'Forces rebirth state for user.',
        structure: '`%forcerebirth @user [combat|scholar|atelier|merchant]`',
        examples: ['`%forcerrebirth @User`', '`%forcerebirth @User combat`']
    },
    giveall: {
        title: '%giveall',
        functionality: 'Gives currency from bank to all users or one role.',
        structure: '`%giveall gold|gems|honor <amount> [@role]`',
        examples: ['`%giveall gold 10`', '`%giveall gems 2 @Role`']
    },
    viewlogs: {
        title: '%viewlogs',
        functionality: 'Shows last entries from selected log type.',
        structure: '`%viewlogs bank|conversion|transaction|command|qa`',
        examples: ['`%viewlogs qa`']
    },
    clearspecificlog: {
        title: '%clearspecificlog',
        functionality: 'Clears N entries from a selected log type.',
        structure: '`%clearspecificlog bank|conversion|transaction|command|qa <amount>`',
        examples: ['`%clearspecificlog transaction 50`']
    },
    reloadcommand: {
        title: '%reloadcommand',
        functionality: 'Reloads one command file from require cache.',
        structure: '`%reloadcommand <commandFileName>`',
        examples: ['`%reloadcommand profile`']
    },
    togglefeature: {
        title: '%togglefeature',
        functionality: 'Toggles a named feature flag in QA features storage.',
        structure: '`%togglefeature <featureName>`',
        examples: ['`%togglefeature xpboost`']
    }
};

function getManual(commandName) {
    const key = String(commandName || '').trim().toLowerCase();
    return MANUALS[key] || null;
}

function buildManualEmbed({ commandName, manual, requesterTag }) {
    return new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`📘 Manual: %${commandName}`)
        .addFields(
            { name: 'Functionality', value: manual.functionality || '—', inline: false },
            { name: 'Structure', value: manual.structure || '—', inline: false },
            { name: 'Examples', value: (manual.examples || ['—']).join('\n'), inline: false }
        )
        .setFooter({ text: `Requested by ${requesterTag || 'unknown user'}` })
        .setTimestamp();
}

module.exports = {
    getManual,
    buildManualEmbed
};
