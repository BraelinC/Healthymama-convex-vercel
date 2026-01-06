---
description: Generate a complete Next.js App Router page
argument-hint: [PageName] [description/features]
---

Use the ui-generator subagent to create a new Next.js page.

Page Name: $1
Features: $2

Requirements:
- Create in `app/ui-preview/pages/$1/page.tsx`
- Include `export const metadata` for SEO
- Use proper Next.js 14 App Router patterns
- Include page layout with container and max-width
- Add loading states for data fetching
- Use Convex queries/mutations if data needed
- Check Clerk auth if protected route
- Include responsive layout
- Add proper heading hierarchy (h1, h2, etc.)

The page will be accessible for preview after generation.
You can then move it to a production route in the app directory.
