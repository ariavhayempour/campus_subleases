// Public name shown on listings and in messages; the full last name is never displayed.
export function formatDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const first = firstName?.trim() ?? '';
  const initial = lastName?.trim().charAt(0).toUpperCase() ?? '';
  const parts = [first, initial && `${initial}.`].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Student';
}
