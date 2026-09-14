import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Piattaforma Prenotazioni',
  description: 'Dashboard centrale multi-tenant',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
