import { commerceRoute } from '@/lib/commerce/api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request:Request,{params}:{params:Promise<{path:string[]}>}){return commerceRoute(request,(await params).path);}
export {handle as GET,handle as POST,handle as PATCH,handle as DELETE};
