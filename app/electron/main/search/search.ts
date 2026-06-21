/**
 * Notes search — a pure, native-free full-text-ish search (token AND-match over title + body),
 * ranked by match count. The MVP for Notes search (FTS5/Qdrant are optional upgrades, backend/07
 * §E). PURE + BE1-tested.
 */
export interface Searchable {
  id: string;
  title?: string;
  body?: string;
}

export interface SearchHit<T> {
  item: T;
  score: number;
}

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/\s+/).filter(Boolean);
}

export function searchNotes<T extends Searchable>(items: T[], query: string): Array<SearchHit<T>> {
  const terms = tokenize(query);
  if (terms.length === 0) return items.map((item) => ({ item, score: 0 }));

  const hits: Array<SearchHit<T>> = [];
  for (const item of items) {
    const haystack = `${item.title ?? ""} ${item.body ?? ""}`.toLowerCase();
    let score = 0;
    let matchedAll = true;
    for (const term of terms) {
      const occurrences = haystack.split(term).length - 1;
      if (occurrences === 0) {
        matchedAll = false;
        break;
      }
      score += occurrences + (item.title?.toLowerCase().includes(term) ? 2 : 0);
    }
    if (matchedAll) hits.push({ item, score });
  }
  return hits.sort((a, b) => b.score - a.score);
}
