import ExplorePage from "./ExplorePage";
import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Explore"),
  description:
    "Search the library, browse by shelf, and let the AI librarian match a book to whatever you're in the mood for.",
};

export default function Explore() {
  return <ExplorePage />;
}
