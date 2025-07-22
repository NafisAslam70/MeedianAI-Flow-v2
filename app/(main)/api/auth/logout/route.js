// pages/api/auth/logout.js
import { signOut } from "next-auth/react";

export default async function handler(req, res) {
  res.setHeader("Set-Cookie", [
    "next-auth.session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "__Secure-next-auth.session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "__session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "__client_uat=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "__clerk_db_jwt=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "authjs.session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "authjs.csrf-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "authjs.callback-url=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ]);
  await signOut({ redirect: false });
  res.redirect("/login");
}