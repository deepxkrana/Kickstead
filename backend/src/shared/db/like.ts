/**
 * Prisma's `contains` passes the term into SQL LIKE without escaping, so "%" or "_" would
 * match everything. Escape them (and the escape character) so search is literal.
 */
export function likeLiteral(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}
