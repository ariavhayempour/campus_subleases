export type RevealValues = {
  type?: string;
  bedrooms?: number;
  bathrooms?: number;
  roommatesCount?: number;
  genderPreference?: string;
  roomType?: string;
};

export type RevealedGroups = { counts: boolean; gender: boolean; room: boolean; amenities: boolean };

// Each group appears once the one before it is answered; edit mode shows them all.
export function revealedGroups(values: RevealValues, showAll: boolean): RevealedGroups {
  if (showAll) return { counts: true, gender: true, room: true, amenities: true };
  const counts = Boolean(values.type);
  const answered = [values.bedrooms, values.bathrooms, values.roommatesCount].every(
    (value) => typeof value === 'number' && Number.isFinite(value),
  );
  const gender = counts && answered;
  const room = gender && Boolean(values.genderPreference);
  const amenities = room && Boolean(values.roomType);
  return { counts, gender, room, amenities };
}
