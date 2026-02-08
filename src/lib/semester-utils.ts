/**
 * Utility functions for semester ordering and display
 * 
 * Academic calendar uses:
 * - Summer (formerly Spring) = 1st semester of year
 * - Winter (formerly Fall) = 2nd semester of year
 * 
 * Canonical order: Summer YYYY, Winter YYYY, Summer YYYY+1, ...
 */

export interface SemesterInfo {
  name: string;
  [key: string]: any;
}

/**
 * Gets the sort order for a semester (Summer = 1, Winter = 2)
 */
export function getSemesterOrder(semesterName: string): number {
  if (semesterName.startsWith('Summer')) return 1;
  if (semesterName.startsWith('Winter')) return 2;
  // Fallback for legacy names during transition
  if (semesterName.startsWith('Spring')) return 1;
  if (semesterName.startsWith('Fall')) return 2;
  return 0;
}

/**
 * Extracts the year from a semester name (e.g., "Summer 2021" → 2021)
 */
export function getSemesterYear(semesterName: string): number {
  const match = semesterName.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Compares two semesters for chronological sorting
 * Returns negative if a < b, positive if a > b, 0 if equal
 */
export function compareSemesters(a: string, b: string): number {
  const yearA = getSemesterYear(a);
  const yearB = getSemesterYear(b);
  
  if (yearA !== yearB) {
    return yearA - yearB;
  }
  
  return getSemesterOrder(a) - getSemesterOrder(b);
}

/**
 * Sorts an array of semester objects chronologically
 * @param semesters Array of objects with a 'name' property containing semester name
 * @param nameKey The key to use for the semester name (default: 'name')
 */
export function sortSemestersChronologically<T extends SemesterInfo>(
  semesters: T[],
  nameKey: keyof T = 'name'
): T[] {
  return [...semesters].sort((a, b) => 
    compareSemesters(String(a[nameKey]), String(b[nameKey]))
  );
}

/**
 * Normalizes legacy semester names (Spring→Summer, Fall→Winter)
 */
export function normalizeSemesterName(name: string): string {
  return name
    .replace(/^Spring/, 'Summer')
    .replace(/^Fall/, 'Winter');
}
