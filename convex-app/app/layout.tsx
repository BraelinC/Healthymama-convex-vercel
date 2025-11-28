import type { Metadata } from "next";
import { Inter, Dancing_Script } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { HealthyMamaConvexProvider } from "@/components/shared/HealthyMamaConvexProvider";
import { Toaster } from "@/components/ui/toaster";
import { CustomFeedbackButton } from "@/components/shared/CustomFeedbackButton";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const dancingScript = Dancing_Script({ subsets: ["latin"], variable: "--font-dancing" });

export const metadata: Metadata = {
  title: "RecipeAI Chat",
  description: "Serverless recipe assistant powered by Convex and OpenAI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${dancingScript.variable} antialiased`}>
        {/* UserJot Feedback SDK - Using custom trigger */}
        <Script id="userjot-widget" strategy="afterInteractive">
          {`
            window.$ujq=window.$ujq||[];
            window.uj=window.uj||new Proxy({},{get:(_,p)=>(...a)=>window.$ujq.push([p,...a])});

            // Initialize UserJot with custom trigger (hides default button)
            window.uj.init('cmhpazugj026g14ny89le8o78', {
              widget: true,
              trigger: 'custom',  // Official way to hide default button
              position: 'right',
              theme: 'auto'
            });

            document.head.appendChild(Object.assign(document.createElement('script'),{
              src:'https://cdn.userjot.com/sdk/v2/uj.js',
              type:'module',
              async:!0
            }));
          `}
        </Script>

        <HealthyMamaConvexProvider>
          {children}
          <Toaster />
          {/* HIDDEN - will use later
          <CustomFeedbackButton />
          */}
        </HealthyMamaConvexProvider>
      </body>
    </html>
  );
}
