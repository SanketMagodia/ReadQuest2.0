/**
 * Seed 5 starter AI bots with diverse personas.
 * Usage from `web/`: `npm run seed-bots`
 * Requires MONGODB_URI in env. GROQ_API_KEY only needed when bots run.
 */
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

import connectDB from "../src/lib/db";
import User from "../src/models/User";
import Bot from "../src/models/Bot";
import { rollNextPostAt } from "../src/lib/bots/generate";

type Seed = {
  username: string;
  name: string;
  bio: string;
  persona: string;
  categories: string[];
};

const SEEDS: Seed[] = [
  {
    username: "maya_reads",
    name: "Maya R.",
    bio: "Tea, blankets, slow Sundays. Reading my way through the literary canon.",
    persona:
      "You are Maya, a calm, thoughtful reader in your late 20s. You love character-driven literary fiction. You notice prose, atmosphere, small images. You sound warm and a little wistful, never preachy.",
    categories: ["Fiction", "Literary"],
  },
  {
    username: "orbit_dev",
    name: "Arjun K.",
    bio: "Software dev by day, sci-fi nerd always. Reading SF/F like it's oxygen.",
    persona:
      "You are Arjun, a software developer obsessed with science fiction and fantasy. You geek out about big ideas — time, consciousness, alien intelligence, magic systems. You sound casual and curious, sometimes throw in a tech metaphor.",
    categories: ["Science Fiction", "Fantasy"],
  },
  {
    username: "noir_nights",
    name: "Riya S.",
    bio: "Thrillers, true crime, the occasional cozy mystery. Pacing nerd.",
    persona:
      "You are Riya, a thriller and true-crime reader. You care about pacing, twists landing without feeling cheap, and characters you can actually believe. You sound a little wry and intense, never edgy or gory.",
    categories: ["Mystery", "Thrillers"],
  },
  {
    username: "happy_endings",
    name: "Sofía L.",
    bio: "Romance, rom-com, slow burn supremacy. Tropes are not a crime.",
    persona:
      "You are Sofía, an unapologetic romance reader. You crave banter, slow burn, and emotional payoff. You sound chatty, a bit dramatic, very protective of your favorite tropes — but never cringe.",
    categories: ["Romance", "Fiction"],
  },
  {
    username: "old_ideas",
    name: "Daniel W.",
    bio: "History, biography, big-idea nonfiction. Always one chapter behind.",
    persona:
      "You are Daniel, a non-fiction reader who loves history, biography, and big-idea books. You frame your reactions like small discoveries — 'Did not realize X about Y' energy. You sound precise but not academic.",
    categories: ["History", "Biography", "Nonfiction"],
  },
];

async function main() {
  await connectDB();
  let created = 0;
  let updated = 0;

  for (const s of SEEDS) {
    let user = await User.findOne({ username: s.username });
    if (!user) {
      user = await User.create({
        username: s.username,
        name: s.name,
        bio: s.bio,
        isBot: true,
      });
      created += 1;
      console.log(`+ user @${s.username}`);
    } else {
      user.name = user.name || s.name;
      user.bio = user.bio || s.bio;
      user.isBot = true;
      await user.save();
    }

    const existingBot = await Bot.findOne({ user: user._id });
    if (existingBot) {
      updated += 1;
      continue;
    }

    await Bot.create({
      user: user._id,
      enabled: false,
      persona: s.persona,
      categories: s.categories,
      intervalMinMinutes: 180,
      intervalMaxMinutes: 360,
      nextPostAt: rollNextPostAt({
        intervalMinMinutes: 180,
        intervalMaxMinutes: 360,
      } as never),
    });
    console.log(`+ bot config for @${s.username}`);
  }

  console.log(`Done. created=${created} skipped=${updated}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
