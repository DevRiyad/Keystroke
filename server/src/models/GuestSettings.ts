import { model, Schema } from 'mongoose'

const schema = new Schema(
  {
    guestId: { type: String, required: true, unique: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true }, versionKey: false, bufferCommands: false },
)

export const GuestSettingsModel = model('GuestSettings', schema)
