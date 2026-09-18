/** A newer tab/URL event invalidates every pending capture or answer. */
export function createContextGeneration() {
  let current = 0;
  return {
    next: () => ++current,
    isCurrent: (generation: number) => generation === current,
  };
}

export function canonicalTabUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    const remove: string[] = [];
    url.searchParams.forEach((_, key) => {
      if (/^(utm_|fbclid$|gclid$|ref$|source$)/i.test(key)) remove.push(key);
    });
    for (const key of remove) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return null;
  }
}
