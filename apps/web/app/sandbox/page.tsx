import { SandboxPanel } from "@/components/sandbox";

export const metadata = {
  title: "OpenCode Agent | HealthyMama",
  description: "AI coding assistant running on Daytona cloud infrastructure",
};

export default function SandboxPage() {
  return (
    <main className="min-h-screen bg-[#0d1117]">
      <SandboxPanel />
    </main>
  );
}
