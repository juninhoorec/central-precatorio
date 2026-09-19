import {createClient} from "@libsql/client";
import {runOfficialCatalogSync} from "../src/lib/source-monitor.ts";

const db=createClient({url:"file::memory:"});
try{
 const result=await runOfficialCatalogSync({organizationId:"source-smoke-isolated",userId:"source-smoke",fetcher:fetch},db);
 console.log(JSON.stringify({status:result.status,summary:result.summary,sources:result.sources.map(({sourceId,name,status,httpStatus,durationMs,error})=>({sourceId,name,status,httpStatus,durationMs,error}))},null,2));
 if(result.summary.failed===result.summary.sources)process.exitCode=1;
}finally{db.close()}
