# ArabastaBot Manual (Human + AI Context)

Last updated: 2026-04-17

## 1) Purpose

This document is a practical operating manual for ArabastaBot.
It is designed to help maintainers, contributors, and AI agents understand:

- what the bot does,
- how requests flow through the code,
- where data is stored,
- who can run which commands,
- and how to extend behavior safely.

## 2) Tech Stack and Runtime

- Runtime: Node.js (CommonJS)
- Main framework: discord.js v14
- Voice/music: @discordjs/voice, play-dl, @distube/ytdl-core, youtubei.js
- Storage: JSON files (no SQL DB)

Main entrypoint: main.js

Startup flow:
1. Load environment variables from .env.
2. Create Discord client with intents:
   - Guilds
   - GuildMessages
   - MessageContent
   - GuildVoiceStates
   - GuildMembers
3. Initialize data files via db.initDB().
4. Login with DISCORD_TOKEN.

## 3) Environment Variables

Required:
- DISCORD_TOKEN: bot token used by client.login().

Optional:
- OWNER_ID: owner user id. If missing, fallback default id is used in code.
- YT_DLP_PATH: explicit path to yt-dlp executable for music fallback.
- DENO_PATH: explicit path to deno executable (used with yt-dlp js runtime mode).

## 4) Message and Interaction Flow

### 4.1 Message Flow

Message event is handled in main.js.

Rules:
- Bot messages are ignored.
- Prefix for commands is %.
- Messages starting with "# " are excluded from progression counting.
- Arabic greeting shortcuts are handled directly in main.js.

