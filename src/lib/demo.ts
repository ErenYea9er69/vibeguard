import { GeneratedDocument } from "./types";

export const demoDocument: GeneratedDocument = {
  title: "Build a Small Full-Stack Web App with Next.js",
  subtitle: "A compact learning path generated from a YouTube-style course source",
  format: "course",
  audience: "Developers who know basic JavaScript and want a practical Next.js workflow.",
  estimatedTime: "3 to 5 hours",
  source: {
    url: "https://www.youtube.com/playlist?list=DEMO",
    type: "playlist",
    title: "Next.js Practical Foundations",
    channel: "CourseForge Demo",
    videoCount: 6
  },
  summary: "This course turns a linear video sequence into a structured path. It separates setup, routing, data flow, API work, validation, and deployment concerns so the learner builds while learning.",
  learningOutcomes: [
    "Explain the App Router mental model.",
    "Build typed UI flows with server and client boundaries.",
    "Create an API route validating input.",
    "Ship a small production-minded Next.js project."
  ],
  sections: [
    {
      title: "Foundations",
      intro: "Start with the mental model and the project structure before writing features.",
      lessons: [
        {
          title: "Understand the App Router",
          objective: "Know what a route, layout, page, and server component do.",
          summary: "Next.js maps the app folder to URL structure and keeps server-rendered UI close to the data it uses.",
          keyPoints: ["Folders map to route segments.", "Layouts persist across navigation.", "Server components reduce client-side JavaScript."],
          examples: ["Build /dashboard from app/dashboard/page.tsx.", "Keep navigation in a shared layout."],
          exercise: "Create /courses and /courses/[id] without adding a client library.",
          sourceVideoIds: ["demo-1"]
        },
        {
          title: "Choose the Client Boundary",
          objective: "Use client components only where interactivity needs them.",
          summary: "Interactive forms and browser APIs need a client component. Static rendering stays on the server.",
          keyPoints: ["State belongs near the interaction.", "Do not make the whole page client-side by default."],
          examples: ["Use a client component for a form and keep the results page server-rendered."],
          exercise: "Move one interactive control behind a small client boundary.",
          sourceVideoIds: ["demo-2"]
        }
      ],
      keyTakeaways: ["Start server-first.", "Keep client boundaries small."],
      sourceVideoIds: ["demo-1", "demo-2"]
    },
    {
      title: "Build the Data Flow",
      intro: "Connect UI input to a validated API route and a durable domain shape.",
      lessons: [
        {
          title: "Validate at the Boundary",
          objective: "Reject bad data before it reaches business logic.",
          summary: "Schema validation keeps the API contract explicit and gives the UI clear error messages.",
          keyPoints: ["Validate input at the boundary.", "Return stable response shapes.", "Do not trust client-side validation alone."],
          examples: ["Use a Zod schema for a course generation request."],
          exercise: "Add a schema rejecting empty source URLs and invalid output formats.",
          sourceVideoIds: ["demo-3"]
        }
      ],
      keyTakeaways: ["Treat API routes as trust boundaries.", "Type the domain model once and reuse it."],
      sourceVideoIds: ["demo-3"]
    }
  ],
  glossary: [
    { term: "App Router", definition: "The file-system routing model used by modern Next.js applications." },
    { term: "Server component", definition: "A React component rendering on the server without shipping implementation code to the browser." },
    { term: "Schema", definition: "A formal description of the shape and rules a data object must follow." }
  ],
  finalChecklist: [
    "Create a route from the app directory.",
    "Keep interactive code behind a client boundary.",
    "Validate the request before processing it.",
    "Export the final learning artifact as HTML or JSON."
  ],
  generatedAt: new Date().toISOString()
};
