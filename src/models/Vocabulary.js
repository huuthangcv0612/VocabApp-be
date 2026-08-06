import mongoose from 'mongoose';

const vocabularySchema = new mongoose.Schema(
  {
    word: {
      type: String,
      required: [true, 'Please provide a German word'],
      trim: true,
    },
    article: {
      type: String,
      enum: {
        values: ['der', 'die', 'das', null, ''],
        message: '{VALUE} is not a valid German article',
      },
      default: null,
      lowercase: true,
      trim: true,
    },
    plural: {
      type: String,
      default: null,
      trim: true,
    },
    type: {
      type: String,
      enum: ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'],
      default: 'noun',
      lowercase: true,
    },
    meaning: {
      type: String,
      required: [true, 'Please provide Vietnamese meaning'],
      trim: true,
    },
    pronunciation: {
      type: String,
      default: null,
      trim: true,
    },
    example: {
      type: String,
      default: null,
      trim: true,
    },
    translation: {
      type: String,
      default: null,
      trim: true,
    },
    audio: {
      type: String,
      default: null,
      trim: true,
    },
    image: {
      type: String,
      default: null,
      trim: true,
    },
    // Existing relation & metadata attributes (preserved)
    lektionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lektion',
      default: null,
    },
    difficultyLevel: {
      type: String,
      enum: ['A1', 'A2', 'B1', 'beginner', 'intermediate', 'advanced'],
      default: 'A1',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Backward compatibility virtuals for existing legacy codebase
vocabularySchema.virtual('germanWord').get(function () {
  return this.word;
}).set(function (v) {
  this.word = v;
});

vocabularySchema.virtual('vietnameseMeaning').get(function () {
  return this.meaning;
}).set(function (v) {
  this.meaning = v;
});

vocabularySchema.virtual('partOfSpeech').get(function () {
  return this.type;
}).set(function (v) {
  this.type = v;
});

vocabularySchema.virtual('exampleSentence').get(function () {
  return {
    german: this.example,
    vietnamese: this.translation,
  };
});

// Indexing for high performance search across admin dashboard
vocabularySchema.index({ word: 1 });
vocabularySchema.index({ meaning: 1 });
vocabularySchema.index({ lektionId: 1 });
vocabularySchema.index({ difficultyLevel: 1 });

export default mongoose.model('Vocabulary', vocabularySchema);
