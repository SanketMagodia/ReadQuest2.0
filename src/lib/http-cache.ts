/**
 * Headers that let Vercel's CDN answer a public GET without invoking the
 * function. Only for responses that are identical for every visitor — never
 * anything read from the session.
 *
 * `s-maxage` is how long the edge serves its copy as fresh; within
 * `stale-while-revalidate` it keeps serving the old copy while one request
 * refreshes it in the background, so readers never wait on the refresh.
 */
export function sharedCache(freshSeconds: number, staleSeconds = freshSeconds * 10) {
  return {
    "Cache-Control": `public, max-age=0, s-maxage=${freshSeconds}, stale-while-revalidate=${staleSeconds}`,
  };
}
