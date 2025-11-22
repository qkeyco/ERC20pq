import type { Metadata } from 'next';
import '../styles/globals.css';
import '@xterm/xterm/css/xterm.css';

export const metadata: Metadata = {
  title: 'Quantum Canary - ERC-21 Monitoring Dashboard',
  description: 'Real-time monitoring for quantum-resistant ERC-21 token protocol',
  icons: {
    icon: '/images/favico.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/images/favico.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
