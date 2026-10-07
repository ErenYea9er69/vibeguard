import { YoutubeTranscript } from "youtube-transcript";
import { SourceVideo } from "./types";

const SUPADATA = "https://api.supadata.ai/v1";

export function detectYouTubeInput(input: string) {
  try {
    const url = new URL(input.trim());
    const playlistId = url.searchParams.get("list");
    const videoId = url.searchParams.get("v") || (url.hostname === "youtu.be" ? url.pathname.slice(1).split("?")[0] : null);
    if (playlistId && !videoId) return { type: "playlist" as const, id: playlistId };
    if (videoId) return { type: "video" as const, id: videoId, playlistId: playlistId || undefined };
    if (url.pathname.startsWith("/shorts/")) return { type: "video" as const, id: url.pathname.split("/")[2] };
    if (playlistId) return { type: "playlist" as const, id: playlistId };
  } catch {}
  if (/^PL[a-zA-Z0-9_-]+$/.test(input.trim())) return { type: "playlist" as const, id: input.trim() };
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return { type: "video" as const, id: input.trim() };
  throw new Error("Enter a valid YouTube video URL, video ID, playlist URL, or playlist ID.");
}

async function supadata(path: string, init?: RequestInit) {
  const key = process.env.SUPADATA_API_KEY;
  if (!key) throw new Error("SUPADATA_API_KEY is missing.");
  const res = await fetch(`${SUPADATA}${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), "x-api-key": key }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supadata error ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

async function fetchDirectVideo(videoId: string, language?: string): Promise<SourceVideo> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  let title = `Video ${videoId}`;
  let channel = "YouTube Creator";
  let thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  let description = "";

  // 1. Fetch title and channel via free oEmbed
  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (oembedRes.ok) {
      const data = await oembedRes.json();
      if (data.title) title = data.title;
      if (data.author_name) channel = data.author_name;
      if (data.thumbnail_url) thumbnail = data.thumbnail_url;
    }
  } catch (err) {
    console.warn("oEmbed fetch failed:", err);
  }

  // 2. Fetch transcript via youtube-transcript
  let transcript = "";
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId, language ? { lang: language } : undefined);
    if (items && items.length) {
      transcript = items.map(item => item.text).join(" ");
    }
  } catch {
    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId);
      if (items && items.length) {
        transcript = items.map(item => item.text).join(" ");
      }
    } catch (err) {
      console.warn(`Direct transcript unavailable for ${videoId}:`, err);
    }
  }

  // 3. If transcript is empty, try extracting description from watch page
  if (!transcript.trim()) {
    try {
      const pageRes = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const descMatch = html.match(/<meta name="description" content="(.*?)">/);
        if (descMatch && descMatch[1]) {
          description = descMatch[1];
        }
      }
    } catch {}
    transcript = description ? `Topic Overview from Video:\n${title}\n${description}` : `Video Topic: ${title} by ${channel}. Synthesize relevant educational lessons based on this topic.`;
  }

  return {
    id: videoId,
    url,
    title,
    channel,
    thumbnail,
    description,
    transcript
  };
}

async function fetchDirectPlaylist(playlistId: string, maxVideos: number, language?: string): Promise<{ videos: SourceVideo[]; title: string; channel?: string }> {
  const url = `https://www.youtube.com/playlist?list=${playlistId}`;
  let playlistTitle = "YouTube Playlist";

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Cookie": "SOCS=CAESEwgDEgk2NDIyNDM3NjcaAmVuIAEaBgiA_LyaBg",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to load YouTube playlist (${res.status} ${res.statusText})`);
  }

  const html = await res.text();
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  if (titleMatch && titleMatch[1]) {
    playlistTitle = titleMatch[1].replace(/ - YouTube$/, "").trim();
  }

  // Extract video IDs from initial data JSON in page
  let videoIds = Array.from(new Set(Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map(m => m[1])));

  // If "all" videos requested (maxVideos === 0) or maxVideos > videoIds.length, try continuation token if present
  const wantsAll = maxVideos === 0;
  const wantsMore = wantsAll || (maxVideos > 0 && videoIds.length < maxVideos);
  if (wantsMore) {
    const contMatch = html.match(/"continuationCommand":\{"token":"([^"]+)"/);
    if (contMatch && contMatch[1]) {
      try {
        const postRes = await fetch("https://www.youtube.com/youtubei/v1/browse?prettyPrint=false", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Cookie": "SOCS=CAESEwgDEgk2NDIyNDM3NjcaAmVuIAEaBgiA_LyaBg",
          },
          body: JSON.stringify({
            continuation: contMatch[1],
            context: { client: { clientName: "WEB", clientVersion: "2.20231219.00.00" } }
          })
        });
        if (postRes.ok) {
          const contData = await postRes.text();
          const nextIds = Array.from(new Set(Array.from(contData.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map(m => m[1])));
          videoIds = Array.from(new Set([...videoIds, ...nextIds]));
        }
      } catch (err) {
        console.warn("Failed to fetch playlist continuation:", err);
      }
    }
  }

  const selectedIds = (!wantsAll && maxVideos > 0)
    ? videoIds.slice(0, maxVideos)
    : videoIds;

  if (!selectedIds.length) {
    throw new Error("No videos found in this playlist. Please check that the playlist is public.");
  }

  const videos = await mapWithConcurrency(selectedIds, 6, async (id: string) => {
    return fetchDirectVideo(id, language);
  });

  return {
    videos,
    title: playlistTitle,
    channel: videos[0]?.channel
  };
}

