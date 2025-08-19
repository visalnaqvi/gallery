'use client'

import Image from 'next/image';
import './globals.css';
import { Providers } from './providers'
import { Montserrat } from 'next/font/google';
import logo from "../public/logo-white.png"
import { usePathname } from 'next/navigation';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-montserrat',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const hideHeader = pathname.startsWith('/auth'); // hide header on all /auth routes

  return (
    <html lang="en">
      <body className={montserrat.className}>
        {/* Header */}
        {!hideHeader && (
          <header className="bg-blue-500 flex items-center p-4">
            <Image src={logo} alt="logo" width={150} height={600} />
          </header>
        )}

        {/* Page content */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
