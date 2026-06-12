// Pure command-palette filtering, extracted in 13.0 for direct unit testing.
// Given the full command list and a raw query string, return the ranked,
// bounded subset the palette should display. No DOM access.

export function filterCommands(commands = [], rawQuery = '', limit = 12) {
  const query = String(rawQuery ?? '').trim().toLowerCase();
  const matched = commands.filter((command) => {
    const haystack = `${command.title ?? ''} ${command.detail ?? ''} ${command.group ?? ''}`.toLowerCase();
    return !query || haystack.includes(query);
  });
  const bounded = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : matched.length;
  return matched.slice(0, bounded);
}

// Keep the active index inside the bounds of the current result list.
export function clampActiveIndex(index, length) {
  if (!length || length <= 0) return 0;
  return Math.min(Math.max(0, index), length - 1);
}

// Wrap an index around the result list for ArrowUp/ArrowDown navigation.
export function wrapActiveIndex(index, length) {
  if (!length || length <= 0) return 0;
  return (index + length) % length;
}
