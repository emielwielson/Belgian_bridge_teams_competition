/**
 * Title-case tokens that are fully uppercase (federation-style surnames),
 * leave mixed-case / lowercase tokens unchanged.
 */
export function formatPersonName(name: string): string {
  return name
    .split(/(\s+)/)
    .map((token) => {
      if (!token.trim()) return token;
      // Fully uppercase (letters only, ignoring hyphens/apostrophes inside)
      const letters = token.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
      if (
        letters.length === 0 ||
        letters !== letters.toUpperCase() ||
        letters === letters.toLowerCase()
      ) {
        return token;
      }
      return token
        .split(/([-'])/)
        .map((part) => {
          if (part === "-" || part === "'") return part;
          if (!part) return part;
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        })
        .join("");
    })
    .join("");
}

/** Normalize each person in a pair display name ("A · B"). */
export function formatPairDisplayName(displayName: string): string {
  return displayName
    .split(" · ")
    .map((part) => formatPersonName(part.trim()))
    .join(" · ");
}
