import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ringify — Turn Songs Into Ringtones',
  description: 'Convert any song link into a perfect ringtone. AI detects the best part, you customize it.',
  keywords: ['ringtone maker', 'song to ringtone', 'mp3 ringtone', 'iphone ringtone', 'm4r converter'],
  openGraph: {
    title: 'Ringify — Turn Songs Into Ringtones',
    description: 'Convert any song link into a perfect ringtone.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="noise-overlay" />
        {children}
      </body>
    </html>
  );
}
