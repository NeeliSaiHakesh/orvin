import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orvin AI — Autonomous Pre-Flight Gate & Enterprise AutoML",
  description: "Autonomous pre-flight CI/CD gate and machine learning platform powered by Hindsight Memory and Groq Llama 3.3.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#F5F1E8] text-[#0F172A] font-sans antialiased min-h-screen flex flex-col selection:bg-[#E2DCD0] selection:text-[#0F172A]">
        {children}
      </body>
    </html>
  );
}