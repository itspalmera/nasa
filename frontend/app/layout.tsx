// frontend/app/layout.tsx
import type { Metadata } from 'next';
// Bundled fonts keep local builds independent of Google Fonts access.
import '@fontsource/fira-sans/600.css';
import '@fontsource/fira-sans/700.css';
import '@fontsource/fira-sans/800.css';
import '@fontsource/fira-sans/900.css';
import '@fontsource/overpass/400.css';
import '@fontsource/overpass/500.css';
import '@fontsource/overpass/600.css';
import '@fontsource/overpass/700.css';
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/700.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'FLARE · Microgravity Fire Safety Decision Intelligence',
  description:
    'Explore 30+ years of NASA microgravity combustion research, uncover hidden Earth-test flammability gaps, and predict partial-gravity fire behavior.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className="dark"
    >
      <body className="min-h-screen bg-[#060a14] font-sans text-slate-100 antialiased selection:bg-sky-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}