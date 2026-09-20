import { Types } from "mongoose";

export type MemoryDTO = {
  id: string;
  quote: string;
  note: string;
  page: number | null;
  createdAt: string;
  book: {
    id: string;
    slug: string;
    title: string;
    authors: string;
    thumbnail: string;
  } | null;
};

type PopulatedBook = {
  _id: Types.ObjectId;
  slug?: string;
  title: string;
  authors?: string;
  thumbnail?: string;
};

type LeanMemory = {
  _id: Types.ObjectId;
  quote?: string;
  note?: string;
  page?: number | null;
  createdAt: Date;
  book?: PopulatedBook | Types.ObjectId | null;
};

function isPopulated(
  book: PopulatedBook | Types.ObjectId | null | undefined
): book is PopulatedBook {
  return Boolean(book) && "title" in (book as PopulatedBook);
}

export function serializeMemory(row: LeanMemory): MemoryDTO {
  const book = isPopulated(row.book) ? row.book : null;
  return {
    id: row._id.toString(),
    quote: row.quote ?? "",
    note: row.note ?? "",
    page: row.page ?? null,
    createdAt: row.createdAt.toISOString(),
    book: book
      ? {
          id: book._id.toString(),
          slug: book.slug ?? book._id.toString(),
          title: book.title,
          authors: book.authors ?? "",
          thumbnail: book.thumbnail ?? "",
        }
      : null,
  };
}
