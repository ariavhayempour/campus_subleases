import { ClerkProvider } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { MessagingProvider } from '@/app/_components/messaging-provider';
import { SiteFooter } from '@/app/_components/site-footer';
import { SiteHeader } from '@/app/_components/site-header';
import { APP_NAME } from '@/lib/app-config';
import { siteUrl } from '@/lib/site-url';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: 'Sublease your place to other students, or find one near campus.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ClerkProvider appearance={{ theme: shadcn }} signInUrl="/sign-in" signUpUrl="/sign-up">
          <MessagingProvider>
            <SiteHeader />
            {children}
            <SiteFooter />
          </MessagingProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
