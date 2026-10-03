import { z } from 'zod';

export const favoriteInputSchema = z.object({
  listingId: z.uuid(),
  favorited: z.boolean(),
});
export type FavoriteInput = z.infer<typeof favoriteInputSchema>;
