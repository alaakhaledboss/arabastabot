// ====================
// === GENERAL COMMAND TEMPLATE ===
// ====================

// This function listens for any message that starts with your command prefix
if (content.startsWith(prefix)) {

    // Split message into arguments:
    // Example: "%example arg1 arg2" => command = "example", args = ["arg1", "arg2"]
    const args = content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // --- Replace 'example' with your actual command keyword ---
    if (command === 'example') {

        // Step 1: Determine target user or entity
        // This is generic: either a mentioned user or the message author
        const targetUser = message.mentions.users.first() || message.author;

        // Step 2: Fetch user data from the database (LowDB in your case)
        // If the user does not exist yet, create a default object and save it
        let user = await getUser(targetUser.id);
        if (!user) {
            user = {
                user_id: targetUser.id,
                level: 1,
                xp: 0,
                gold: 0,
                gems: 0,
                honor: 0,
                last_reward_time: 0,
                daily_gold_earned: 0,
                last_daily_reset: 0
            };
            await saveUser(user);
            console.log(`Created new user: ${targetUser.tag}`);
        }

        // Step 3: Create a canvas if your command outputs an image
        // Load your fixed background image (replace with your file)
        const { createCanvas, loadImage } = require('@napi-rs/canvas');
        const bg = await loadImage('./images/CommandBackground.png');

        // Create canvas with same size as the background image
        const canvas = createCanvas(bg.width, bg.height);
        const ctx = canvas.getContext('2d');

        // Draw background
        ctx.drawImage(bg, 0, 0);

        // Step 4: Configure text style
        ctx.fillStyle = '#000000';            // Black text
        ctx.font = 'bold 23px sans-serif';    // Bold, smaller font
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; // Dark shadow for clarity
        ctx.shadowBlur = 5;                   // Shadow blur
        ctx.shadowOffsetX = 2;                // Horizontal offset
        ctx.shadowOffsetY = 2;                // Vertical offset

        // Step 5: Draw any information on the image
        const startY = 50;    // Top margin
        const lineHeight = 35; // Space between lines
        ctx.fillText(`Name: ${targetUser.username}`, 50, startY);
        ctx.fillText(`Level: ${user.level}`, 50, startY + lineHeight);
        ctx.fillText(`XP: ${user.xp} / ${100 * user.level}`, 50, startY + lineHeight * 2);
        ctx.fillText(`Gold: ${user.gold / 10}`, 50, startY + lineHeight * 3);
        ctx.fillText(`Gems: ${user.gems}`, 50, startY + lineHeight * 4);
        ctx.fillText(`Honor: ${user.honor}`, 50, startY + lineHeight * 5);

        // Step 6: Convert canvas to buffer and send as a message
        const buffer = canvas.toBuffer('image/png');
        return message.channel.send({ files: [buffer] });
    }

    // ====================
    // === NOTES / TIPS ===
    // ====================
    // - This template works for any command that wants to:
    //    1) Grab user info (or any target entity)
    //    2) Fetch / create database data
    //    3) Generate an image using a fixed background
    //    4) Draw dynamic text with styling (shadow, font, spacing)
    //    5) Send the result to the channel
    //
    // - To create new commands, copy this structure and just:
    //    • Change 'example' to the new command name
    //    • Customize what text or graphics you want drawn
    //    • Optionally add extra logic (like calculations, XP, rewards)
    //
    // - Line spacing and shadow settings can be adjusted globally to all commands
    //   for a consistent look across your bot's image commands.
}