import { model, Schema } from 'mongoose'

const resultSchema = new Schema(
  {
    guestId: { type: String, required: true },
    name: { type: String, required: true, maxlength: 20 },
    mode: { type: String, required: true, enum: ['time', 'words', 'quote', 'zen', 'custom'] },
    duration: { type: Number, default: null },
    wordCount: { type: Number, default: null },
    punctuation: { type: Boolean, required: true },
    numbers: { type: Boolean, required: true },
    elapsedMs: { type: Number, required: true },
    correctChars: { type: Number, required: true },
    incorrectChars: { type: Number, required: true },
    extraChars: { type: Number, required: true },
    missedChars: { type: Number, required: true },
    correctKeystrokes: { type: Number, required: true },
    incorrectKeystrokes: { type: Number, required: true },
    consistency: { type: Number, default: null },
    wpm: { type: Number, required: true },
    rawWpm: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    leaderboard: { type: Boolean, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, bufferCommands: false },
)

// history: newest results of one guest
resultSchema.index({ guestId: 1, createdAt: -1 })
// leaderboard: best results of one comparable test
resultSchema.index({ leaderboard: 1, mode: 1, duration: 1, wordCount: 1, wpm: -1 })

export const ResultModel = model('Result', resultSchema)
