import type { Metadata } from "next";
import {
  Playfair_Display,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  Source_Serif_4,
  DM_Sans,
  JetBrains_Mono,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/lib/theme-provider";
import { SettingsProvider } from "@/lib/settings-provider";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const sourceSerif4 = Source_Serif_4({
  variable: "--font-source-serif-4",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://theepsteincrimes.com",
  ),
  title: "The Epstein Crimes",
  description:
    "Independent investigation into 1.38 million DOJ documents released under the Epstein Files Transparency Act.",
  openGraph: {
    title: "The Epstein Crimes",
    description:
      "Independent investigation into 1.38 million DOJ documents released under the Epstein Files Transparency Act.",
    type: "website",
    siteName: "The Epstein Crimes",
  },
  alternates: { canonical: "./" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${playfairDisplay.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} ${sourceSerif4.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Prevent flash of wrong theme — runs before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("efta-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);var ts=localStorage.getItem("efta-text-size");if(ts&&ts!=="medium")document.documentElement.setAttribute("data-text-size",ts);var a=localStorage.getItem("efta-a11y");if(a&&a!=="none")document.documentElement.setAttribute("data-a11y",a);if(localStorage.getItem("efta-reduced-motion")==="true")document.documentElement.setAttribute("data-reduced-motion","true")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-background text-text-primary font-body antialiased">
        <ThemeProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
