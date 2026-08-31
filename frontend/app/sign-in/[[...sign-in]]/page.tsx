import { SignIn } from '@clerk/nextjs';
import { AuthShell } from '@/components/AuthShell';

export default function Page() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to the lead intelligence console">
      <SignIn path="/sign-in" routing="path" />
    </AuthShell>
  );
}
