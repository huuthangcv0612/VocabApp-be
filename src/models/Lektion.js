const mongoose = require('mongoose');

const lektionSchema = new mongoose.Schema(
  {
    level_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Level',
      required: true
    },
    lekttion_name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    order: {
      type: Number,
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Lektion', lektionSchema);
