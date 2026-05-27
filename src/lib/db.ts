import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var mongooseConn: Promise<typeof mongoose> | undefined;
}

export async function connectDB(): Promise<typeof mongoose> {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("Define MONGODB_URI in environment");
  }
  if (global.mongooseConn) return global.mongooseConn;

  global.mongooseConn = mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
  });

  await global.mongooseConn;
  return mongoose;
}

export default connectDB;
