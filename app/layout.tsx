import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mitsurugi Graph Lab",
  description: "Canvas interactivo para mapear líneas y acciones Mitsurugi.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
