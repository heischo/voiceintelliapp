// Enrichment Engine - Prompt Templates for 5 Modes

import type { EnrichmentMode, EnrichmentOptions, Language } from '../types';

export interface EnrichmentPrompt {
  system: string;
  user: (transcript: string, options?: EnrichmentOptions) => string;
}

const LANGUAGE_INSTRUCTIONS: Record<Language, string> = {
  en: 'Respond in English.',
  de: 'Antworte auf Deutsch.',
  no: 'Svar på norsk.',
};

export const ENRICHMENT_PROMPTS: Record<EnrichmentMode, EnrichmentPrompt> = {
  'meeting-notes': {
    system: `You are an expert meeting notes assistant. Your task is to transform raw voice transcripts into well-structured, professional meeting notes.

Guidelines:
- Use clear headings and bullet points
- Identify key topics discussed
- Highlight important decisions made
- Note any deadlines or commitments mentioned
- Keep the tone professional and concise
- Preserve important details while removing filler words`,

    user: (transcript: string) => `Please convert the following voice transcript into structured meeting notes:

---
${transcript}
---

Format the notes with:
- A brief summary at the top
- Key discussion points as bullet points
- Any action items or decisions highlighted
- Participants mentioned (if any)`,
  },

  'clean-transcript': {
    system: `You are a transcript editor. Your task is to clean up raw voice transcripts while preserving the original meaning and intent.

Guidelines:
- Remove filler words (um, uh, like, you know)
- Fix grammar and punctuation
- Break into logical paragraphs
- Maintain the speaker's voice and style
- Do NOT summarize or remove content
- Do NOT add information that wasn't said`,

    user: (transcript: string) => `Please clean up the following voice transcript. Remove filler words, fix grammar, and add proper punctuation while preserving the original meaning:

---
${transcript}
---`,
  },

  'action-items': {
    system: `You are a task extraction specialist. Your task is to identify and extract action items, tasks, and to-dos from voice transcripts.

Guidelines:
- Extract clear, actionable items
- Include who is responsible (if mentioned)
- Include deadlines (if mentioned)
- Prioritize items if context suggests urgency
- Format as a checklist
- If no clear action items exist, state that clearly`,

    user: (transcript: string) => `Extract all action items, tasks, and to-dos from the following transcript:

---
${transcript}
---

Format as a checklist with:
- [ ] Task description
- Assignee (if mentioned)
- Deadline (if mentioned)`,
  },

  'summary': {
    system: `You are a summarization expert. Your task is to create concise, accurate summaries of voice transcripts.

Guidelines:
- Capture the main points and key information
- Be concise but complete
- Maintain accuracy - don't add information
- Use clear, professional language
- Respect the requested length`,

    user: (transcript: string, options?: EnrichmentOptions) => {
      const sentences = options?.sentences || 3;
      return `Summarize the following transcript in approximately ${sentences} sentences:

---
${transcript}
---

Provide a clear, concise summary that captures the essential information.`;
    },
  },

  'custom': {
    system: `You are a helpful AI assistant processing voice transcripts. Follow the user's specific instructions carefully.`,

    user: (transcript: string, options?: EnrichmentOptions) => {
      const customPrompt = options?.customPrompt || 'Process this transcript:';
      return `${customPrompt}

---
${transcript}
---`;
    },
  },
};

export function buildEnrichmentMessages(
  transcript: string,
  mode: EnrichmentMode,
  language: Language = 'en',
  options?: EnrichmentOptions
): { system: string; user: string } {
  const prompt = ENRICHMENT_PROMPTS[mode];
  const languageInstruction = LANGUAGE_INSTRUCTIONS[language];

  return {
    system: `${prompt.system}\n\n${languageInstruction}`,
    user: prompt.user(transcript, options),
  };
}

export function validateTranscript(transcript: string): {
  valid: boolean;
  error?: string;
} {
  if (!transcript || transcript.trim().length === 0) {
    return { valid: false, error: 'Transcript is empty' };
  }

  if (transcript.trim().length < 10) {
    return { valid: false, error: 'Transcript is too short (minimum 10 characters)' };
  }

  return { valid: true };
}
