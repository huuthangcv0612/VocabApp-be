# 🤖 AI Features Documentation

## Tổng quan
VocabApp tích hợp OpenAI để cung cấp các tính năng AI thông minh cho việc học tiếng Anh.

## 🔧 Cài đặt

### 1. Lấy OpenAI API Key
1. Truy cập [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Tạo API key mới
3. Sao chép key và dán vào file `.env`:

```env
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 2. Cài đặt dependencies
```bash
yarn add openai
```

## 📚 API Endpoints

### 1. Đánh giá câu trả lời của học sinh
**Endpoint:** `POST /api/ai/evaluate-sentence`

**Request Body:**
```json
{
  "sentence": "I am happy today",
  "vocabulary": {
    "word": "happy",
    "meaning": "vui vẻ",
    "type": "adjective"
  },
  "context": "Học sinh trả lời câu hỏi về cảm xúc"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sentence": "I am happy today",
    "vocabulary": {
      "word": "happy",
      "meaning": "vui vẻ",
      "type": "adjective"
    },
    "evaluation": {
      "score": 8,
      "accuracy": "Sử dụng từ vựng đúng trong ngữ cảnh",
      "grammar": "Câu đúng ngữ pháp",
      "naturalness": "Câu nghe rất tự nhiên",
      "creativity": "Sử dụng từ vựng cơ bản nhưng chính xác",
      "suggestions": "Có thể thêm chi tiết về lý do vui",
      "corrected_sentence": "I am happy today",
      "feedback": "Tuyệt vời! Bạn đã sử dụng từ 'happy' rất chính xác."
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### 2. Tạo câu hỏi cho từ vựng
**Endpoint:** `POST /api/ai/generate-question`

**Request Body:**
```json
{
  "vocabulary": {
    "word": "run",
    "meaning": "chạy",
    "type": "verb"
  },
  "level": "beginner"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "question": "What do you do every morning?",
    "expected_word": "run",
    "hint": "Think about your daily routine"
  }
}
```

### 3. Phân tích lỗi thường gặp
**Endpoint:** `POST /api/ai/analyze-errors`

**Request Body:**
```json
{
  "sentences": [
    "I run to school",
    "She run fast",
    "They running in park"
  ],
  "vocabulary": {
    "word": "run",
    "meaning": "chạy",
    "type": "verb"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "common_grammar_errors": [
      "Thiếu 's' cho ngôi thứ 3 số ít",
      "Sử dụng dạng V-ing sai"
    ],
    "vocabulary_misuses": [
      "Sử dụng 'run' trong ngữ cảnh không phù hợp"
    ],
    "pronunciation_tips": [
      "Phát âm /rʌn/ rõ ràng",
      "Nhấn mạnh âm /r/"
    ],
    "improvement_suggestions": [
      "Luyện tập các thì động từ",
      "Thực hành với nhiều ví dụ"
    ]
  }
}
```

## 💻 Frontend Integration Examples

### React Hook cho AI Evaluation

```javascript
import { useState } from 'react';

export function useAIEvaluation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const evaluateSentence = async (sentence, vocabulary, context = '') => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/ai/evaluate-sentence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sentence,
          vocabulary,
          context
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { evaluateSentence, loading, error };
}
```

### Component Đánh giá Câu trả lời

```javascript
import React, { useState } from 'react';
import { useAIEvaluation } from './hooks/useAIEvaluation';

export function SentenceEvaluator({ vocabulary }) {
  const [sentence, setSentence] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const { evaluateSentence, loading, error } = useAIEvaluation();

  const handleEvaluate = async () => {
    if (!sentence.trim()) return;

    try {
      const result = await evaluateSentence(
        sentence,
        vocabulary,
        'Đánh giá câu trả lời của học sinh'
      );
      setEvaluation(result.evaluation);
    } catch (err) {
      console.error('Evaluation failed:', err);
    }
  };

  return (
    <div className="sentence-evaluator">
      <h3>Đánh giá câu của bạn</h3>

      <div className="input-section">
        <label>Từ vựng: {vocabulary.word} ({vocabulary.meaning})</label>
        <textarea
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          placeholder="Viết câu sử dụng từ vựng này..."
          rows={3}
        />
        <button
          onClick={handleEvaluate}
          disabled={loading || !sentence.trim()}
        >
          {loading ? 'Đang đánh giá...' : 'Đánh giá'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          Lỗi: {error}
        </div>
      )}

      {evaluation && (
        <div className="evaluation-result">
          <h4>Kết quả đánh giá</h4>
          <div className="score">Điểm: {evaluation.score}/10</div>

          <div className="feedback-sections">
            <div className="section">
              <strong>Độ chính xác:</strong> {evaluation.accuracy}
            </div>
            <div className="section">
              <strong>Ngữ pháp:</strong> {evaluation.grammar}
            </div>
            <div className="section">
              <strong>Tính tự nhiên:</strong> {evaluation.naturalness}
            </div>
            <div className="section">
              <strong>Độ sáng tạo:</strong> {evaluation.creativity}
            </div>
          </div>

          {evaluation.suggestions && (
            <div className="suggestions">
              <strong>Gợi ý:</strong> {evaluation.suggestions}
            </div>
          )}

          <div className="overall-feedback">
            <strong>Nhận xét tổng thể:</strong> {evaluation.feedback}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Game Component với AI

```javascript
import React, { useState, useEffect } from 'react';

export function VocabularyGame({ vocabulary }) {
  const [question, setQuestion] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [gameState, setGameState] = useState('loading'); // loading, playing, evaluating, completed

  // Tạo câu hỏi khi component mount
  useEffect(() => {
    generateQuestion();
  }, [vocabulary]);

  const generateQuestion = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/ai/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocabulary, level: 'beginner' })
      });

      const result = await response.json();
      if (result.success) {
        setQuestion(result.data);
        setGameState('playing');
      }
    } catch (error) {
      console.error('Failed to generate question:', error);
    }
  };

  const submitAnswer = async () => {
    if (!userAnswer.trim()) return;

    setGameState('evaluating');

    try {
      const response = await fetch('http://localhost:3001/api/ai/evaluate-sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence: userAnswer,
          vocabulary,
          context: `Trả lời câu hỏi: ${question?.question}`
        })
      });

      const result = await response.json();
      if (result.success) {
        setEvaluation(result.data.evaluation);
        setGameState('completed');
      }
    } catch (error) {
      console.error('Evaluation failed:', error);
    }
  };

  const resetGame = () => {
    setUserAnswer('');
    setEvaluation(null);
    setGameState('playing');
  };

  if (gameState === 'loading') {
    return <div>Đang tạo câu hỏi...</div>;
  }

  return (
    <div className="vocabulary-game">
      <div className="question-section">
        <h3>Câu hỏi</h3>
        <p>{question?.question}</p>
        {question?.hint && (
          <p className="hint">💡 {question.hint}</p>
        )}
      </div>

      {gameState === 'playing' && (
        <div className="answer-section">
          <textarea
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="Trả lời bằng câu hoàn chỉnh..."
            rows={3}
          />
          <button onClick={submitAnswer} disabled={!userAnswer.trim()}>
            Gửi câu trả lời
          </button>
        </div>
      )}

      {gameState === 'evaluating' && (
        <div className="evaluating">
          <p>Đang đánh giá câu trả lời của bạn...</p>
          <div className="spinner"></div>
        </div>
      )}

      {gameState === 'completed' && evaluation && (
        <div className="result-section">
          <div className={`score score-${evaluation.score >= 7 ? 'good' : 'needs-work'}`}>
            Điểm: {evaluation.score}/10
          </div>

          <div className="feedback">
            <h4>Nhận xét của AI</h4>
            <p>{evaluation.feedback}</p>

            <div className="details">
              <div>✅ Độ chính xác: {evaluation.accuracy}</div>
              <div>📝 Ngữ pháp: {evaluation.grammar}</div>
              <div>🎭 Tính tự nhiên: {evaluation.naturalness}</div>
              <div>💡 Sáng tạo: {evaluation.creativity}</div>
            </div>

            {evaluation.suggestions && (
              <div className="suggestions">
                <strong>Gợi ý cải thiện:</strong>
                <p>{evaluation.suggestions}</p>
              </div>
            )}
          </div>

          <button onClick={resetGame} className="play-again">
            Chơi lại
          </button>
        </div>
      )}
    </div>
  );
}
```

## ⚠️ Lưu ý quan trọng

### API Key Security
- **Không commit API key** vào Git
- Sử dụng environment variables
- Thêm API key vào `.env` và `.gitignore`

### Rate Limiting
- OpenAI có giới hạn request/tháng
- Theo dõi usage trên dashboard OpenAI
- Implement caching nếu cần

### Error Handling
- Xử lý trường hợp API key không hợp lệ
- Xử lý network errors
- Fallback khi AI không khả dụng

### Cost Optimization
- Sử dụng GPT-3.5-turbo thay vì GPT-4 để tiết kiệm
- Limit token usage với `max_tokens`
- Cache responses nếu có thể

## 🚀 Testing

### Test với Postman
1. Import collection hoặc tạo request mới
2. Set method: POST
3. URL: `http://localhost:3001/api/ai/evaluate-sentence`
4. Body: raw JSON với dữ liệu mẫu

### Test trong Browser
```javascript
// Test evaluation
fetch('http://localhost:3001/api/ai/evaluate-sentence', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sentence: "I am happy today",
    vocabulary: { word: "happy", meaning: "vui vẻ", type: "adjective" }
  })
})
.then(res => res.json())
.then(console.log);
```

## 📞 Support

Nếu gặp vấn đề:
1. Kiểm tra API key có hợp lệ không
2. Xem logs server để debug
3. Kiểm tra quota OpenAI
4. Test với request đơn giản trước

---

**Happy AI Integration! 🤖✨**
