import { callAIProvider } from './ai.service.js';

/**
 * System Prompt for DeutschUp Support & FAQ Assistant
 */
export const buildAssistantSystemPrompt = ({ user = null, locale = 'vi' }) => {
  const userInfo = user
    ? `Current User: ${user.name || 'Learner'} (Email: ${user.email}, Role: ${user.role})`
    : 'User: Guest (Not logged in)';

  return `
You are the official AI Support & FAQ Assistant for DeutschUp (VocabApp), an interactive German learning platform.

${userInfo}
Preferred Language: ${locale === 'en' ? 'English' : 'Vietnamese'}

KNOWLEDGE BASE & SCOPE:
1. Platform Purpose: DeutschUp helps learners master the German language from CEFR levels A1 to B2 through curated vocabulary, grammar lessons, interactive quizzes, audio pronunciation (Azure TTS), and AI conversational tutoring.
2. Subscription Plans:
   - FREE Plan: Access to basic vocabulary, lessons, and standard quizzes.
   - PREMIUM Plan: Unlimited AI German Conversation tutor, AI sentence evaluation, grammar error analysis, and priority access.
   - CUSTOM / TEACHER Plan: Create and manage classrooms, invite students, host live interactive quiz sessions, and access teacher analytics.
3. Payment via VietQR:
   - Users select a plan, generating a unique order code (DU...) and QR code.
   - Users scan the QR using any Vietnamese banking app (or transfer to the exact account number and amount with the DU... code in the transfer description).
   - Orders expire in 15 minutes if unpaid. Payment status updates automatically once the transfer is confirmed.
4. FAQ & Guidance:
   - Email verification is required before first login.
   - If a payment doesn't activate automatically, users can check their order status under Orders or contact support.

CRITICAL GUARDRAILS & INSTRUCTIONS:
- You ONLY answer questions related to DeutschUp, German learning, courses, lessons, subscriptions, payments, and platform usage.
- If the user asks off-topic questions (e.g., asking you to write general code, discuss politics, celebrities, or unrelated topics), POLITELY DECLINE and guide them back to DeutschUp and German learning.
- Match the user's language: If the user writes in Vietnamese, reply in Vietnamese. If the user writes in English, reply in English. If the user asks in German, you may reply in German with helpful translations.
- Be concise, friendly, encouraging, and helpful. Keep responses under 250 words unless detailed step-by-step instructions are required.
- Do NOT make up promises about discounts or refund policies not mentioned above.
`;
};

/**
 * Handle user conversation with DeutschUp Assistant
 *
 * @param {Object} options
 * @param {string} options.message - User's query
 * @param {Array<{role: string, content: string}>} [options.history=[]] - Conversation history
 * @param {Object} [options.user=null] - Authenticated user if available
 * @param {string} [options.locale='vi'] - Request locale ('vi' or 'en')
 * @returns {Promise<{ reply: string, suggestions: string[] }>}
 */
export async function askFaqAssistant({
  message,
  history = [],
  user = null,
  locale = 'vi',
}) {
  const systemPrompt = buildAssistantSystemPrompt({ user, locale });

  // Sanitize and limit history to the last 6 messages
  const sanitizedHistory = Array.isArray(history)
    ? history
        .slice(-6)
        .filter(
          (m) =>
            m &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string'
        )
        .map((m) => ({ role: m.role, content: m.content.slice(0, 500) }))
    : [];

  const messages = [
    ...sanitizedHistory,
    { role: 'user', content: String(message).trim().slice(0, 500) },
  ];

  const rawReply = await callAIProvider({
    systemPrompt,
    messages,
    temperature: 0.5,
    maxTokens: 600,
    responseFormat: null, // Natural text completion
  });

  const reply = rawReply?.trim() || (locale === 'en'
    ? 'I am currently unable to process your request. Please try again shortly.'
    : 'Hiện tại tôi chưa thể xử lý yêu cầu của bạn. Vui lòng thử lại sau ít phút.');

  // Contextual smart suggestions
  const defaultSuggestions = locale === 'en'
    ? [
        'What are the Premium plan benefits?',
        'How does VietQR payment work?',
        'What German levels are available?',
      ]
    : [
        'Gói Premium có những quyền lợi gì?',
        'Cách thanh toán bằng chuyển khoản VietQR?',
        'Hệ thống có những cấp độ tiếng Đức nào?',
      ];

  return {
    reply,
    suggestions: defaultSuggestions,
  };
}

export default {
  buildAssistantSystemPrompt,
  askFaqAssistant,
};
