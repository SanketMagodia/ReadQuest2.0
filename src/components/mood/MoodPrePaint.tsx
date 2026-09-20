import { MOOD_CACHE_KEY, MOOD_VARS_CACHE_KEY } from "@/lib/moods";

/**
 * Repaints the reader's last mood before the first frame.
 *
 * next-themes ships an equivalent script for the light/dark class; a mood also
 * overrides the brand palette, and without this the page paints the default
 * palette and visibly snaps a frame later on every hard refresh. The variables
 * are read from the cache rather than recomputed so the mood table stays out
 * of the HTML.
 */
const script = `
(function(){try{
var m=localStorage.getItem(${JSON.stringify(MOOD_CACHE_KEY)});
var v=localStorage.getItem(${JSON.stringify(MOOD_VARS_CACHE_KEY)});
if(!m||!v)return;
var o=JSON.parse(v),e=document.documentElement;
for(var k in o)e.style.setProperty(k,o[k]);
e.setAttribute('data-mood',m);
}catch(_){}})();
`.replace(/\n/g, "");

export function MoodPrePaint() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
