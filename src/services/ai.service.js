import OpenAI from 'openai';

let mockAIProviderHandler = null;

export function setMockAIProvider(handler) {
  mockAIProviderHandler = handler;
}

export function resetMockAIProvider() {
  mockAIProviderHandler = null;
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error('AI API key is missing. Please set OPENAI_API_KEY or AI_API_KEY.');
  }
  return new OpenAI({ apiKey });
}

export async function checkGermanGrammar(sentence) {
  const openai = getOpenAIClient();
  const prompt = `
You are a German grammar checker.

Return JSON only:
{
  "correct": true/false,
  "corrected": "...",
  "errors": ["..."]
}

Sentence: "${sentence}"
`;

  const response = await openai.chat.completions.create({
    model: process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    max_tokens: 100,
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Low-level call to OpenAI chat completion API
 * @param {Object} options
 * @param {string} options.systemPrompt
 * @param {Array<{role: string, content: string}>} options.messages
 * @param {number} [options.temperature=0.7]
 * @param {number} [options.maxTokens=500]
 * @param {Object} [options.responseFormat={ type: 'json_object' }]
 * @returns {Promise<string>} raw AI content response string
 */
export async function callAIProvider({
  systemPrompt,
  messages,
  temperature = 0.7,
  maxTokens = 500,
  responseFormat = { type: 'json_object' },
}) {
  if (mockAIProviderHandler) {
    return mockAIProviderHandler({ systemPrompt, messages, temperature, maxTokens, responseFormat });
  }

  const openai = getOpenAIClient();
  const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const fullMessages = [];
  if (systemPrompt) {
    fullMessages.push({ role: 'system', content: systemPrompt });
  }
  fullMessages.push(...messages);

  const requestOptions = {
    model,
    messages: fullMessages,
    temperature,
    max_tokens: maxTokens,
  };

  if (responseFormat) {
    requestOptions.response_format = responseFormat;
  }

  const completion = await openai.chat.completions.create(requestOptions);
  return completion.choices[0]?.message?.content || '';
}