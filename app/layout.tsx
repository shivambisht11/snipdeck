import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Snipdeck · Media downloader", description: "Save public videos and audio in their available source quality." };
export default function RootLayout({ children }: {children: React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
