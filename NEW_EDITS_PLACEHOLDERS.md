# New Gameplay Edits

This file summarizes the new gameplay additions and the values that still need to be filled in.

## What was added

- Clan system scaffold
- Hunting system scaffold
- Gear/inventory system scaffold
- Admin clan registration via `%clan admincreate`
- 20-minute hunting cooldown and channel checks
- Profile now shows equipped gear
- Bot help/manual now includes `%clan`, `%hunt`, and `%gear`
- User data now persists gear, materials, hunting cooldowns, and clan info

## Files added

- `config/gameplayConfig.js`
- `services/clanService.js`
- `services/huntingService.js`
- `services/gearService.js`
- `commands/clan.js`
- `commands/hunt.js`
- `commands/gear.js`

## Files updated

- `db.js`
- `commands/commandHandler.js`
- `commands/manual.js`
- `commands/profile.js`
- `services/rewardService.js`
- `services/taskService.js`
- `services/ownerOpsService.js`

## Placeholders you must upload

Put the real Discord IDs into `config/gameplayConfig.js`:

- `CHANNELS.clanPanel` -> clan panel channel ID
- `CHANNELS.clanAdminReview` -> clan review/admin channel ID
- `CHANNELS.gearStore` -> gear store channel ID
- `CHANNELS.gearPostStore` -> gear post/store results channel ID

## Notes

- The bot is using route-based progression, not the old clan-role-based system.
- Clan leadership now auto-transfers to the deputy after 21 days of leader inactivity.
- Fighter death penalty support is implemented in `services/clanService.js` as a helper hook for battle logic.