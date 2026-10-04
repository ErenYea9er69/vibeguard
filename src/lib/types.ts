export type OutputFormat = "course" | "article" | "blog";
export type Tone = "clear" | "technical" | "academic" | "practical";

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
};
