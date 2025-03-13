require('dotenv').config();
const { Client, IntentsBitField } = require('discord.js');
const express = require('express');
const { exec } = require('child_process'); // Added child_process
const app = express();

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent
    ]
});

const prefix = process.env.PREFIX || '!';

// Express server setup
app.get('/', (req, res) => {
    res.send('Bot is alive!');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Express server running on port ${port}`);
});

// Discord bot code
client.once('ready', () => {
    console.log('Bot is ready!');
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Give role command
    if (command === 'giverole') {
        if (!message.member.permissions.has('ManageRoles')) {
            return message.reply('You do not have permission to manage roles!');
        }

        if (!message.guild.members.me.permissions.has('ManageRoles')) {
            return message.reply('I do not have permission to manage roles!');
        }

        const user = message.mentions.members.first();
        const roleName = args.slice(1).join(' ');

        if (!user) {
            return message.reply('Please mention a user to give a role to!');
        }

        if (!roleName) {
            return message.reply('Please specify a role name!');
        }

        try {
            const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
            
            if (!role) {
                return message.reply(`Role "${roleName}" not found!`);
            }

            if (user.roles.cache.has(role.id)) {
                return message.reply(`${user.user.tag} already has that role!`);
            }

            await user.roles.add(role);
            message.reply(`Successfully gave ${role.name} to ${user.user.tag}!`);
        } catch (error) {
            console.error(error);
            message.reply('An error occurred while giving the role!');
        }
    }

    // Ban command
    if (command === 'ban') {
        if (!message.member.permissions.has('BanMembers')) {
            return message.reply('You do not have permission to ban members!');
        }

        if (!message.guild.members.me.permissions.has('BanMembers')) {
            return message.reply('I do not have permission to ban members!');
        }

        const user = message.mentions.members.first();

        if (!user) {
            return message.reply('Please mention a user to ban!');
        }

        if (!user.bannable) {
            return message.reply('I cannot ban this user! They might have higher permissions.');
        }

        try {
            await user.ban();
            message.reply(`Successfully banned ${user.user.tag}!`);
        } catch (error) {
            console.error(error);
            message.reply('An error occurred while banning the user!');
        }
    }

    // New terminal command
    if (command === 'exec') {
        // Restrict to bot owner or specific role (security measure)
        const ownerId = process.env.OWNER_ID; // Add your Discord ID to .env
        if (message.author.id !== ownerId) {
            return message.reply('Only the bot owner can use this command!');
        }

        const cmd = args.join(' ');
        if (!cmd) {
            return message.reply('Please provide a command to execute!');
        }

        try {
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    message.reply(`Error: ${error.message}`);
                    return;
                }
                if (stderr) {
                    message.reply(`Stderr: ${stderr}`);
                    return;
                }
                
                // Split long output into multiple messages if needed
                const output = stdout || 'Command executed successfully (no output)';
                const maxLength = 2000; // Discord message limit
                if (output.length <= maxLength) {
                    message.reply(`\`\`\`\n${output}\n\`\`\``);
                } else {
                    const parts = output.match(new RegExp(`.{1,${maxLength}}`, 'g'));
                    parts.forEach(part => {
                        message.channel.send(`\`\`\`\n${part}\n\`\`\``);
                    });
                }
            });
        } catch (error) {
            message.reply(`Execution error: ${error.message}`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
