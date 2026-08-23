import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"]
});

const outfit = Outfit({ 
  subsets: ["latin"], 
  variable: "--font-outfit",
  display: "swap",
  fallback: ["sans-serif"]
});

export const metadata: Metadata = {
  title: "AutoMLOps - AI-Powered MLOps Platform",
  description: "End-to-end machine learning platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${outfit.variable}`}>
      <body className="bg-[#0a0a1a] text-[#F9FAFB] font-sans antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}