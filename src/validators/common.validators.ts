import type { Context } from 'hono'
import { z } from 'zod'

/** Shared `@hono/zod-validator` hook: one consistent 400 payload for every validated route. */
export const validationHook = (
  result: { success: boolean; error?: z.core.$ZodError },
  c: Context
) => {
  if (!result.success && result.error) {
    return c.json(
      {
        status: 'error',
        message: 'Validation failed',
        errors: z.flattenError(result.error).fieldErrors,
      },
      400
    )
  }
}

export const slugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format'),
})
