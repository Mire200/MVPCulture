/** Normalise une réponse : minuscule, sans accents, trim, espaces collapsés. */
export function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function equalsLoose(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}
