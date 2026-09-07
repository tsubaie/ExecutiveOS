import 'server-only';
import { z } from 'zod';
import { Locale, defaults } from '@/core/config/defaults';
export { User } from '@/core/http/user-schema';
import { Password } from '@/core/http/user-schema';
export const Login = z.strictObject({
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(256),
});
export const Setup = Login.extend({
  password: Password,
  setupToken: z.string().min(1).max(128),
  name: z.string().trim().min(1).max(200),
  workspaceName: z.string().trim().min(1).max(200),
  locale: Locale,
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat(defaults.locale, { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }),
  principalName: z.string().trim().max(200).default(''),
});
export const Recovery = Login.extend({ password: Password, token: z.string().min(1).max(256) });
