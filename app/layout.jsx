export const metadata = {
  title: "LENA — Micro-inversión inmobiliaria",
  description: "MVP modular con Next.js, Tailwind y framer-motion",
};
import "./../styles/globals.css";
export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-purple-100">{children}</body>
    </html>
  );
}
