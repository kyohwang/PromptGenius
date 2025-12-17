import { Prompt, Settings } from '../storage/models';

export function buildPreferenceProfile(settings: Settings, prompts: Prompt[]): string {
  const tone = settings.tone || 'Concise, friendly, and direct';
  const language = settings.preferredLanguage || 'English';
  const quality = settings.qualityBar || 'Structured, verifiable, and outcome-focused';

  const tagScore = new Map<string, number>();
  for (const prompt of prompts) {
    const weight = Math.max(1, prompt.useCount || 0);
    (prompt.tags || []).forEach((tag) => {
      const key = tag.trim().toLowerCase();
      if (!key) return;
      tagScore.set(key, (tagScore.get(key) || 0) + weight);
    });
  }
  const topTags = Array.from(tagScore.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag)
    .join(', ');

  const tagLine = topTags ? `Frequently used domains/tags: ${topTags}.` : 'No dominant tags yet.';

  return [
    `Language preference: ${language}.`,
    `Tone: ${tone}.`,
    `Quality bar: ${quality}.`,
    tagLine,
    'Output style: prefers numbered steps, clear acceptance criteria, and bullet point highlights.',
    'Avoid filler; prioritize concise instructions and explicit delimiters for inputs/outputs.'
  ].join(' ');
}
