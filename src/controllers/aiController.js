const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Nhận xét câu trả lời của học sinh
exports.evaluateStudentSentence = async (req, res) => {
  try {
    const { sentence, vocabulary, context } = req.body;

    if (!sentence || !vocabulary) {
      return res.status(400).json({
        success: false,
        error: 'Cần cung cấp câu trả lời và từ vựng'
      });
    }

    const prompt = `
Bạn là giáo viên tiếng Anh chuyên nghiệp. Hãy đánh giá câu trả lời của học sinh dựa trên từ vựng đã học.

**Thông tin:**
- Từ vựng cần sử dụng: ${vocabulary.word} (${vocabulary.meaning})
- Loại từ: ${vocabulary.type}
- Câu trả lời của học sinh: "${sentence}"
${context ? `- Ngữ cảnh: ${context}` : ''}

**Yêu cầu đánh giá:**
1. **Độ chính xác**: Từ vựng có được sử dụng đúng không?
2. **Ngữ pháp**: Câu có đúng ngữ pháp không?
3. **Tự nhiên**: Câu có nghe tự nhiên không?
4. **Độ sáng tạo**: Học sinh có sáng tạo trong việc sử dụng từ không?

**Định dạng trả về (JSON):**
{
  "score": 1-10,
  "accuracy": "đánh giá độ chính xác",
  "grammar": "đánh giá ngữ pháp",
  "naturalness": "đánh giá tính tự nhiên",
  "creativity": "đánh giá độ sáng tạo",
  "suggestions": "gợi ý cải thiện",
  "corrected_sentence": "câu đã sửa (nếu cần)",
  "feedback": "nhận xét tổng thể"
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Bạn là giáo viên tiếng Anh chuyên nghiệp, trả lời bằng tiếng Việt."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const response = completion.choices[0].message.content;

    // Parse JSON response
    let evaluation;
    try {
      evaluation = JSON.parse(response);
    } catch (parseError) {
      // Nếu không parse được JSON, tạo response mặc định
      evaluation = {
        score: 7,
        accuracy: "Đã sử dụng từ vựng đúng",
        grammar: "Câu có một số lỗi nhỏ",
        naturalness: "Câu khá tự nhiên",
        creativity: "Sử dụng từ vựng cơ bản",
        suggestions: "Hãy thử sử dụng từ trong ngữ cảnh khác",
        corrected_sentence: sentence,
        feedback: response // Sử dụng response gốc nếu không parse được
      };
    }

    res.status(200).json({
      success: true,
      data: {
        sentence: sentence,
        vocabulary: vocabulary,
        evaluation: evaluation,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể đánh giá câu trả lời. Vui lòng thử lại.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Kiểm tra câu tiếng Đức
exports.checkGermanSentence = async (req, res) => {
  try {
    const { sentence } = req.body;

    if (!sentence) {
      return res.status(400).json({
        success: false,
        error: 'Cần cung cấp câu để kiểm tra'
      });
    }

    const prompt = `
Check German sentence.

Return JSON only:
{
  "correct": true/false,
  "corrected": "...",
  "errors": ["..."]
}

Sentence: "${sentence}"
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0,
      max_tokens: 200
    });

    const response = completion.choices[0].message.content;

    // Parse JSON response
    let result;
    try {
      result = JSON.parse(response);
    } catch (parseError) {
      // Nếu không parse được, trả về lỗi
      result = {
        correct: false,
        corrected: sentence,
        errors: ["Unable to parse response"]
      };
    }

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể kiểm tra câu. Vui lòng thử lại.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Tạo câu hỏi mẫu cho từ vựng
exports.generateVocabularyQuestion = async (req, res) => {
  try {
    const { vocabulary, level } = req.body;

    if (!vocabulary) {
      return res.status(400).json({
        success: false,
        error: 'Cần cung cấp từ vựng'
      });
    }

    const prompt = `
Tạo một câu hỏi đơn giản bằng tiếng Anh để học sinh sử dụng từ vựng sau trong câu trả lời.

**Từ vựng:** ${vocabulary.word} (${vocabulary.meaning})
**Loại từ:** ${vocabulary.type}
**Cấp độ:** ${level || 'beginner'}

**Yêu cầu:**
- Câu hỏi phải đơn giản và rõ ràng
- Học sinh cần sử dụng từ vựng đã cho trong câu trả lời
- Phù hợp với trình độ của học sinh

**Ví dụ:**
- Từ: "happy" (vui vẻ) -> Câu hỏi: "How do you feel today?"
- Từ: "run" (chạy) -> Câu hỏi: "What do you do every morning?"

**Trả về JSON:**
{
  "question": "câu hỏi bằng tiếng Anh",
  "expected_word": "từ vựng cần sử dụng",
  "hint": "gợi ý nhỏ nếu cần"
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Bạn là giáo viên tạo câu hỏi học tiếng Anh."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 200
    });

    const response = completion.choices[0].message.content;

    let questionData;
    try {
      questionData = JSON.parse(response);
    } catch (parseError) {
      questionData = {
        question: `How can you use the word "${vocabulary.word}" in a sentence?`,
        expected_word: vocabulary.word,
        hint: `Try to make a sentence using "${vocabulary.word}"`
      };
    }

    res.status(200).json({
      success: true,
      data: questionData
    });

  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể tạo câu hỏi. Vui lòng thử lại.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Phân tích lỗi thường gặp của học sinh
exports.analyzeCommonErrors = async (req, res) => {
  try {
    const { sentences, vocabulary } = req.body;

    if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cần cung cấp danh sách câu để phân tích'
      });
    }

    const prompt = `
Phân tích các lỗi thường gặp trong các câu trả lời của học sinh khi học từ vựng tiếng Anh.

**Dữ liệu:**
- Từ vựng: ${vocabulary.word} (${vocabulary.meaning})
- Các câu trả lời mẫu: ${sentences.map((s, i) => `${i + 1}. "${s}"`).join('\n')}

**Phân tích:**
1. Lỗi ngữ pháp thường gặp
2. Lỗi sử dụng từ vựng
3. Lỗi phát âm tiềm ẩn
4. Gợi ý cải thiện

**Trả về JSON:**
{
  "common_grammar_errors": ["lỗi 1", "lỗi 2"],
  "vocabulary_misuses": ["lỗi sử dụng từ"],
  "pronunciation_tips": ["mẹo phát âm"],
  "improvement_suggestions": ["gợi ý cải thiện"]
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Bạn là chuyên gia phân tích lỗi học tiếng Anh."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 800
    });

    const response = completion.choices[0].message.content;

    let analysis;
    try {
      analysis = JSON.parse(response);
    } catch (parseError) {
      analysis = {
        common_grammar_errors: ["Cần kiểm tra thì của động từ"],
        vocabulary_misuses: ["Sử dụng từ trong ngữ cảnh sai"],
        pronunciation_tips: ["Luyện phát âm từ vựng"],
        improvement_suggestions: ["Thực hành nhiều hơn"]
      };
    }

    res.status(200).json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể phân tích lỗi. Vui lòng thử lại.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
