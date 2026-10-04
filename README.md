# CourseForge

CourseForge turns a YouTube video or playlist into a structured learning artifact.

Input:
- YouTube playlist URL
- YouTube video URL
- Playlist ID
- Video ID

Output:
- Course
- Article
- Blog
- JSON
- HTML
- PDF

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Gemini structured JSON output
- Supadata for YouTube metadata and transcript ingestion
- Zod for request validation
- React PDF for server-side PDF exports

## Quick start

1. Install Node 20.9+.
2. Copy `.env.example` to `.env.local`.
3. Add `SUPADATA_API_KEY` and `GEMINI_API_KEY`.
4. Run `npm install`.
5. Run `npm run dev`.
6. Open `http://localhost:3000`.

The app works in demo mode when the API keys are missing. That lets you review the UI and export pipeline without external services.

## Real pipeline

1. Detect video vs playlist input.
2. Get the playlist's video IDs or the single video ID.
3. Pull metadata and transcripts.
4. Normalize transcripts into source objects.
5. Ask Gemini for a typed document structure.
6. Render the result in the editor.
7. Export the same document as JSON, HTML, or PDF.

## Production upgrade path

The sample implementation keeps generation in one request so the project stays easy to understand. For large playlists, move the job to a queue such as Inngest, Trigger.dev, BullMQ, or a hosted workflow engine. Persist job status in Postgres, process videos in parallel with a bounded concurrency limit, and store only data you have the right to retain.

For very long playlists, use a hierarchical pipeline:

- transcript retrieval
- per-video summary
- section synthesis
- final course synthesis
- validation and export

This reduces context size and gives you better traceability than sending every transcript to one model call.

## Important source and policy considerations

YouTube's official Data API can list playlist items. Its caption download endpoint requires permission to edit the video, so a public playlist conversion product should not assume it can fetch captions from arbitrary videos through the official caption endpoint.

This project uses Supadata as a separate transcript provider. Review its current pricing, terms, rate limits, retention rules, and supported URL formats before launch.

YouTube API Services require compliance with YouTube's Terms, Developer Policies, privacy requirements, and restrictions around storing or redistributing YouTube data and audiovisual content. The product should provide clear attribution and links to YouTube terms, and avoid downloading or redistributing video/audio files.

Do not treat generated course text as a substitute for the creator's original work. Add a rights/terms flow for commercial use, creator ownership, takedown requests, and user accountability before public launch.

## Why this product is stronger than a summarizer

The useful product layer is not the summary. The product value sits in the transformation pipeline:

source detection → transcript normalization → concept extraction → deduplication → curriculum design → lesson generation → exercises → source traceability → polished exports.

A strong version should preserve links to original videos, show which video supports each section, allow the user to edit the generated artifact, and keep a reproducible generation record.

## Studio (in-app creation)

The result view now has five tabs: Read, Analysis, AI design, Quiz, Flashcards.

- Analysis: `/api/analyze` scores each video, weights concepts, lists gaps and repeated material.
- AI design: `/api/studio` with `kind: "design"` asks Gemini for a full interactive HTML page in one of four styles (editorial, workbook, dashboard, slides). The page opens in a sandboxed iframe. Without a Gemini key, `src/lib/design-fallback.ts` builds the page.
- Quiz and flashcards: `/api/studio` with `kind: "kit"`.
- Skill prompts live in `src/lib/skills.ts`: UI design, analysis, and study. Edit them to change how the AI behaves.
- Downloads remain under "Download copy" in the sidebar.