If message is a command:
- Command is routed to commands/commandHandler.js.
- Progression/reward task update can still run (unless excluded by # prefix rule).

If message is not a command:
- Progression and reward logic runs through:
  - services/progressionService.js
  - services/rewardService.js
  - services/taskService.js

### 4.2 Interaction Flow (Buttons, Selects, Modals)

The interactionCreate event in main.js routes to:
- interactions/buttons.js
- interactions/selects.js
- interactions/modals.js

Interaction customId pattern is namespace-based, for example:
- music:...
- pay:confirm:...
- give:claim:...
- progression:...
- shop:...
- bank:...
- convert:...
- gold_credit:...

Important behavior:
- Some actions must call showModal as the first response.
- Permission checks are enforced by service handlers and interaction routers.

## 5) Command System

Command entrypoint: commands/commandHandler.js

### 5.1 Command Normalization

- Aliases are normalized to canonical command names.
- Example: b -> bank, s -> shop, p -> profile, t -> tasks, lb -> leaderboard.

### 5.2 Access Model

There are 4 effective access tiers:

1. Public commands:
   - help, man, ping, play, song, profile, tasks, leaderboard, convert

2. Authorized or admin commands:
   - commands
   - Server admins can access command list view.
   - Authorized users (bank_access=true) can access restricted operations.

3. Authorized commands:
   - bank, shop, pay, give, specialty, prestige, rebirth, setlevel, setxp, log, logtransaction, logcommands

4. Owner-only commands:
   - owner, permission, showbanklog, logtransactionreset, logcommandsreset,
     reseteverything, disablecommand, enablecommand,
     disableallcommands, enableallcommands, enableqa, disableqa, qalist

Advanced owner operations are implemented in services/ownerOpsService.js.
Some advanced operations are available to QA users depending on policy.

### 5.3 Built-in Manual Command

- %man <command> displays per-command manual info from commands/manual.js.
- Access to a manual page is filtered by the same permission model.

## 6) Economy and Currency Model

Files involved:
- services/bankService.js
- services/shopService.js
- services/payService.js
- db.js

Core currencies:
- gold
- gems
- honor

Important internal representation detail:
- Gold is commonly stored in internal units where 10 internal = 1 display gold.
- Gems and honor are stored 1:1.

Implications:
- When adding features, always verify whether value is internal or display.
- payService and ownerOpsService contain explicit conversion helpers.

## 7) Progression and Tasks

Primary files:
- services/progressionService.js
- config/progressionConfig.js
- services/rewardService.js
- services/taskService.js
- services/levelUpAnnounceService.js

### 7.1 Reward Loop

rewardService:
- 1-minute cooldown for message reward tick.
- Adds gold (internal units) and XP per tick.
- Applies daily gold cap (default vs clan role cap).
- Handles level-up loop where XP threshold is 100 * currentLevel.

### 7.2 Daily Tasks

taskService tracks:
- Daily message target (100)
- Daily voice target (10 minutes)
- Bonus grants for completion

Voice progress is updated by a periodic tracker in main.js.

### 7.3 Role-Based Progression

progressionService + progressionConfig manage:
- route roles,
- specialty roles,
- prestige tiers,
- rebirth tiers,
- route/specialty channel visibility,
- verified role gate.

Admins are excluded from the route system logic (while still earning XP/levels).

## 8) Music System

Main files:
- commands/music.js
- services/music/playerService.js
- services/music/queueManager.js
- services/music/streamHandler.js

Highlights:
- Supports play/queue behavior and control interactions.
- Uses layered strategy for resolving playable streams.
- streamHandler includes yt-dlp fallback and executable resolution helpers.

Operational note:
- On Windows, setting YT_DLP_PATH (and optionally DENO_PATH) improves reliability.

## 9) Data Storage and Files

All persistent data is JSON-based under data/.

Core files:
- data/users.json: primary user state
- data/bank.json: bank balances
- data/products.json: product catalog
- data/bank_log.json: bank action log
- data/conversion_log.json: conversion log
- data/transaction_log.json: capped transaction log
- data/command_log.json: capped command usage log
- data/qa_users.json: QA users list
- data/qa_audit_log.json: QA audit records
- data/qa_features.json: QA feature flags
- data/runtime_state.json: crash/restart guard state

DB layer: db.js

DB behavior:
- Creates missing files automatically.
- Recovers corrupted JSON by recreating with defaults.
- Uses temp-file atomic writes for safety.
- Batches some saves with short delay for reduced IO churn.

## 10) Operational Background Jobs

Defined in main.js:

- GIF role expiry cleanup interval (60s):
  - Removes expired GIF role assignments.
  - Clears user expiry metadata.

- Voice task progress tracker interval (30s):
  - Tracks active users in voice channels.
  - Converts elapsed presence into task voice seconds.

- Active heartbeat scheduler:
  - Sends periodic "bot is active" message to a configured channel.
  - Scheduler aligns to ten-minute boundaries.

- Crash recovery notice:
  - restartGuardService persists fatal crash info.
  - Bot notifies owner/channel after automatic recovery.

## 11) Owner and QA Operations

Advanced operations live in services/ownerOpsService.js.

Examples of advanced operations:
- status, eval
- shutdown, restart, update
- exportdb, importdb
- resetuser, transferall, giveall
- viewlogs, clearspecificlog
- alert, simulate
- forceprestige, forcerebirth
- reloadcommand, togglefeature

QA controls live in services/qaAccessService.js:
- Add/remove QA users
- QA audit logging
- Feature flags

## 12) How to Run Locally

1. Install dependencies:
   - npm install

2. Create .env at project root with at least:
   - DISCORD_TOKEN=...
   - OWNER_ID=... (recommended)

3. Start bot:
   - node main.js

Optional with reload tools:
- nodemon configuration exists in nodemon.json (ignores data and guide folders).

## 13) How to Add or Modify a Command Safely

1. Implement behavior in an existing command module (or add a new one under commands/).
2. Wire routing in commands/commandHandler.js.
3. Add alias mapping in COMMAND_ALIAS_TO_CANONICAL.
4. Classify command into the appropriate access set.
5. Add manual entry in commands/manual.js so %man can describe it.
6. If command affects economy/progression, log actions in db logs.
7. Validate interaction and permission checks.

## 14) Common Pitfalls

- Gold unit mismatch (internal vs display).
- Forgetting to update manual/aliases when adding command names.
- Showing modal after deferring interaction (invalid flow for modal-first actions).
- Relying only on in-memory disabled command state (resets on process restart).
- Confusing owner-only commands with authorized/admin-visible menus.

## 15) AI Agent Quick Context Map

If you are an AI agent working on this repository, start with:

1. Routing and lifecycle:
   - main.js
   - commands/commandHandler.js

2. Data model:
   - db.js
   - data/users.json

3. Permission and operations:
   - commands/permission.js
   - services/ownerOpsService.js
   - services/qaAccessService.js

4. Economy and interactions:
   - services/bankService.js
   - services/shopService.js
   - services/payService.js
   - interactions/buttons.js
   - interactions/modals.js
   - interactions/selects.js

5. Progression and tasks:
   - services/progressionService.js
   - config/progressionConfig.js
   - services/rewardService.js
   - services/taskService.js

6. Music:
   - commands/music.js
   - services/music/playerService.js
   - services/music/streamHandler.js

This sequence gives the fastest complete understanding of bot behavior.
