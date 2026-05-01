import "./globals.css";

export const metadata = {
  title: "VertragsPilot – Vertragsmanagement",
  description: "Verwalte deine Verträge, behalte Kosten im Blick und verpasse keine Kündigungsfrist.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
