import './globals.css';

export const metadata = {
  title: 'Team Balancer \u2013 Rugby (Parejas + Entrenadores)',
  description: 'App para balancear equipos respetando parejas y entrenadores',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
