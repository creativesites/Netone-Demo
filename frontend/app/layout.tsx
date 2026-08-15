import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'NetOne Lead Intelligence',
  description: 'NetOne Lead Intelligence & Marketing Automation — connects digital channels to Bitrix24 CRM.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: '#a6242e',
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
