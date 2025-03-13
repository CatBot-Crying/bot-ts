require('dotenv').config();
const { Client, IntentsBitField } = require('discord.js');
const express = require('express');
const ytdl = require('ytdl-core');
const app = express();

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildVoiceStates
    ]
});

const prefix = process.env.PREFIX || '!';
const queue = new Map();

app.get('/', (req, res) => {
    res.send('Bot is alive!');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Express server running on port ${port}`);
});

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
        if (!user) return message.reply('Please mention a user to give a role to!');
        if (!roleName) return message.reply('Please specify a role name!');
        try {
            const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
            if (!role) return message.reply(`Role "${roleName}" not found!`);
            if (user.roles.cache.has(role.id)) return message.reply(`${user.user.tag} already has that role!`);
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
        if (!user) return message.reply('Please mention a user to ban!');
        if (!user.bannable) return message.reply('I cannot ban this user!');
        try {
            await user.ban();
            message.reply(`Successfully banned ${user.user.tag}!`);
        } catch (error) {
            console.error(error);
            message.reply('An error occurred while banning the user!');
        }
    }

    // Play command
    if (command === 'play') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('You need to be in a voice channel to play music!');

        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            return message.reply('I need the permissions to join and speak in your voice channel!');
        }

        const songUrl = args.join(' ');
        if (!songUrl || !ytdl.validateURL(songUrl)) {
            return message.reply('Please provide a valid YouTube URL!');
        }

        let song;
        try {
            const songInfo = await ytdl.getInfo(songUrl);
            song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url
            };
        } catch (error) {
            console.error(error);
            return message.reply('Error getting song information!');
        }

        const serverQueue = queue.get(message.guild.id) || {
            songs: [],
            connection: null,
            playing: false,
            dispatcher: null
        };

        serverQueue.songs.push(song);

        if (!serverQueue.playing) {
            try {
                const connection = await voiceChannel.join();
                serverQueue.connection = connection;
                queue.set(message.guild.id, serverQueue);
                playSong(message.guild, serverQueue.songs[0], message);
            } catch (error) {
                console.error(error);
                queue.delete(message.guild.id);
                return message.reply('Error joining voice channel!');
            }
        } else {
            queue.set(message.guild.id, serverQueue);
            return message.reply(`Added to queue: **${song.title}**`);
        }
    }

    // Stop command
    if (command === 'stop') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('You need to be in a voice channel to stop music!');

        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue || !serverQueue.playing) {
            return message.reply('There is no music playing to stop!');
        }

        serverQueue.songs = [];
        serverQueue.playing = false;
        if (serverQueue.dispatcher) {
            serverQueue.dispatcher.destroy();
        }
        serverQueue.connection.destroy();
        queue.delete(message.guild.id);
        message.reply('Music stopped and queue cleared!');
    }

    // Pause command
    if (command === 'pause') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('You need to be in a voice channel to pause music!');

        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue || !serverQueue.playing) {
            return message.reply('There is no music playing to pause!');
        }

        if (!serverQueue.dispatcher) {
            return message.reply('Nothing to pause!');
        }

        if (serverQueue.dispatcher.paused) {
            return message.reply('The music is already paused!');
        }

        serverQueue.dispatcher.pause();
        message.reply('Music paused!');
    }

    // Resume command
    if (command === 'resume') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('You need to be in a voice channel to resume music!');

        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue || !serverQueue.playing) {
            return message.reply('There is no music to resume!');
        }

        if (!serverQueue.dispatcher) {
            return message.reply('Nothing to resume!');
        }

        if (!serverQueue.dispatcher.paused) {
            return message.reply('The music is already playing!');
        }

        serverQueue.dispatcher.resume();
        message.reply('Music resumed!');
    }
});

function playSong(guild, song, message) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.connection.destroy();
        queue.delete(guild.id);
        return;
    }

    serverQueue.playing = true;
    const stream = ytdl(song.url, { filter: 'audioonly', quality: 'highestaudio' });
    
    const dispatcher = serverQueue.connection.play(stream, { seek: 0, volume: 1 })
        .on('finish', () => {
            serverQueue.songs.shift();
            serverQueue.playing = false;
            playSong(guild, serverQueue.songs[0], message);
        })
        .on('error', error => {
            console.error(error);
            message.channel.send('An error occurred while playing the song!');
            serverQueue.songs.shift();
            playSong(guild, serverQueue.songs[0], message);
        });

    serverQueue.dispatcher = dispatcher;
    queue.set(guild.id, serverQueue);
    message.channel.send(`Now playing: **${song.title}**`);
}

client.login(process.env.DISCORD_TOKEN);
