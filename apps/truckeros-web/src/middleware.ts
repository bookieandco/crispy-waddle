import {NextRequest, NextResponse} from "next/server"
import {legacyApiBlocked} from "./lib/truckerPreviewGate"

export function middleware(request: NextRequest) {
  if (legacyApiBlocked(request.nextUrl.pathname, process.env.NODE_ENV)) {
    return NextResponse.json(
      {success:false,error:"TruckerOS driver APIs are not commissioned for public use"},
      {status:503,headers:{"Cache-Control":"no-store"}}
    )
  }
  return NextResponse.next()
}
export const config = {matcher:["/api/:path*"]}
