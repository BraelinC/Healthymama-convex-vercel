---
description: Generate a React component, page, or UI element with the ui-generator agent
argument-hint: [description of what to create]
---

Use the ui-generator subagent to create: $ARGUMENTS

Requirements:
- Follow HealthyMama's design system (Tailwind CSS + shadcn/ui)
- Use TypeScript with proper type definitions
- Integrate with Convex for data (if needed)
- Use Clerk auth context (if auth required)
- Include accessibility features (ARIA labels, semantic HTML)
- Make it responsive (mobile-first design)
- Create in `app/ui-preview/components/` for testing
- Provide usage examples

After generation, the component will be viewable at: http://localhost:3000/ui-preview
