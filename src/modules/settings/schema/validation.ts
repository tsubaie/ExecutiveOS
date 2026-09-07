import { z } from 'zod';
export const Setting = z.object({
  key: z.string(),
  value: z.json(),
  default: z.json(),
  type: z.string(),
});
export const SettingWrite = z.strictObject({ key: z.string(), value: z.json() });
