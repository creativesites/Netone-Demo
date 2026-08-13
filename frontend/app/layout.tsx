import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NetOne · Lead Automation',
  description: 'Omnichannel Marketing-to-CRM Lead Automation — live demo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
