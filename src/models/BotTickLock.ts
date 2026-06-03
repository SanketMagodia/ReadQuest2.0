import { Schema, model, models } from "mongoose";

const botTickLockSchema = new Schema(
  {
    _id: { type: String, default: "global" },
    lockedUntil: { type: Date, required: true, index: true },
    lastStartedAt: { type: Date },
    lastFinishedAt: { type: Date },
  },
  { timestamps: true }
);

const BotTickLockModel =
  models.BotTickLock ?? model("BotTickLock", botTickLockSchema);

export default BotTickLockModel;
