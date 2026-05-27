import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { registerSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { username, password, email, name } = parsed.data;
    await connectDB();

    const existing = await User.findOne({
      username: username.toLowerCase(),
    }).lean();
    if (existing) {
      return NextResponse.json({ error: "Username taken" }, { status: 409 });
    }

    if (email) {
      const emailTaken = await User.findOne({
        email: email.toLowerCase(),
      }).lean();
      if (emailTaken) {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await User.create({
      username: username.toLowerCase(),
      passwordHash,
      email: email?.toLowerCase(),
      name: name || username,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
