import { z } from 'zod';

export const RecapOutputSchema = z.object({
  headline: z.string(),
  article: z.string(),
});
