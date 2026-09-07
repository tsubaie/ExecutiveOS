import { z } from 'zod';
import { cookies } from 'next/headers';
import { defineHandler } from '@/core/http/handler';
import { Locale } from '@/core/config/defaults';
import { writeSetting } from '@/core/db/settings-repo';
export const POST = defineHandler({
  guard: 'public',
  input: z.strictObject({ locale: Locale }),
  response: z.object({ data: z.null() }),
  handler: async (input, ctx) => {
    (await cookies()).set('eos_locale', input.locale, {
      path: '/',
      sameSite: 'lax',
      maxAge: 31536000,
    });
    if (ctx.user) await writeSetting(ctx.db, 'user.locale', input.locale, ctx.user.id, ctx.user.id);
    return { data: null };
  },
});
