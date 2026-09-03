import { z } from "zod";
const optionalText = z.string().max(200).nullable().optional();
const touchSchema = z
  .object({
    utm_source: optionalText,
    utm_medium: optionalText,
    utm_campaign: optionalText,
    utm_content: optionalText,
    utm_term: optionalText,
    gclid: optionalText,
    fbclid: optionalText,
    referrer: z.string().max(500).optional(),
    page: z.string().max(200),
    at: z.string().datetime(),
  })
  .strict()
  .optional();
export const leadInputSchema = z.object({
  idempotencyKey: z.string().uuid(),
  mode: z.enum(["pre", "assistant", "simulator"]),
  name: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/, "WhatsApp inválido"),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  answers: z.record(z.string(), z.string().max(250)),
  attribution: z
    .object({ firstTouch: touchSchema, lastTouch: touchSchema })
    .optional(),
  consent: z.object({
    accepted: z.literal(true),
    version: z.literal("2026-09-06"),
    acceptedAt: z.string().datetime(),
  }),
  landingPage: z.string().max(200),
  website: z.string().max(0).optional(),
});
export type LeadInput = z.infer<typeof leadInputSchema>;
