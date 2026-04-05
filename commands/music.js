const musicService = require('../services/musicService');

async function play(message, args) {
    try {
        const query = (args || []).join(' ').trim();

        if (!query) {
            return message.reply('Usage: `%play <search query>`');
        }

        const result = await musicService.addToQueue({ message, query });

        if (result.queued) {
            return message.reply(`➕ Added to queue (**#${result.position}**): **${result.track.title}**`);
        }

        return message.reply(`🎶 Starting playback: **${result.track.title}**`);
    } catch (err) {
        console.error('[music] %play error:', err);

        if (err.message === 'GUILD_ONLY') {
            return message.reply('This command can only be used in a server.');
        }
        if (err.message === 'USER_NOT_IN_VOICE') {
            return message.reply('You must be in a voice channel to use `%play`.');
        }
        if (err.message === 'NO_RESULTS') {
            return message.reply('No results found on YouTube for your query.');
        }
        if (err.message === 'SEARCH_FAILED') {
            return message.reply('Could not search YouTube right now (provider issue). Please try again in a moment or send a direct YouTube link.');
        }
        if (err.message === 'MISSING_VOICE_PERMISSIONS') {
            return message.reply('I need **View Channel**, **Connect**, and **Speak** permissions in your voice channel.');
        }
        if (err.message === 'BOT_IN_ANOTHER_VOICE_CHANNEL') {
            return message.reply('I am already active in another voice channel in this server. Join that channel or stop playback first.');
        }
        if (err.message === 'QUEUE_LIMIT_REACHED') {
            return message.reply(`Queue limit reached (**${musicService.MAX_QUEUE_SIZE} tracks**). Please wait or skip tracks.`);
        }
        if (err.message === 'VOICE_CHANNEL_NOT_JOINABLE') {
            return message.reply('I cannot join that voice channel (join is blocked by channel/server settings).');
        }
        if (err.message === 'VOICE_CHANNEL_FULL') {
            return message.reply('That voice channel is full. Please free a slot or move to another channel.');
        }
        if (err.message === 'VOICE_NETWORK_BLOCKED') {
            return message.reply('Voice networking failed (UDP/IP discovery). This is usually a Discord/network issue: try rejoining VC, switching region, disabling VPN, or trying another network.');
        }
        if (err.message === 'VOICE_CONNECT_ABORTED') {
            return message.reply('Voice connection was aborted by Discord while connecting. Please try `%play` again in a few seconds.');
        }
        if (err.message === 'TRACK_URL_MISSING') {
            return message.reply('I found a video but could not resolve a playable URL. Try a different query.');
        }
        if (err.message === 'NO_PLAYABLE_FORMATS') {
            return message.reply('I found the video, but no playable audio format is available right now. Try another song or try again in a minute.');
        }
        if (err.message === 'YTDL_INFO_FAILED') {
            return message.reply('Audio extraction failed while reading video stream info. This is usually temporary—please try again.');
        }
        if (err.message === 'FFMPEG_MISSING') {
            return message.reply('Audio transcoder is missing on host (FFmpeg). Install FFmpeg or keep using Opus-compatible sources.');
        }
        if (err.message === 'OPUS_CODEC_MISSING') {
            return message.reply('Audio codec (Opus) is missing. Bot environment is incomplete. Contact the bot owner.');
        }
        if (err.message === 'YTDLP_NOT_FOUND') {
            return message.reply('`yt-dlp` is not installed/found on host, and other extractors failed. Install yt-dlp or set `YT_DLP_PATH` in `.env`.');
        }
        if (err.message === 'YTDLP_SPAWN_FAILED' || err.message === 'YTDLP_RESOURCE_FAILED' || err.message === 'YTDLP_EXITED_EARLY') {
            return message.reply('`yt-dlp` fallback failed to start a playable audio stream. Please try another song or retry in a moment.');
        }
        if (err.message === 'NOT_SAME_VOICE_CHANNEL') {
            return message.reply('You must be in the same voice channel as the bot to control playback.');
        }
        if (err.message === 'NOTHING_PLAYING') {
            return message.reply('There is no active playback right now.');
        }
        if (err.message === 'PAUSE_RESUME_FAILED') {
            return message.reply('Could not change pause/resume state right now. Try again.');
        }
        if (err.message === 'VOICE_CONNECT_TIMEOUT') {
            return message.reply('I could not connect to voice in time. Please try again in a moment.');
        }
        if (err.message === 'BOT_MEMBER_NOT_FOUND') {
            return message.reply('I could not resolve my guild member permissions. Try again shortly.');
        }

        return message.reply('Failed to play audio. Please try again.');
    }
}

module.exports = {
    play
};
