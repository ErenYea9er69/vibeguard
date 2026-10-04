import { SourceVideo } from "./types";

const SUPADATA = "https://api.supadata.ai/v1";

export function detectYouTubeInput(input: string) {
  try {
    const url = new URL(input.trim());
    const playlistId = url.searchParams.get("list");
    const videoId = url.searchParams.get("v") || (url.hostname === "youtu.be" ? url.pathname.slice(1) : null);
    if (playlistId) return { type: "playlist" as const, id: playlistId };
    if (videoId) return { type: "video" as const, id: videoId };
    if (url.pathname.startsWith("/shorts/")) return { type: "video" as const, id: url.pathname.split("/")[2] };
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

export async function getSourceVideos(input: string, maxVideos: number, language: string): Promise<{ videos: SourceVideo[]; title?: string; channel?: string; type: "video" | "playlist" }> {
  const parsed = detectYouTubeInput(input);

  if (parsed.type === "video") {
    const url = `https://www.youtube.com/watch?v=${parsed.id}`;
    const [metadata, transcript] = await Promise.all([
      supadata(`/metadata?url=${encodeURIComponent(url)}`),
      supadata(`/transcript?url=${encodeURIComponent(url)}&lang=${encodeURIComponent(language)}`)
    ]);
    const content = Array.isArray(transcript.content) ? transcript.content.map((x: { text: string }) => x.text).join(" ") : String(transcript.content || "");
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
  }

  const playlist = await supadata(`/youtube/playlist?id=${encodeURIComponent(parsed.id)}`);
  const idsData = await supadata(`/youtube/playlist/videos?id=${encodeURIComponent(parsed.id)}&limit=${Math.min(maxVideos, 100)}`);
  const ids = (idsData.videoIds || []).slice(0, maxVideos);

  const videos = await mapWithConcurrency(ids, 4, async (id: string) => {
    const url = `https://www.youtube.com/watch?v=${id}`;
    try {
      const [metadata, transcript] = await Promise.all([
        supadata(`/metadata?url=${encodeURIComponent(url)}`),
        supadata(`/transcript?url=${encodeURIComponent(url)}&lang=${encodeURIComponent(language)}`)
      ]);
      const content = Array.isArray(transcript.content) ? transcript.content.map((x: { text: string }) => x.text).join(" ") : String(transcript.content || "");
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
    } catch (error) {
      return {
        id,
        url,
        title: `Video ${id}`,
        transcript: "",
        description: `Could not retrieve transcript: ${error instanceof Error ? error.message : "unknown error"}`
      } satisfies SourceVideo;
    }
  });

  return { type: "playlist", title: playlist.title, channel: playlist.channel?.name, videos };
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
