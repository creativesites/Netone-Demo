import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Public routes: sign-in, sign-up, all backend API routes & SSE stream, and static assets
const isPublic = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api(.*)',
  '/_next(.*)',
  '/icon.png',
  '/favicon.ico',
]);

export default clerkMiddleware(async (auth, req) => {
  // Demo mode: if DISABLE_AUTH is set to 'true' or not set (default demo access)
  // or if CLERK_SECRET_KEY is missing, allow direct access without redirect hangs.
  const isAuthExplicitlyRequired = process.env.DISABLE_AUTH === 'false' && Boolean(process.env.CLERK_SECRET_KEY);

  if (!isAuthExplicitlyRequired) {
    return;
  }

  if (!isPublic(req)) {
    const signInUrl = new URL('/sign-in', req.url).toString();
    await auth.protect({
      unauthenticatedUrl: signInUrl,
      unauthorizedUrl: signInUrl,
    });
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files unless found in search params.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|webp|png|gif|svg|ico|woff2?|ttf|map)).*)',
    // Always run for API routes and Clerk's proxy path.
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
