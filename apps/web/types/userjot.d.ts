/**
 * TypeScript declarations for UserJot SDK
 * Documentation: https://userjot.com/knowledge/widget
 */

interface UserJotConfig {
  enabled?: boolean;
  position?: "left" | "right";
  showFeedbackText?: boolean;
  theme?: "light" | "dark" | "auto";
  trigger?: "default" | "custom";
}

interface UserJotUser {
  id: string;
  email?: string;
  name?: string;
  companies?: Array<{
    id: string;
    name: string;
  }>;
}

interface UserJotInitOptions {
  widget?: boolean;
  position?: "left" | "right";
  theme?: "light" | "dark" | "auto";
  trigger?: "default" | "custom";
}

interface UserJotSDK {
  init: (projectId: string, options?: UserJotInitOptions) => void;
  config: (config: UserJotConfig) => void;
  identify: (user: UserJotUser) => void;
  showWidget: (options?: { section?: "feedback" | "roadmap" | "updates" }) => void;
  hideWidget: () => void;
  captureScreenshot: () => void;
  openAnnotationEditor: () => void;
  closeAnnotationEditor: () => void;
  clearScreenshot: () => void;
}

declare global {
  interface Window {
    uj: UserJotSDK;
    $ujq: any[];
  }
}

export {};
