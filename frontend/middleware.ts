import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Everything except the auth screens requires a signed-in user.
const isPublic = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // Optional demo bypass: run the console without forcing Clerk sign-in.
  if (process.env.DISABLE_AUTH === 'true') return;
  if (!isPublic(req)) {
    await auth.protect();
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
