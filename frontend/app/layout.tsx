import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'NetOne · Lead Automation',
  description: 'Omnichannel Marketing-to-CRM Lead Automation — live demo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: '#3b6ef6',
              colorBackground: '#0b1220',
              colorText: '#e2e8f0',
              colorInputBackground: '#111a2e',
              colorInputText: '#e2e8f0',
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
