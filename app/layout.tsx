import { ClerkProvider } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { MessagingProvider } from '@/app/_components/messaging-provider';
import { SiteHeader } from '@/app/_components/site-header';
import { APP_NAME } from '@/lib/app-config';
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
          </MessagingProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
