require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, EmbedBuilder, ActivityType } = require('discord.js');

// Simple contract
// - Input: DISCORD_TOKEN in environment
// - Output: bot logs in, responds to /ping with "Pong!"
// - Errors: logs and exits if token missing or login fails

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN in environment. See .env.example');
  process.exit(1);
}

// Load blacklist from `blacklist.txt` (one word/pattern per line). Match is
// case-insensitive substring match so "aaaaashutdownaa" will match a line
// containing "shutdown".
const fs = require('fs');
const path = require('path');
const blacklistPath = path.join(__dirname, 'blacklist.txt');
let blacklist = [];
const loadBlacklist = () => {
  try {
    if (!fs.existsSync(blacklistPath)) {
      console.warn('blacklist.txt not found — starting with an empty blacklist. Create blacklist.txt to add blocked words.');
      blacklist = [];
      return;
    }
    blacklist = fs.readFileSync(blacklistPath, 'utf8')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
  } catch (e) {
    console.warn('Could not read blacklist.txt, starting with an empty blacklist:', e.message);
    blacklist = [];
  }
};
loadBlacklist();


const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

client.once(Events.ClientReady, c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
  try {
    c.user.setPresence({ activities: [{ name: '-s help로 도움말 표시', type: ActivityType.Listening }] });
  } catch (e) {
    console.warn('Could not set presence:', e.message);
  }
});

client.on('messageCreate', async message => {
  try {
    if (message.author.bot) return; // ignore bots

    const prefix = '-s ';
    if (!message.content.toLowerCase().startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const cmd = args.shift()?.toLowerCase();

    if (cmd === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('Shutdown Challenge 안내')
        .setColor(0x00aa00)
        .setDescription('이 챌린지는 사용자가 봇에게 시스템 명령을 보내 봇을 종료시키는 것이 목표입니다! 성공할 때마다 명령 블랙리스트가 늘어나며, 사용자가 몇 번이나 성공하는지 테스트합니다.')
        .addFields(
          { name: '사용법', value: "- `-s <command>` 으로 명령을 실행합니다 (예: `-s ls -la`).\n- `-s help` 로 이 안내를 표시합니다.\n- `-s blacklist` 로 현재 블랙리스트를 표시합니다.\n" },
          { name: '목표', value: '서버의 **특정 파일을 삭제하는 행위, 봇과 관련된 코드를 수정하는 행위**를 제외하고 그 어떤 방법으로든 이 봇을 종료시키면 됩니다!' }
        )
        .setFooter({ text: 'Shutdown Challenge' });

      await message.reply({ embeds: [embed] });
      return;
    }

    // Show current blacklist entries
    if (cmd === 'blacklist') {
      // Read latest blacklist from disk so updates appear immediately
      let current = [];
      try {
        if (fs.existsSync(blacklistPath)) {
          current = fs.readFileSync(blacklistPath, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        }
      } catch (e) {
        console.warn('Could not read blacklist.txt on demand:', e.message);
      }

      const embed = new EmbedBuilder().setTitle('Current Blacklist').setColor(0x990000);
      if (!current || current.length === 0) {
        embed.setDescription('블랙리스트가 비어 있습니다. `blacklist.txt` 파일을 생성하고 차단할 단어를 한 줄에 하나씩 추가하세요.');
      } else {
        const lines = current.join('\n');
        embed.setDescription(`\n\n\`\`\`\n${lines}\n\`\`\``);
      }

      await message.reply({ embeds: [embed] });
      return;
    }

    // If message should be executed as system command
    // Example: "-s ls -la"
    if (cmd) {
      // Build the full command string to run in a shell
      // joined will collect the command and the remaining args
      let joined = [cmd, ...args].filter(Boolean);
      const fullCommand = joined.join(' ');

      // Blacklist: deny commands containing any substring listed in blacklist.txt
      const lower = fullCommand.toLowerCase();
      for (const word of blacklist) {
        if (word && lower.includes(word.toLowerCase())) {
          const blockEmbed = new EmbedBuilder()
            .setTitle('명령 차단됨')
            .setColor(0xff0000)
            .setDescription('명령에 차단된 패턴이 포함되어 있어 실행이 거부되었습니다.');
          await message.reply({ embeds: [blockEmbed] });
          return;
        }
      }

      const exec = require('child_process').exec;

      // Execute in a shell to capture terminal-like output. Keep timeout and buffer limits.
      exec(fullCommand, { timeout: 5000, maxBuffer: 1024 * 1024, shell: '/bin/bash' }, (error, stdout, stderr) => {
        try {
          const combined = `${stdout || ''}${stderr || ''}` || '(no output)';
          const trimmed = combined.length > 1900 ? combined.slice(0, 1900) + '\n...(이하 생략)' : combined;
					
					// Reply with terminal output (stdout+stderr) wrapped in code block inside an embed
          if (error) {
            const errEmbed = new EmbedBuilder()
              .setTitle('명령 실행 오류')
              .setColor(0xff5500)
              .setDescription(`\n\n\`\`\`\n${trimmed}\n\`\`\``);
            message.reply({ embeds: [errEmbed] });
            return;
          }

          const outEmbed = new EmbedBuilder()
            .setTitle('명령 결과')
            .setColor(0x00aa00)
            .setDescription(`\n\n\`\`\`\n${trimmed}\n\`\`\``);
          message.reply({ embeds: [outEmbed] });
        } catch (sendErr) {
          console.error('Reply error:', sendErr);
        }
      });
      return;
    }
  } catch (err) {
    console.error('Message handling error:', err);
  }
});

// Login
client.login(token).catch(err => {
  console.error('Failed to login:', err);
  process.exit(1);
});
