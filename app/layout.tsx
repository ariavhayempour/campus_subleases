import { ClerkProvider } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import type { Metadata } from 'next';
import { Archivo, Big_Shoulders, Geist_Mono } from 'next/font/google';
import { MessagingProvider } from '@/app/_components/messaging-provider';
import { SiteFooter } from '@/app/_components/site-footer';
import { SchoolThemeProvider } from '@/app/_components/school-theme';
import { SiteHeader } from '@/app/_components/site-header';
import { getThemeContext } from '@/app/_lib/theme-school';
import { APP_NAME } from '@/lib/app-config';
import { NEUTRAL_THEME, schoolThemeStyle } from '@/lib/school-theme';
import { siteUrl } from '@/lib/site-url';
import './globals.css';

const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
});

// Variable weight plus the optical-size axis, so large display sizes get the display cut.
const bigShoulders = Big_Shoulders({
  variable: '--font-big-shoulders',
  subsets: ['latin'],
  axes: ['opsz'],
  // Next has no fallback metrics for this face; a narrow system fallback keeps the swap close.
  adjustFontFallback: false,
  fallback: ['Arial Narrow', 'sans-serif'],
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

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const theme = await getThemeContext();
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${bigShoulders.variable} ${geistMono.variable} h-full antialiased`}
      style={schoolThemeStyle(theme.school?.theme ?? NEUTRAL_THEME)}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          appearance={{
            theme: shadcn,
            variables: {
              colorPrimary: 'var(--school)',
              colorPrimaryForeground: 'var(--on-school)',
              colorInput: '#ffffff',
              colorInputForeground: 'var(--ink)',
              fontFamily: 'var(--font-archivo), system-ui, sans-serif',
              borderRadius: '0.375rem',
            },
          }}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
        >
          <SchoolThemeProvider schools={theme.schools} homeSchoolSlug={theme.homeSchoolSlug}>
            <MessagingProvider>
              <SiteHeader />
              {children}
              <SiteFooter />
            </MessagingProvider>
          </SchoolThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
