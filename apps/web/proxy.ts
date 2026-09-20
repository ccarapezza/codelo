import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match every path EXCEPT:
  //  - `/api/*`         (route handlers)
  //  - `/_next/*`       (Next.js internals + static)
  //  - `/_vercel/*`     (Vercel infra)
  //  - any file with an extension (e.g. `/ads.txt`, `/favicon.ico`,
  //    `/logo/foo.png`, `/stadiums/bar.jpg`)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
