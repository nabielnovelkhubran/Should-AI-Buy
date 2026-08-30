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
      <body className="bg-[#090b10] text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
