import { commerceRoute } from "@/lib/commerce/api";
export const dynamic="force-dynamic";
const handle=(request:Request)=>commerceRoute(request,['collections']);
export {handle as GET,handle as POST};
