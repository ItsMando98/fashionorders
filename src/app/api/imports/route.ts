import { commerceRoute } from "@/lib/commerce/api";
export const dynamic="force-dynamic";
const handle=(request:Request)=>commerceRoute(request,['imports']);
export {handle as GET,handle as POST};
