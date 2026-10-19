import { config } from '../config.js';

// Messages on this error are safe to show to users
export class AiError extends Error {}

export const isGroqConfigured = () => Boolean(config.groqApiKey);

// Models with strict structured outputs (constrained decoding); other models get JSON object mode
const supportsStrictSchema = (model) => /^(openai\/gpt-oss|qwen\/)/.test(model);
const isReasoningModel = (model) => model.startsWith('openai/gpt-oss');

// Calls Groq's OpenAI-compatible chat completions API and returns the parsed JSON reply.
// Callers must still validate the result: it is model output, not trusted data.
export async function generateJson({ system, user, schemaName, schema, maxTokens = 8000, timeoutMs = 90000 }) {
  const model = config.groqModel;
  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.4,
    max_completion_tokens: maxTokens,
    response_format: supportsStrictSchema(model)
      ? { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } }
      : { type: 'json_object' },
    // Reasoning tokens count toward max_completion_tokens; keep them small for a scoring task
    ...(isReasoningModel(model) && { reasoning_effort: 'low' }),
  };

  let res;
  try {
    res = await fetch(`${config.groqBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') throw new AiError('The AI took too long to answer. Please try again.');
    throw new AiError('Could not reach the AI service. Please try again.');
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[groq] HTTP ${res.status}: ${detail.slice(0, 500)}`);
    if (res.status === 401) throw new AiError("The server's Groq API key was rejected.");
    if (res.status === 429) throw new AiError('The AI service is busy right now. Try again in a minute.');
    if (res.status === 413) throw new AiError('These squads are too much for the AI service in one go. Try again in a minute.');
    throw new AiError('The AI service returned an error. Please try again.');
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new AiError('The AI answer was cut off. Please try again.');
  }
  try {
    return JSON.parse(choice?.message?.content ?? '');
  } catch {
    throw new AiError('The AI returned an unreadable answer. Please try again.');
  }
}
