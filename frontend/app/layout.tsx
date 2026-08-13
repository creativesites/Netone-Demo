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
              colorPrimary: '#0071e3',
              colorText: '#1d1d1f',
              colorBackground: '#ffffff',
              colorInputBackground: '#ffffff',
              colorInputText: '#1d1d1f',
              borderRadius: '0.75rem',
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
