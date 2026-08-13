import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-emerald-500 text-lg font-black text-white">N1</div>
        <h1 className="text-xl font-bold text-ink-900">NetOne Lead Automation</h1>
        <p className="text-sm text-ink-500">Create your console account</p>
      </div>
      <SignUp />
    </div>
  );
}
