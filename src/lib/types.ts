export type OutputFormat = "course" | "article" | "blog";
export type DeliverableFormat = "html" | "pdf" | "markdown" | "json";
export type Tone = "clear" | "technical" | "academic" | "practical";
export type DesignStyle = "editorial" | "workbook" | "dashboard" | "slides";
export type DesignStyleOption = "auto" | DesignStyle;

export type SourceVideo = {
  id: string;
  url: string;
  title: string;
  description?: string;
  duration?: number;
  channel?: string;
  thumbnail?: string;
  transcript: string;
};

export type Lesson = {
  title: string;
  objective: string;
  summary: string;
  keyPoints: string[];
  examples: string[];
  exercise?: string;
  sourceVideoIds: string[];
};

export type Section = {
  title: string;
  intro: string;
  lessons?: Lesson[];
  body?: string[];
  keyTakeaways: string[];
  sourceVideoIds: string[];
};

export type GeneratedDocument = {
  title: string;
  subtitle: string;
  format: OutputFormat;
  deliverableFormat?: DeliverableFormat;
  audience: string;
  estimatedTime: string;
  source: {
    url: string;
    type: "video" | "playlist";
    title?: string;
    channel?: string;
    videoCount: number;
  };
  summary: string;
  learningOutcomes: string[];
  sections: Section[];
  glossary: Array<{ term: string; definition: string }>;
  finalChecklist: string[];
  generatedAt: string;
  generatedHtml?: string;
  generatedMarkdown?: string;
};

export type Analysis = {
  topic: string;
  level: "beginner" | "intermediate" | "advanced";
  readingMinutes: number;
  prerequisites: string[];
  concepts: Array<{ name: string; weight: number; dependsOn: string[]; videoIds: string[] }>;
  coverage: Array<{ videoId: string; title: string; score: number; note: string }>;
  gaps: string[];
  redundancy: string[];
  recommendedFormat: OutputFormat;
  verdict: string;
};

export type QuizQuestion = { question: string; options: string[]; answerIndex: number; explanation: string; sourceVideoId?: string };
export type Flashcard = { front: string; back: string };
export type StudyKit = { quiz: QuizQuestion[]; flashcards: Flashcard[] };
