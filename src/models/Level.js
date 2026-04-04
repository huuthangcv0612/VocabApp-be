const mongoose = require('mongoose');

const levelSchema = new mongoose.Schema(
  {
    level_name: {
      type: String,
      required: true,
      unique: true,
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

module.exports = mongoose.model('Level', levelSchema);
