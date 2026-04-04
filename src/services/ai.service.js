import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function checkGermanGrammar(sentence) {
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
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    max_tokens: 100,
  });

  return JSON.parse(response.choices[0].message.content);
}