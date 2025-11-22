import type { Metadata } from 'next';
import '../styles/globals.css';
import '@xterm/xterm/css/xterm.css';

export const metadata: Metadata = {
  title: 'Quantum Canary - ERC-21 Monitoring Dashboard',
  description: 'Real-time monitoring for quantum-resistant ERC-21 token protocol',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
