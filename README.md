# shutdown-challenge

## Example Discord bot (discord.js v14)

This repository now contains a minimal Discord bot example.

Usage:

1. Install dependencies:

   npm install

2. Create `.env` from `.env.example` and add your bot token:

   cp .env.example .env
   # then edit .env and set DISCORD_TOKEN

3. Run:

   npm start

If you want a slash command deploy script, ask and I'll add one.

### Message-based command

This bot listens for message commands instead of slash commands.

- To get a pong response, send the following message in a guild channel where the bot has access:

```
-s ping
```

The bot will reply with `pong`.

Ensure the bot has the `Message Content Intent` enabled in the Discord Developer Portal and that your `index.js` includes the `GatewayIntentBits.MessageContent` and `GatewayIntentBits.GuildMessages` intents (already added in this sample).

### Security note about message-executed commands

This sample exposes a small whitelist of system commands via messages (commands starting with `-s !`). There is no owner-only restriction in the sample by default. That means any user who can send messages in a channel the bot can read may cause the bot to run one of the allowed commands.

Do not deploy this configuration in an untrusted environment. Recommended mitigations:

- Re-enable an owner-only check (set a `BOT_OWNER_ID` and check `message.author.id`).
- Run the bot in a sandboxed environment (container) with limited permissions.
- Limit the allowed commands and strictly validate arguments.
- Log executions and monitor for abuse.