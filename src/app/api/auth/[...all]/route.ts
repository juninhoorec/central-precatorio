import { assertAuthConfigured, auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const runtime = "nodejs";
const handlers = toNextJsHandler(auth);
function guarded(handler:(request:Request)=>Promise<Response>){return async(request:Request)=>{try{assertAuthConfigured();return await handler(request)}catch(error){if(error instanceof Response)return error;throw error}}}
export const GET = guarded(handlers.GET);
export const POST = guarded(handlers.POST);
