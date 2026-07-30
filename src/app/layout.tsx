import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CAT Fleet Anomaly Monitor — Smart Rental Tracking System',
  description: 'Real-time anomaly detection dashboard for Caterpillar machinery rental fleet. Monitor engine health, fuel, GPS, operator assignments, and rental status live.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
