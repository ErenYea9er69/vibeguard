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

function parseTimedTextXml(xml: string): string {
  // 1. Try srv3 format (<p t="..." d="..."><s>...</s></p>)
  const pRegex = /<p\s+[^>]*>([\s\S]*?)<\/p>/g;
  const sRegex = /<s[^>]*>([\s\S]*?)<\/s>/g;
  const lines: string[] = [];

  let pMatch;
  while ((pMatch = pRegex.exec(xml)) !== null) {
    const inner = pMatch[1];
    let lineText = "";
    let sMatch;
    while ((sMatch = sRegex.exec(inner)) !== null) {
      lineText += sMatch[1];
    }
    if (!lineText) {
      lineText = inner.replace(/<[^>]+>/g, "");
    }
    lineText = lineText
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();
    if (lineText) lines.push(lineText);
  }

  if (lines.length > 0) {
    return lines.join(" ");
  }

  // 2. Fallback to classic format (<text start="...">...</text>)
  const textMatches = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)];
  if (textMatches.length > 0) {
    return textMatches
      .map(m => m[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .trim())
      .filter(Boolean)
      .join(" ");
  }

  return "";
}

function dedupeRollingCaptions(text: string): string {
  if (!text) return "";
  const words = text.split(/\s+/).filter(Boolean);
  const result: string[] = [];
  let i = 0;
  while (i < words.length) {
    let matchedLen = 0;
    // Look for repeated phrases between 2 and 25 words (common in rolling ticker subtitles)
    for (let len = 2; len <= 25; len++) {
      if (i + len * 2 <= words.length) {
        const chunk1 = words.slice(i, i + len).join(" ");
        const chunk2 = words.slice(i + len, i + len * 2).join(" ");
        if (chunk1 === chunk2) {
          matchedLen = len;
          break;
        }
      }
    }
    if (matchedLen > 0) {
      result.push(...words.slice(i, i + matchedLen));
      i += matchedLen * 2;
      while (
        i + matchedLen <= words.length &&
        words.slice(i, i + matchedLen).join(" ") === words.slice(i - matchedLen, i).join(" ")
      ) {
        i += matchedLen;
      }
    } else {
      result.push(words[i]);
      i++;
    }
  }
  return result.join(" ");
}

async function fetchFromTranscriptAi(videoId: string): Promise<{ text: string; title?: string } | null> {
  try {
    const res = await fetch(`https://youtube-transcript.ai/transcript/${encodeURIComponent(videoId)}.txt`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/plain, */*",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const raw = await res.text();
    if (!raw || raw.length < 50 || raw.includes("Page not found") || raw.includes("Cloudflare")) return null;

    const titleMatch = raw.match(/^#\s*Transcript:\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    let body = raw;
    const splitIdx = raw.indexOf("## Transcript");
    if (splitIdx !== -1) {
      body = raw.slice(splitIdx + "## Transcript".length);
    }
    const footerIdx = body.indexOf("\n---");
    if (footerIdx !== -1) {
      body = body.slice(0, footerIdx);
    }

    const cleanLines = body
      .split("\n")
      .map(line => line.replace(/^\[\d+:\d+(?::\d+)?\]\s*/, "").trim())
      .filter(Boolean);

    const rawJoined = cleanLines.join(" ");
    const deduped = dedupeRollingCaptions(rawJoined);
    if (deduped && deduped.length > 50) {
      return { text: deduped, title };
    }
  } catch (err) {
    console.warn("youtube-transcript.ai extraction failed:", err);
  }
  return null;
}

