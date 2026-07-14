const play = require('play-dl');
const ytdl = require('@distube/ytdl-core');
const { Innertube } = require('youtubei.js');
const { spawn } = require('child_process');
const fs = require('fs');
const { createAudioResource, StreamType } = require('@discordjs/voice');

let innertubeClientPromise = null;
const SEARCH_CACHE_TTL_MS = 2 * 60 * 1000;
const META_CACHE_TTL_MS = 10 * 60 * 1000;
const AUDIO_INFO_CACHE_TTL_MS = 8 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

const searchCache = new Map();
const metadataCache = new Map();
const audioInfoCache = new Map();

function pruneCache(cache) {
    while (cache.size > MAX_CACHE_ENTRIES) {
        const firstKey = cache.keys().next().value;
        if (!firstKey) break;
        cache.delete(firstKey);
    }
}

function getFromCache(cache, key, ttlMs) {
    const item = cache.get(key);
    if (!item) return null;
    if (Date.now() - item.ts > ttlMs) {
        cache.delete(key);
        return null;
    }
    return item.value;
}

function putInCache(cache, key, value) {
    cache.set(key, { value, ts: Date.now() });
    pruneCache(cache);
}

function withTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs))
    ]);
}

function getInnertubeClient() {
    if (!innertubeClientPromise) {
        innertubeClientPromise = Innertube.create().catch((err) => {
            innertubeClientPromise = null;
            throw err;
        });
    }
    return innertubeClientPromise;
}

function resolveYtDlpExecutable() {
    if (process.env.YT_DLP_PATH) return process.env.YT_DLP_PATH;

    const userProfile = process.env.USERPROFILE || '';
    const wingetPath = `${userProfile}\\AppData\\Local\\Microsoft\\WinGet\\Packages\\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe\\yt-dlp.exe`;
    if (wingetPath && fs.existsSync(wingetPath)) return wingetPath;

    return 'yt-dlp';
}

function resolveDenoExecutable() {
    if (process.env.DENO_PATH) return process.env.DENO_PATH;

    const userProfile = process.env.USERPROFILE || '';
    const wingetDenoPath = `${userProfile}\\AppData\\Local\\Microsoft\\WinGet\\Packages\\DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe\\deno.exe`;
    if (wingetDenoPath && fs.existsSync(wingetDenoPath)) return wingetDenoPath;

    return null;
}

