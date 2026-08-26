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
      default: 'noun',
      lowercase: true,
      trim: true,
    },
    part_of_speech: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
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
    example_translation: {
      type: String,
      default: null,
      trim: true,
    },
    audio: {
      type: String,
      default: null,
      trim: true,
    },
    audio_url: {
      type: String,
      default: null,
      trim: true,
    },
    image: {
      type: String,
      default: null,
      trim: true,
    },
    image_url: {
      type: String,
      default: null,
      trim: true,
    },
    level_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Level',
      default: null,
      index: true,
    },
    difficultyLevel: {
      type: String,
      default: 'A1',
      trim: true,
    },
    level: {
      type: String,
      default: 'A1',
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save hook to synchronize key field aliases
vocabularySchema.pre('save', function () {
  if (this.part_of_speech && !this.type) {
    this.type = this.part_of_speech;
  } else if (this.type && !this.part_of_speech) {
    this.part_of_speech = this.type;
  }

  if (this.example_translation && !this.translation) {
    this.translation = this.example_translation;
  } else if (this.translation && !this.example_translation) {
    this.example_translation = this.translation;
  }

  if (this.audio_url && !this.audio) {
    this.audio = this.audio_url;
  } else if (this.audio && !this.audio_url) {
    this.audio_url = this.audio;
  }

  if (this.image_url && !this.image) {
    this.image = this.image_url;
  } else if (this.image && !this.image_url) {
    this.image_url = this.image;
  }

  if (this.level && !this.difficultyLevel) {
    this.difficultyLevel = this.level;
  } else if (this.difficultyLevel && !this.level) {
    this.level = this.difficultyLevel;
  }
});

// Backward compatibility virtuals
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
  return this.part_of_speech || this.type;
});

vocabularySchema.virtual('exampleSentence').get(function () {
  return {
    german: this.example,
    vietnamese: this.example_translation || this.translation,
  };
});

// Indexing for high performance search
vocabularySchema.index({ word: 1 });
vocabularySchema.index({ meaning: 1 });
vocabularySchema.index({ level_id: 1 });
vocabularySchema.index({ difficultyLevel: 1 });
vocabularySchema.index({ level: 1 });

export default mongoose.model('Vocabulary', vocabularySchema);
