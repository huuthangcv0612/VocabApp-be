/**
 * Deterministic scoring helper for AI Conversation session summary
 * 
 * @param {Object} summary
 * @param {number} summary.target_vocabulary_count
 * @param {number} summary.used_vocabulary_count
 * @param {number} summary.mistake_count
 * @param {number} summary.turn_count
 * @returns {number} Score integer between 0 and 100
 */
export function calculateConversationScore({
  target_vocabulary_count = 0,
  used_vocabulary_count = 0,
  mistake_count = 0,
  turn_count = 0,
}) {
  // Participation score (up to 40 pts based on 10 max turns)
  const participationRatio = Math.min(1, Math.max(0, turn_count / 10));
  const participationScore = Math.round(participationRatio * 40);

  // Vocabulary usage score (up to 50 pts based on target vocabulary ratio)
  const safeTargetCount = target_vocabulary_count > 0 ? target_vocabulary_count : 1;
  const vocabRatio = Math.min(1, Math.max(0, used_vocabulary_count / safeTargetCount));
  const vocabScore = Math.round(vocabRatio * 50);

  // Accuracy bonus / mistake penalty (up to 10 pts, minus 2 per mistake)
  const accuracyScore = Math.max(0, 10 - Math.max(0, mistake_count) * 2);

  // Total score clamped between 0 and 100
  const rawScore = participationScore + vocabScore + accuracyScore;
  return Math.min(100, Math.max(0, rawScore));
}