export async function getSourceVideos(
  input: string,
  maxVideos: number,
  language: string
): Promise<{ videos: SourceVideo[]; title?: string; channel?: string; type: "video" | "playlist" }> {
  const parsed = detectYouTubeInput(input);

  // If single video, always lock maxVideos to 1
  if (parsed.type === "video") {
    // Try Supadata if key available
    if (process.env.SUPADATA_API_KEY) {
      try {
        const url = `https://www.youtube.com/watch?v=${parsed.id}`;
        const [metadata, transcript] = await Promise.all([
          supadata(`/metadata?url=${encodeURIComponent(url)}`),
          supadata(`/transcript?url=${encodeURIComponent(url)}&lang=${encodeURIComponent(language)}`)
        ]);
        const content = Array.isArray(transcript.content)
          ? transcript.content.map((x: { text: string }) => x.text).join(" ")
          : String(transcript.content || "");
        return {
          type: "video",
          title: metadata.title,
          channel: metadata.channel?.name || metadata.author?.name,
          videos: [{
            id: parsed.id,
            url,
            title: metadata.title || "YouTube video",
            description: metadata.description,
            duration: metadata.duration,
            channel: metadata.channel?.name || metadata.author?.name,
            thumbnail: metadata.media?.thumbnail,
            transcript: content
          }]
        };
      } catch (err) {
        console.warn("Supadata failed for video, falling back to direct scraper:", err);
      }
    }

    // Direct scraper fallback (zero keys required)
    const video = await fetchDirectVideo(parsed.id, language);
    return {
      type: "video",
      title: video.title,
      channel: video.channel,
      videos: [video]
    };
  }

  // Playlist handling: maxVideos === 0 means all videos in the playlist
  const isAll = maxVideos === 0;
  const playlistMax = isAll ? 0 : Math.max(1, maxVideos || 12);

  if (process.env.SUPADATA_API_KEY) {
    try {
      const playlist = await supadata(`/youtube/playlist?id=${encodeURIComponent(parsed.id)}`);
      const limit = isAll ? 100 : playlistMax;
      const idsData = await supadata(`/youtube/playlist/videos?id=${encodeURIComponent(parsed.id)}&limit=${limit}`);
      const ids = isAll ? (idsData.videoIds || []) : (idsData.videoIds || []).slice(0, playlistMax);

      const videos = await mapWithConcurrency(ids, 6, async (id: string) => {
        const url = `https://www.youtube.com/watch?v=${id}`;
        try {
          const [metadata, transcript] = await Promise.all([
            supadata(`/metadata?url=${encodeURIComponent(url)}`),
            supadata(`/transcript?url=${encodeURIComponent(url)}&lang=${encodeURIComponent(language)}`)
          ]);
          const content = Array.isArray(transcript.content)
            ? transcript.content.map((x: { text: string }) => x.text).join(" ")
            : String(transcript.content || "");
          return {
            id,
            url,
            title: metadata.title || `Video ${id}`,
            description: metadata.description,
            duration: metadata.duration,
            channel: metadata.channel?.name || metadata.author?.name,
            thumbnail: metadata.media?.thumbnail,
            transcript: content
          } satisfies SourceVideo;
        } catch {
          return fetchDirectVideo(id, language);
        }
      });

      return { type: "playlist", title: playlist.title, channel: playlist.channel?.name, videos };
    } catch (err) {
      console.warn("Supadata failed for playlist, falling back to direct scraper:", err);
    }
  }

  // Direct scraper fallback for playlists
  const playlist = await fetchDirectPlaylist(parsed.id, playlistMax, language);
  return {
    type: "playlist",
    title: playlist.title,
    channel: playlist.channel,
    videos: playlist.videos
  };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (true) {
      const current = index++;
      if (current >= items.length) return;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