export async function extractDirectTranscriptWithMeta(videoId: string, language?: string): Promise<{ text: string; title?: string }> {
  // Strategy 1: Dedicated Free Cloud-Resilient API (bypasses datacenter blocks on Vercel)
  const fromAi = await fetchFromTranscriptAi(videoId);
  if (fromAi && fromAi.text.length > 50) {
    return fromAi;
  }

  const langCode = language && language !== "auto" ? language : "en";

  // Strategy 2: InnerTube Android client with full client headers
  try {
    const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
        "X-YouTube-Client-Name": "3",
        "X-YouTube-Client-Version": "20.10.38",
        "Origin": "https://www.youtube.com",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "20.10.38",
            androidSdkVersion: 34,
            hl: langCode,
            gl: "US",
          },
        },
        videoId,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(captionTracks) && captionTracks.length > 0) {
        const track = (language && language !== "auto")
          ? (captionTracks.find((t: { languageCode: string }) => t.languageCode === language) || captionTracks[0])
          : captionTracks[0];

        if (track?.baseUrl) {
          const subRes = await fetch(track.baseUrl, {
            headers: {
              "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
              "Accept": "*/*",
            },
            signal: AbortSignal.timeout(8000),
          });
          if (subRes.ok) {
            const raw = await subRes.text();
            const text = dedupeRollingCaptions(parseTimedTextXml(raw));
            if (text && text.length > 50) return { text };
          }
        }
      }
    }
  } catch (err) {
    console.warn("Direct InnerTube Android transcript failed:", err);
  }

  // Strategy 3: InnerTube ANDROID_TESTSUITE client fallback
  try {
    const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
        "X-YouTube-Client-Name": "30",
        "X-YouTube-Client-Version": "20.10.38",
        "Origin": "https://www.youtube.com",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID_TESTSUITE",
            clientVersion: "20.10.38",
            hl: langCode,
            gl: "US",
          },
        },
        videoId,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(captionTracks) && captionTracks.length > 0) {
        const track = (language && language !== "auto")
          ? (captionTracks.find((t: { languageCode: string }) => t.languageCode === language) || captionTracks[0])
          : captionTracks[0];

        if (track?.baseUrl) {
          const subRes = await fetch(track.baseUrl, {
            headers: {
              "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
              "Accept": "*/*",
            },
            signal: AbortSignal.timeout(8000),
          });
          if (subRes.ok) {
            const raw = await subRes.text();
            const text = dedupeRollingCaptions(parseTimedTextXml(raw));
            if (text && text.length > 50) return { text };
          }
        }
      }
    }
  } catch (err) {
    console.warn("Direct InnerTube TESTSUITE transcript failed:", err);
  }

  // Strategy 4: Web Watch Page playerResponse scraper
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      },
      signal: AbortSignal.timeout(8000),
    });
    if (pageRes.ok) {
      const html = await pageRes.text();
      const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});(?:var|\s*<\/script>|\s*;\s*const)/);
      if (match) {
        const data = JSON.parse(match[1]);
        const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (Array.isArray(captionTracks) && captionTracks.length > 0) {
          const track = (language && language !== "auto")
            ? (captionTracks.find((t: { languageCode: string }) => t.languageCode === language) || captionTracks[0])
            : captionTracks[0];

          if (track?.baseUrl) {
            const subRes = await fetch(track.baseUrl, { signal: AbortSignal.timeout(8000) });
            if (subRes.ok) {
              const raw = await subRes.text();
              const text = dedupeRollingCaptions(parseTimedTextXml(raw));
              if (text && text.length > 50) return { text };
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("Watch page scraper failed:", err);
  }

  // Strategy 5: youtube-transcript package fallback
  try {
    const items = await YoutubeTranscript.fetchTranscript(
      videoId,
      language && language !== "auto" ? { lang: language } : undefined
    );
    if (items && items.length) {
      const text = dedupeRollingCaptions(items.map(item => item.text).join(" "));
      return { text };
    }
  } catch {}

  return { text: "" };
}

export async function extractDirectTranscript(videoId: string, language?: string): Promise<string> {
  const res = await extractDirectTranscriptWithMeta(videoId, language);
  return res.text;
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

  // 2. Fetch transcript via robust multi-strategy extractor
  const { text: transcript, title: transcriptTitle } = await extractDirectTranscriptWithMeta(videoId, language);
  if (transcriptTitle && (!title || title.startsWith("Video "))) {
    title = transcriptTitle;
  }

  // 3. Extract description only for metadata (never fake a transcript with YouTube's 31-word slogan)
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
        const rawDesc = descMatch[1].trim();
        // Ignore YouTube's boilerplate site slogans
        if (!rawDesc.includes("Enjoy the videos and music") && !rawDesc.includes("upload original content") && rawDesc.length > 40) {
          description = rawDesc;
        }
      }
    }
  } catch {}

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

export type SourceProgressCallback = (info: {
  stage: "detecting" | "playlist_found" | "video_found" | "video_transcript" | "transcript_progress" | "complete";
  title?: string;
  channel?: string;
  current?: number;
  total?: number;
  videoTitle?: string;
  words?: number;
  message: string;
}) => void;

