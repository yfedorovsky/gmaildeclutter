export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/dashboard/:path*", "/api/scan/:path*", "/api/senders/:path*", "/api/classify/:path*", "/api/actions/:path*", "/api/stats/:path*"],
};
