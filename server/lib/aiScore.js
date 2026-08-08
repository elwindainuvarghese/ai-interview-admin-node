// Calls Claude to score a candidate's answer against the interview question
// (and an optional ideal answer / rubric written by the admin).

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are an interview answer evaluator. You score a candidate's spoken/written answer
to an interview question on a 0-10 scale and give short, specific feedback.

Score based on: correctness, clarity, depth, and relevance to the question.
If an "ideal answer / rubric" is provided, weigh the candidate's answer against it,
but do not penalize different valid approaches that reach the same technical result.

Respond with ONLY minified JSON, no markdown fences, no preamble, in exactly this shape:
{"score": <number 0-10>, "feedback": "<2-3 sentence explanation>", "strengths": ["..."], "gaps": ["..."]}`;

async function scoreAnswer({ questionText, idealAnswer, candidateAnswer }) {
  const userPrompt = `Question: ${questionText}

${idealAnswer ? `Ideal answer / rubric notes: ${idealAnswer}\n\n` : ''}Candidate's answer: ${candidateAnswer}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  const raw = (textBlock?.text || '{}').trim().replace(/^```json|```$/g, '').trim();

  try {
    return JSON.parse(raw);
  } catch (err) {
    // Model didn't return clean JSON — surface the raw text so the admin can still see something
    return { score: null, feedback: raw, strengths: [], gaps: [] };
  }
}

module.exports = { scoreAnswer };
