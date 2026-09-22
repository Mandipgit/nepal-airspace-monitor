import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  fallback: ["-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Nepal Airspace Monitor | Live ADS-B Tracking & Aviation Intel",
  description:
    "Real-time flight tracking dashboard for Nepalese airspace. Monitor domestic and international aircraft, Tribhuvan Airport (VNKT) traffic, avionics telemetry, and enriched fleet specifications.",
  keywords: [
    "Nepal flight tracker",
    "Kathmandu airport",
    "Tribhuvan International Airport",
    "ADS-B",
    "Buddha Air",
    "Yeti Airlines",
    "Nepal Airlines",
    "OpenSky Network",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased dark ${inter.variable}`}>
      <body className={`h-full w-full overflow-hidden font-sans ${inter.className}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
