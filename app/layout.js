import "./globals.css";

export const metadata = {
  title: "Cin",
  description: "Gioco di carte Cin — multiplayer con password",
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
