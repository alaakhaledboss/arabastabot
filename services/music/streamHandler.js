const play = require('play-dl');
const { createAudioResource, StreamType } = require('@discordjs/voice');
const path = require('path');
const fs = require('fs');

// Register custom ffmpeg binary if present in bin/
const localFfmpeg = path.join(__dirname, '../../bin/ffmpeg');
if (fs.existsSync(localFfmpeg)) {
    process.env.FFMPEG_PATH = localFfmpeg;
}

// Client ID initialization for SoundCloud
let scClientID = null;
async function initSoundCloud() {
    try {
        scClientID = await play.getFreeClientID();
        if (scClientID) {
            await play.setToken({ soundcloud: { client_id: scClientID } });
            console.log('[music] SoundCloud client ID loaded.');
        }
    } catch (err) {
        console.warn('[music] SoundCloud client ID fetch failed:', err?.message || err);
    }
}
initSoundCloud();

async function createTrackResource(trackUrl) {
    if (!trackUrl) throw new Error('TRACK_URL_MISSING');

    try {
        let streamUrl = trackUrl;

        // If scClientID expired or stream links stale, force a fresh fetch
        if (trackUrl.includes('soundcloud.com')) {
            try {
                const info = await play.soundcloud(trackUrl);
                if (info && info.permalink_url) {
                    streamUrl = info.permalink_url;
                }
            } catch (_) {
                // Fallback to original URL if metadata lookup fails
            }
        }

        const stream = await play.stream(streamUrl);
        return createAudioResource(stream.stream, {
            inputType: stream.type || StreamType.Arbitrary,
            inlineVolume: true
        });
    } catch (err) {
        console.error('[music] SoundCloud stream creation failed:', err?.message || err);
        throw new Error('STREAM_FAILED');
    }
}

async function searchYouTubeFirst(query) {
    const text = String(query || '').trim();
    if (!text) return null;

    // Handle direct SoundCloud links
    const isDirectLink = text.includes('soundcloud.com') || (typeof play.so_validate === 'function' && play.so_validate(text) === 'track');

    if (isDirectLink) {
        return {
            title: 'SoundCloud Track',
            url: text,
            requestedBy: null
        };
    }

    // Execute SoundCloud search
    try {
        const results = await play.search(text, { limit: 1, source: { soundcloud: 'tracks' } });
        if (results?.length && results[0]?.url) {
            const first = results[0];
            return {
                title: first.name || first.title || 'Unknown SoundCloud Track',
                url: first.url,
                requestedBy: null
            };
        }
    } catch (err) {
        console.warn('[music] SoundCloud search failed:', err?.message || err);
    }

    throw new Error('SEARCH_FAILED');
}

async function enrichTrackMetadata(track) {
    if (!track?.url) return track;
    if (track.title && track.title !== 'SoundCloud Track' && track.title !== 'Unknown SoundCloud Track') {
        return track;
    }

    try {
        const info = await play.soundcloud(track.url);
        if (info?.name || info?.title) {
            track.title = info.name || info.title;
        }
    } catch (_) {}

    return track;
}

module.exports = {
    createTrackResource,
    searchYouTubeFirst,
    enrichTrackMetadata
};