async function searchWithYtDlp(query) {
    return new Promise((resolve, reject) => {
        const ytDlpExe = resolveYtDlpExecutable();
        const denoExe = resolveDenoExecutable();
        const args = [
            '--no-playlist',
            '--skip-download',
            '--quiet',
            '--no-warnings',
            '--get-id',
            `ytsearch1:${query}`
        ];

        if (denoExe) {
            args.unshift(`deno:${denoExe}`);
            args.unshift('--js-runtimes');
        }

        const proc = spawn(ytDlpExe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        let settled = false;

        const finish = (fn) => (value) => {
            if (settled) return;
            settled = true;
            fn(value);
        };

        const resolveOnce = finish(resolve);
        const rejectOnce = finish(reject);

        const timeout = setTimeout(() => {
            try { proc.kill(); } catch (_) {}
            rejectOnce(new Error('YTDLP_SEARCH_TIMEOUT'));
        }, 8_000);

        proc.on('error', (err) => {
            clearTimeout(timeout);
            if (String(err?.message || '').includes('ENOENT')) return rejectOnce(new Error('YTDLP_NOT_FOUND'));
            return rejectOnce(new Error('YTDLP_SEARCH_FAILED'));
        });

        proc.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        proc.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        proc.on('close', (code) => {
            clearTimeout(timeout);

            const videoId = (stdout || '')
                .split(/\r?\n/)
                .map((line) => line.trim())
                .find((line) => /^[a-zA-Z0-9_-]{11}$/.test(line));

            if (videoId) {
                return resolveOnce(`https://www.youtube.com/watch?v=${videoId}`);
            }

            if (code !== 0 && stderr.trim()) {
                return rejectOnce(new Error('YTDLP_SEARCH_FAILED'));
            }

            return resolveOnce(null);
        });
    });
}

async function createYtDlpOpusResource(trackUrl) {
    async function spawnYtDlpResource(formatSelector, inputType, strategyLabel) {
        return new Promise((resolve, reject) => {
            const ytDlpExe = resolveYtDlpExecutable();
            const denoExe = resolveDenoExecutable();
            const args = [
                '--no-playlist',
                '--quiet',
                '--no-warnings',
                '-f',
                formatSelector,
                '-o',
                '-',
                trackUrl
            ];

            if (denoExe) {
                args.unshift(`deno:${denoExe}`);
                args.unshift('--js-runtimes');
            }

            const proc = spawn(ytDlpExe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
            let settled = false;
            let stderr = '';

            const fail = (error) => {
                if (settled) return;
                settled = true;
                try { proc.kill(); } catch (_) {}
                reject(error);
            };

            const success = (resource) => {
                if (settled) return;
                settled = true;
                resolve(resource);
            };

            proc.on('error', (err) => {
                if (String(err?.message || '').includes('ENOENT')) return fail(new Error('YTDLP_NOT_FOUND'));
                fail(new Error('YTDLP_SPAWN_FAILED'));
            });

            proc.stderr.on('data', (chunk) => {
                stderr += chunk.toString();
            });

            try {
                const resource = createAudioResource(proc.stdout, {
                    inputType,
                    inlineVolume: true
                });
                success(resource);
            } catch (err) {
                const msg = String(err?.message || err || '');
                if (/ffmpeg|avconv/i.test(msg)) return fail(new Error('FFMPEG_MISSING'));
                if (/@discordjs\/opus|opusscript|node-opus/.test(msg)) return fail(new Error('OPUS_CODEC_MISSING'));
                console.warn(`[music] yt-dlp resource strategy failed (${strategyLabel}): ${msg || 'unknown error'}`);
                fail(new Error('YTDLP_RESOURCE_FAILED'));
            }

            proc.on('close', (code) => {
                if (!settled) {
                    console.error(`[music] yt-dlp exited early (${strategyLabel}) code=${code}; stderr=${stderr.trim() || 'n/a'}`);
                    fail(new Error('YTDLP_EXITED_EARLY'));
                }
            });
        });
    }

    try {
        return await spawnYtDlpResource(
            'bestaudio[acodec=opus][ext=webm]/bestaudio[acodec=opus]/bestaudio[ext=webm]',
            StreamType.WebmOpus,
            'webm-opus'
        );
    } catch (err) {
        if (err.message === 'YTDLP_NOT_FOUND' || err.message === 'YTDLP_SPAWN_FAILED' || err.message === 'FFMPEG_MISSING') {
            throw err;
        }
    }

    return await spawnYtDlpResource(
        'bestaudio/best',
        StreamType.Arbitrary,
        'generic-bestaudio'
    );
}

async function createYtdlOpusResource(trackUrl) {
    try {
        let info = getFromCache(audioInfoCache, trackUrl, AUDIO_INFO_CACHE_TTL_MS);
        if (!info) {
            info = await withTimeout(ytdl.getInfo(trackUrl), 6_500);
            putInCache(audioInfoCache, trackUrl, info);
        }

        const formats = info?.formats || [];
        const audioOnly = ytdl.filterFormats(formats, 'audioonly');
        if (!audioOnly.length) throw new Error('NO_PLAYABLE_FORMATS');

        const selected = ytdl.chooseFormat(formats, {
            quality: 'highestaudio',
            filter: 'audioonly'
        }) || audioOnly.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];

        if (!selected) throw new Error('NO_PLAYABLE_FORMATS');

        const stream = ytdl.downloadFromInfo(info, {
            quality: 'highestaudio',
            filter: 'audioonly',
            format: selected,
            highWaterMark: 1 << 27,
            dlChunkSize: 0
        });

        stream.on('error', (err) => {
            console.error('[music] ytdl stream runtime error:', err?.message || err);
        });

        return createAudioResource(stream, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true
        });
    } catch (err) {
        const msg = String(err?.message || err || '');
        if (/FFmpeg|avconv/i.test(msg)) throw new Error('FFMPEG_MISSING');
        if (err?.message === 'NO_PLAYABLE_FORMATS' || /playable formats/i.test(msg)) throw new Error('NO_PLAYABLE_FORMATS');
        throw new Error('YTDL_INFO_FAILED');
    }
}