async function fetchDirectPlaylist(
  playlistId: string,
  maxVideos: number,
  language?: string,
  onProgress?: SourceProgressCallback
): Promise<{ videos: SourceVideo[]; title: string; channel?: string }> {
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

  onProgress?.({
    stage: "playlist_found",
    title: playlistTitle,
    total: selectedIds.length,
    message: `Discovered playlist "${playlistTitle}" with ${selectedIds.length} videos`
  });

  let completedCount = 0;
  const videos = await mapWithConcurrency(selectedIds, 4, async (id: string) => {
    const video = await fetchDirectVideo(id, language);
    completedCount++;
    const words = video.transcript ? video.transcript.split(/\s+/).filter(Boolean).length : 0;
    onProgress?.({
      stage: "transcript_progress",
      current: completedCount,
      total: selectedIds.length,
      videoTitle: video.title,
      words,
      message: `Extracted transcript [${completedCount}/${selectedIds.length}]: "${video.title}" (${words.toLocaleString()} words)`
    });
    return video;
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
  language: string,
  onProgress?: SourceProgressCallback
): Promise<{ videos: SourceVideo[]; title?: string; channel?: string; type: "video" | "playlist" }> {
  onProgress?.({
    stage: "detecting",
    message: "Analyzing YouTube link format..."
  });
  const parsed = detectYouTubeInput(input);

  // If single video, always lock maxVideos to 1
  if (parsed.type === "video") {
    onProgress?.({
      stage: "video_found",
      message: `Connecting to video ${parsed.id}...`
    });

    // Try Supadata if key available
    if (process.env.SUPADATA_API_KEY) {
      try {
        const url = `https://www.youtube.com/watch?v=${parsed.id}`;
        const [metadata, transcript] = await Promise.all([
          supadata(`/metadata?url=${encodeURIComponent(url)}`),
          supadata(`/transcript?url=${encodeURIComponent(url)}${language && language !== "auto" ? `&lang=${encodeURIComponent(language)}` : ""}`)
        ]);
        const content = Array.isArray(transcript.content)
          ? transcript.content.map((x: { text: string }) => x.text).join(" ")
          : String(transcript.content || "");
        const words = content ? content.split(/\s+/).filter(Boolean).length : 0;
        onProgress?.({
          stage: "video_transcript",
          title: metadata.title,
          channel: metadata.channel?.name || metadata.author?.name,
          words,
          message: `Retrieved transcript for "${metadata.title || parsed.id}" (${words.toLocaleString()} words)`
        });
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
    const words = video.transcript ? video.transcript.split(/\s+/).filter(Boolean).length : 0;
    onProgress?.({
      stage: "video_transcript",
      title: video.title,
      channel: video.channel,
      words,
      message: words > 0
        ? `Retrieved transcript for "${video.title}" (${words.toLocaleString()} words)`
        : `Could not retrieve automated captions for "${video.title}" (captions missing or restricted by YouTube)`
    });
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

      onProgress?.({
        stage: "playlist_found",
        title: playlist.title,
        total: ids.length,
        message: `Found playlist "${playlist.title}" with ${ids.length} videos`
      });

      let completedCount = 0;
      const videos = await mapWithConcurrency(ids, 4, async (id: string) => {
        const url = `https://www.youtube.com/watch?v=${id}`;
        let item: SourceVideo;
        try {
          const [metadata, transcript] = await Promise.all([
            supadata(`/metadata?url=${encodeURIComponent(url)}`),
            supadata(`/transcript?url=${encodeURIComponent(url)}${language && language !== "auto" ? `&lang=${encodeURIComponent(language)}` : ""}`)
          ]);
          const content = Array.isArray(transcript.content)
            ? transcript.content.map((x: { text: string }) => x.text).join(" ")
            : String(transcript.content || "");
          item = {
            id,
            url,
            title: metadata.title || `Video ${id}`,
            description: metadata.description,
            duration: metadata.duration,
            channel: metadata.channel?.name || metadata.author?.name,
            thumbnail: metadata.media?.thumbnail,
            transcript: content
          };
        } catch {
          item = await fetchDirectVideo(id, language);
        }
        completedCount++;
        const words = item.transcript ? item.transcript.split(/\s+/).filter(Boolean).length : 0;
        onProgress?.({
          stage: "transcript_progress",
          current: completedCount,
          total: ids.length,
          videoTitle: item.title,
          words,
          message: `Extracted transcript [${completedCount}/${ids.length}]: "${item.title}" (${words.toLocaleString()} words)`
        });
        return item;
      });

      return { type: "playlist", title: playlist.title, channel: playlist.channel?.name, videos };
    } catch (err) {
      console.warn("Supadata failed for playlist, falling back to direct scraper:", err);
    }
  }

  // Direct scraper fallback for playlists
  const playlist = await fetchDirectPlaylist(parsed.id, playlistMax, language, onProgress);
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
