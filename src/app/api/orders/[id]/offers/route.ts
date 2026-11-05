import { commerceRoute } from "@/lib/commerce/api";
async function handle(request:Request,{params}:{params:Promise<{id:string}>}){return commerceRoute(request,["orders",(await params).id,"offers"]);}
export {handle as GET,handle as POST};
