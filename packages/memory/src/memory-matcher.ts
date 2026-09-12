import type { 
  MemoryMarker, 
  MemorySummary, 
  SearchMemoryInput 
} from "@vlc/contracts";

function stripUndefined<T extends object>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result) as (keyof T)[]) {
    if (result[key] === undefined) {
      delete result[key];
    }
  }
  return result;
}

export function matchMemories(
  markers: readonly MemoryMarker[],
  input: SearchMemoryInput,
): MemorySummary[] {
  const result: MemorySummary[] = [];

  for (const marker of markers) {
    if (marker.source.canonicalUrl !== input.source.canonicalUrl) {
      continue;
    }
    
    if (input.status && marker.status !== input.status) {
      continue;
    }

    let score = 0;
    let reason: MemorySummary["matchReason"] = "SAME_PAGE";

    if (marker.anchor.fingerprint === input.anchor.fingerprint) {
      score = 1.0;
      reason = "EXACT_FINGERPRINT";
    } else if (marker.anchor.heading && marker.anchor.heading === input.anchor.heading) {
      score = 0.85;
      reason = "SAME_PAGE_HEADING";
    } else {
      score = 0.60;
      reason = "SAME_PAGE";
    }

    result.push(stripUndefined({
      id: marker.id,
      source: marker.source,
      anchor: marker.anchor,
      status: marker.status,
      note: marker.note,
      question: marker.question,
      answerSummary: marker.answerSummary,
      updatedAt: marker.updatedAt,
      revision: marker.revision,
      matchScore: score,
      matchReason: reason
    }) as any as MemorySummary);
  }

  result.sort((a, b) => {
    if (a.matchScore !== b.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const limit = input.limit ?? 5;
  return result.slice(0, Math.min(limit, 5));
}
