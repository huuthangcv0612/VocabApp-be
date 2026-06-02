import mongoose from 'mongoose';

const vocabularySchema = new mongoose.Schema(
  {
    germanWord: {
      type: String,
      required: [true, 'Please provide a German word'],
      trim: true,
      unique: true,
    },
    vietnameseMeaning: {
      type: String,
      required: [true, 'Please provide Vietnamese meaning'],
      trim: true,
    },
    exampleSentence: {
      german: {
        type: String,
        default: null,
      },
      vietnamese: {
        type: String,
        default: null,
      },
    },
    topic: {
      type: String,
      required: [true, 'Please provide a topic'],
      trim: true,
    },
    difficultyLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    partOfSpeech: {
      type: String,
      enum: ['noun', 'verb', 'adjective', 'adverb', 'other'],
      default: 'other',
    },
    pronunciation: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Vocabulary', vocabularySchema);

