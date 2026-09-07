import { z } from 'zod';
export const Role = z.enum(['admin', 'member']);
export const User = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  role: Role,
  isActive: z.boolean(),
  revision: z.number(),
});
export type User = z.infer<typeof User>;
export const Password = z.string().min(12).max(256);
