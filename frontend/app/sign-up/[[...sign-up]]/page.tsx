import { SignUp } from '@clerk/nextjs';
import { AuthShell } from '@/components/AuthShell';

export default function Page() {
  return (
    <AuthShell title="Create an account" subtitle="Get access to the lead intelligence console">
      <SignUp />
    </AuthShell>
  );
}
