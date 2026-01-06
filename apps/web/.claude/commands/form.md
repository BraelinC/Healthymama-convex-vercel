---
description: Generate a form component with validation and error handling
argument-hint: [FormName] [field1 field2 field3...]
---

Use the ui-generator subagent to create a form component.

Form Name: $1
Fields: $2

Requirements:
- Create in `app/ui-preview/components/$1.tsx`
- Use shadcn/ui form components (Input, Label, Button, Select, etc.)
- Include TypeScript interfaces for form data and errors
- Add client-side validation
- Show inline error messages below fields
- Use `useToast` for success/error notifications
- Connect to Convex mutation for form submission (if backend exists)
- Include loading state during submission
- Add proper ARIA attributes for accessibility
- Make form responsive
- Clear form on successful submission
- Disable submit button while loading

Example:
```tsx
<$1 onSubmit={(data) => console.log(data)} />
```