async function createPlayDlResource(trackUrl) {
    const stream = await withTimeout(play.stream(trackUrl), 3_500);
    return createAudioResource(stream.stream, {
        inputType: stream.type || StreamType.Arbitrary,
        inlineVolume: true
    });
}

async function createTrackResource(trackUrl) {
    if (!ytdl.validateURL(trackUrl)) throw new Error('TRACK_URL_MISSING');

    try {
        return await createYtdlOpusResource(trackUrl);
    } catch (ytdlErr) {
        if (ytdlErr.message !== 'NO_PLAYABLE_FORMATS' && ytdlErr.message !== 'YTDL_INFO_FAILED') {
            throw ytdlErr;
        }
    }

    try {
        return await createPlayDlResource(trackUrl);
    } catch (_) {
        try {
            const info = await withTimeout(play.video_info(trackUrl), 3_500);
            const stream = await withTimeout(play.stream_from_info(info), 3_500);
            return createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
        } catch (_) {
            return await createYtDlpOpusResource(trackUrl);
        }
    }
}

async function searchYouTubeFirst(query) {
    const text = String(query || '').trim();
    if (!text) return null;

    const normalizedQuery = text.toLowerCase();
    const cachedSearch = getFromCache(searchCache, normalizedQuery, SEARCH_CACHE_TTL_MS);
    if (cachedSearch?.url) return { ...cachedSearch };

    if (ytdl.validateURL(text)) {
        const directResult = {
            title: 'YouTube Track',
            url: text,
            requestedBy: null
        };

        putInCache(searchCache, normalizedQuery, directResult);
        return directResult;
    }

    try {
        const results = await withTimeout(play.search(text, {
            limit: 1,
            source: { youtube: 'video' }
        }), 2_500);

        if (results?.length) {
            const first = results[0];
            const result = {
                title: first.title || 'Unknown title',
                url: first.url || (first.id ? `https://www.youtube.com/watch?v=${first.id}` : null),
                requestedBy: null
            };

            if (result.url) {
                putInCache(searchCache, normalizedQuery, result);
            }

            return result;
        }
    } catch (err) {
        console.warn('[music] play-dl search failed, falling back to youtubei.js:', err?.message || err);
    }

    try {
        const yt = await getInnertubeClient();
        const results = await withTimeout(yt.search(text, { type: 'video' }), 4_000);
        const first = results?.videos?.[0] || results?.results?.[0] || null;
        if (!first) return null;

        const videoId = first.video_id || first.id || first?.endpoint?.payload?.videoId || null;
        const url = first.url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);

        const result = {
            title: first.title?.text || first.title || 'Unknown title',
            url,
            requestedBy: null
        };

        if (result.url) {
            putInCache(searchCache, normalizedQuery, result);
        }

        return result;
    } catch (err) {
        console.error('[music] youtubei.js search fallback failed:', err?.message || err);
    }

    try {
        const ytDlpUrl = await searchWithYtDlp(text);
        if (ytDlpUrl) {
            const result = {
                title: 'YouTube Track',
                url: ytDlpUrl,
                requestedBy: null
            };

            putInCache(searchCache, normalizedQuery, result);
            return result;
        }
    } catch (err) {
        console.error('[music] yt-dlp search fallback failed:', err?.message || err);
    }

    throw new Error('SEARCH_FAILED');
}

async function enrichTrackMetadata(track) {
    if (!track?.url) return track;
    if (!ytdl.validateURL(track.url)) return track;
    if (track.title && track.title !== 'YouTube Track' && track.title !== 'Unknown title') return track;

    const cachedTitle = getFromCache(metadataCache, track.url, META_CACHE_TTL_MS);
    if (cachedTitle) {
        track.title = cachedTitle;
        return track;
    }

    try {
        let info = getFromCache(audioInfoCache, track.url, AUDIO_INFO_CACHE_TTL_MS);
        if (!info) {
            info = await withTimeout(ytdl.getBasicInfo(track.url), 3_500);
        }

        const title = info?.videoDetails?.title;
        if (title) {
            track.title = title;
            putInCache(metadataCache, track.url, title);
        }
    } catch (_) {}

    return track;
}

module.exports = {
    createTrackResource,
    searchYouTubeFirst,
    enrichTrackMetadata
};
