import type { MemoryMarker, MemorySummary, ViewportContext } from "@vlc/contracts";

const MAX_TURN_MEMORIES = 5;

function termsOf(value: string): Set<string> {
  return new Set(value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []);
}

export function selectTurnMemories(
  pageMemories: readonly MemorySummary[],
  allowedMarkers: readonly MemoryMarker[],
  context: ViewportContext,
  question: string,
): MemorySummary[] {
  const pageIds = new Set(pageMemories.map(memory => memory.id));
  const query = termsOf(`${question} ${context.anchor.heading} ${context.visibleText.slice(0, 700)}`);
  const crossSite = allowedMarkers
    .filter(marker => marker.source.canonicalUrl !== context.source.canonicalUrl && !pageIds.has(marker.id))
    .map(marker => {
      const searchable = termsOf([
        marker.source.title, marker.anchor.heading, marker.anchor.textQuote,
        marker.note ?? "", marker.question ?? "", marker.answerSummary ?? "",
      ].join(" "));
      const overlap = [...query].filter(term => searchable.has(term)).length;
      return { marker, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap ||
      Date.parse(b.marker.updatedAt) - Date.parse(a.marker.updatedAt) ||
      a.marker.id.localeCompare(b.marker.id));

  const crossLimit = pageMemories.length === 0 ? MAX_TURN_MEMORIES : 2;
  const chosenCross: MemorySummary[] = crossSite.slice(0, crossLimit).map(({ marker, overlap }) => ({
    id: marker.id,
    source: marker.source,
    anchor: marker.anchor,
    status: marker.status,
    ...(marker.note === undefined ? {} : { note: marker.note }),
    ...(marker.question === undefined ? {} : { question: marker.question }),
    ...(marker.answerSummary === undefined ? {} : { answerSummary: marker.answerSummary }),
    updatedAt: marker.updatedAt,
    revision: marker.revision,
    matchScore: overlap === 0 ? 0.1 : Math.min(0.7, 0.2 + overlap * 0.1),
    matchReason: "CROSS_SITE",
  }));
  return [...pageMemories.slice(0, MAX_TURN_MEMORIES - chosenCross.length), ...chosenCross]
    .slice(0, MAX_TURN_MEMORIES);
}
