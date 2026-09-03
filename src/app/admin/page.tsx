import {redirect} from"next/navigation";
export const dynamic="force-dynamic";
export default function LegacyAdmin(){redirect("/workspace?view=Operações&from=legacy-admin")}
