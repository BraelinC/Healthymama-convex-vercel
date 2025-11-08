import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UI Preview Lab | HealthyMama",
  description: "Component preview and generation workspace",
};

export default function UIPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="ui-preview-layout">
      {/* Simple wrapper - no app navigation */}
      {children}
    </div>
  );
}
