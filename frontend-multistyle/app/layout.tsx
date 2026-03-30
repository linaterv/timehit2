import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { QueryProvider } from "@/lib/query-provider";
import { ThemeProvider } from "@/lib/theme-context";
import { Comfortaa, Fira_Code, Metamorphous } from "next/font/google";

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-fira-code",
  display: "swap",
});

const comfortaa = Comfortaa({
  subsets: ["latin"],
  variable: "--font-comfortaa",
  display: "swap",
});

const metamorphous = Metamorphous({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-gothic",
  display: "swap",
});

export const metadata = { title: "TimeHit" };

const themeScript = `
  (function() {
    try {
      var t = localStorage.getItem('timehit-theme');
      if (t) document.documentElement.dataset.theme = t;
    } catch(e) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${firaCode.variable} ${metamorphous.variable} ${comfortaa.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <QueryProvider>
          <AuthProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
