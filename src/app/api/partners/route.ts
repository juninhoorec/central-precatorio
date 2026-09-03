import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { savePartner } from "@/lib/partner-repository";
const schema = z.object({
  idempotencyKey: z.string().uuid(),
  company: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/),
  profile: z.string().min(2).max(80),
  consent: z.literal("accepted"),
  landingPage: z.string().max(100),
  website: z.string().max(0).optional(),
});
export async function POST(request: Request) {
  if (!(await rateLimit(request, "partners", 6)))
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.website)
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const saved = await savePartner(parsed.data);
  return NextResponse.json({ id: saved.id }, { status: 201 });
}
