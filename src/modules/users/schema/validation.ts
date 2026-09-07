import { z } from 'zod';
import { Role, Password, User } from '@/core/http/user-schema';
export { User };
export const UserPatch = z.strictObject({
  name: z.string().trim().min(1).max(200),
  role: Role,
  isActive: z.boolean(),
  revision: z.number().int().positive(),
});
export type UserPatch = z.infer<typeof UserPatch>;
export const UserCreate = z.strictObject({
  name: z.string().trim().min(1).max(200),
  email: z.email().transform((v) => v.toLowerCase()),
  role: Role,
  password: Password.optional(),
});
