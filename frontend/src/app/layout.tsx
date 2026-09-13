import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased dark">
      <body className="h-full w-full overflow-hidden bg-slate-950 text-slate-100 font-sans">
        {children}
      </body>
    </html>
  );
}
