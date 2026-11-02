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
  if (global.mongooseConn) {
    try {
      await global.mongooseConn;
      return mongoose;
    } catch {
      global.mongooseConn = undefined;
    }
  }

  global.mongooseConn = mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
  });

  try {
    await global.mongooseConn;
    return mongoose;
  } catch (err) {
    global.mongooseConn = undefined;
    throw err;
  }
}

export default connectDB;
