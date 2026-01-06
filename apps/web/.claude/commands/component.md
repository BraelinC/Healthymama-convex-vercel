---
description: Generate a reusable React component
argument-hint: [ComponentName] [description]
---

Use the ui-generator subagent to create a reusable React component.

Component Name: $1
Description: $2

Requirements:
- Create in `app/ui-preview/components/$1.tsx`
- Use TypeScript interface for props
- Include JSDoc comments for complex props
- Use shadcn/ui primitives where appropriate
- Follow existing component patterns in the codebase
- Add className prop for style overrides
- Make it composable and reusable
- Include responsive design (Tailwind breakpoints)

Example usage will be provided after generation.
