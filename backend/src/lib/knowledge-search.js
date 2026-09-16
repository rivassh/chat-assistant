export function searchKnowledge(query, entries, topK = 3) {
  if (!entries.length || !query.trim()) return [];

  const queryWords = tokenize(query);
  if (!queryWords.length) return [];

  const scored = entries.map(entry => {
    const entryText = `${entry.title} ${entry.content}`.toLowerCase();
    const entryWords = tokenize(entryText);

    let score = 0;
    for (const qword of queryWords) {
      for (const eword of entryWords) {
        if (eword === qword) {
          score += 3;
        } else if (eword.startsWith(qword) || qword.startsWith(eword)) {
          score += 1;
        }
      }
    }

    const titleLower = entry.title.toLowerCase();
    for (const qword of queryWords) {
      if (titleLower.includes(qword)) score += 2;
    }

    return { entry, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.entry);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}
