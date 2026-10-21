import { requireTenant } from "@/lib/tenant";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import DuplicateReview from "./view";

export default async function DuplicateReviewPage() {
  try { await requireTenant(await headers()); }
  catch (error) { if (error instanceof Response && [401, 403, 503].includes(error.status)) redirect("/conta"); throw error; }
  return <DuplicateReview />;
}
