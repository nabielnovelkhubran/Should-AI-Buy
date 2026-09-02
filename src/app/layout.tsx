import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Should-AI Buy? | Multi-Agent Adversarial Trading Council',
  description: 'Evidence-first autonomous crypto trading council with Red-Team adversarial validation and Alpaca paper trading.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#121117] text-[#e2e8f0] antialiased">
        {children}
      </body>
    </html>
  );
}
