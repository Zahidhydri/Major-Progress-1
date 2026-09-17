import type { Metadata, Viewport } from 'next';
import './globals.css';
import 'leaflet/dist/leaflet.css';

export const metadata: Metadata = {
  title: 'GeoVerify IoT | Land Survey System & GPS Rover Emulator',
  description: 'Real-Time IoT Land Surveying WebGIS Dashboard & Mobile GNSS Rover Emulator via MQTT WebSockets',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body
        className="bg-slate-950 text-slate-100 min-h-screen antialiased select-none font-sans overflow-hidden"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
