/**
 * GUIDE FILE ONLY  (NON-EXECUTABLE)
 *
 * This file intentionally exports a string template so it can never crash the bot
 * even if it is accidentally required/imported at runtime.
 */

module.exports = `
GENERAL COMMAND TEMPLATE
========================

1) Parse command and args from message content.
2) Resolve target user (mention or author).
3) Load/create user record in DB.
4) (Optional) Build image/canvas output.
5) Send result to channel.

Example flow:
- if (content.startsWith(prefix)) {
-   const args = content.slice(prefix.length).trim().split(/ +/);
-   const command = args.shift().toLowerCase();
-   if (command === 'example') { ... }
- }

Notes:
- Keep runtime code in real command files under /commands.
- Keep this file as documentation only.
`;