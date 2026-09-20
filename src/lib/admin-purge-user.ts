import { Types } from "mongoose";
import Book from "@/models/Book";
import BookFollow from "@/models/BookFollow";
import BookSummary from "@/models/BookSummary";
import Club from "@/models/Club";
import ClubMembership from "@/models/ClubMembership";
import ClubMessage from "@/models/ClubMessage";
import ClubShelfEntry from "@/models/ClubShelfEntry";
import Conversation from "@/models/Conversation";
import DailyBookPick from "@/models/DailyBookPick";
import Friendship from "@/models/Friendship";
import Memory from "@/models/Memory";
import Message from "@/models/Message";
import Notification from "@/models/Notification";
import ReadList from "@/models/ReadList";
import ReelImpression from "@/models/ReelImpression";
import User from "@/models/User";
import UserBookSummary from "@/models/UserBookSummary";
import UserFollow from "@/models/UserFollow";
import UserRecommendation from "@/models/UserRecommendation";
import UserStreak from "@/models/UserStreak";

export type PurgeCounts = Record<string, number>;

function n(result: { deletedCount?: number } | null | undefined) {
  return result?.deletedCount ?? 0;
}

/**
 * Erase a reader and everything they left in the product.
 *
 * Shared catalog rows stay: books they imported keep their metadata, and
 * community gists they triggered keep the text (we only drop the `generatedBy`
 * pointer). Clubs they owned are removed with the room, because an ownerless
 * club is a leftover fake as much as the account was.
 */
export async function purgeUser(userId: string): Promise<PurgeCounts> {
  const uid = new Types.ObjectId(userId);

  const [ownedClubs, memberships, conversations] = await Promise.all([
    Club.find({ owner: uid }).select("_id").lean(),
    ClubMembership.find({ user: uid }).select("club role").lean(),
    Conversation.find({ participants: uid }).select("_id").lean(),
  ]);

  const ownedClubIds = ownedClubs.map((c) => c._id);
  const ownedSet = new Set(ownedClubIds.map((id) => id.toString()));
  const memberClubIds = memberships
    .filter((m) => !ownedSet.has(m.club.toString()))
    .map((m) => m.club);
  const conversationIds = conversations.map((c) => c._id);

  if (memberClubIds.length) {
    await Club.updateMany(
      { _id: { $in: memberClubIds }, memberCount: { $gt: 0 } },
      { $inc: { memberCount: -1 } }
    );
  }

  const [
    memories,
    shelves,
    streaks,
    personalSummaries,
    recommendations,
    quests,
    bookFollows,
    impressions,
    notifications,
    follows,
    friendships,
    ownedClubMessages,
    ownedClubMembers,
    ownedClubShelf,
    ownedClubsDeleted,
    leftoverMemberships,
    leftoverClubMessages,
    dmMessages,
    conversationsDeleted,
    userDeleted,
  ] = await Promise.all([
    Memory.deleteMany({ user: uid }),
    ReadList.deleteMany({ user: uid }),
    UserStreak.deleteMany({ user: uid }),
    UserBookSummary.deleteMany({ user: uid }),
    UserRecommendation.deleteMany({ user: uid }),
    DailyBookPick.deleteMany({ user: uid }),
    BookFollow.deleteMany({ user: uid }),
    ReelImpression.deleteMany({ user: uid }),
    Notification.deleteMany({ $or: [{ recipient: uid }, { actor: uid }] }),
    UserFollow.deleteMany({ $or: [{ follower: uid }, { following: uid }] }),
    Friendship.deleteMany({ $or: [{ requester: uid }, { recipient: uid }] }),
    ownedClubIds.length
      ? ClubMessage.deleteMany({ club: { $in: ownedClubIds } })
      : Promise.resolve({ deletedCount: 0 }),
    ownedClubIds.length
      ? ClubMembership.deleteMany({ club: { $in: ownedClubIds } })
      : Promise.resolve({ deletedCount: 0 }),
    ownedClubIds.length
      ? ClubShelfEntry.deleteMany({ club: { $in: ownedClubIds } })
      : Promise.resolve({ deletedCount: 0 }),
    ownedClubIds.length
      ? Club.deleteMany({ _id: { $in: ownedClubIds } })
      : Promise.resolve({ deletedCount: 0 }),
    ClubMembership.deleteMany({ user: uid }),
    ClubMessage.deleteMany({ sender: uid }),
    conversationIds.length
      ? Message.deleteMany({ conversation: { $in: conversationIds } })
      : Promise.resolve({ deletedCount: 0 }),
    conversationIds.length
      ? Conversation.deleteMany({ _id: { $in: conversationIds } })
      : Promise.resolve({ deletedCount: 0 }),
    User.deleteOne({ _id: uid }),
  ]);

  await Promise.all([
    Book.updateMany({ addedBy: uid }, { $unset: { addedBy: 1 } }),
    BookSummary.updateMany({ generatedBy: uid }, { $unset: { generatedBy: 1 } }),
  ]);

  return {
    user: n(userDeleted),
    memories: n(memories),
    shelves: n(shelves),
    streaks: n(streaks),
    personalSummaries: n(personalSummaries),
    recommendations: n(recommendations),
    quests: n(quests),
    bookFollows: n(bookFollows),
    impressions: n(impressions),
    notifications: n(notifications),
    follows: n(follows),
    friendships: n(friendships),
    clubMessages: n(ownedClubMessages) + n(leftoverClubMessages),
    clubMemberships: n(ownedClubMembers) + n(leftoverMemberships),
    clubShelf: n(ownedClubShelf),
    clubs: n(ownedClubsDeleted),
    messages: n(dmMessages),
    conversations: n(conversationsDeleted),
  };
}
