export const metadata = {
  title: 'Jhadina',
  description: 'Jhadina - Personal AI operating system interface',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
