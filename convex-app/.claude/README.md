# Claude Code Configuration

This directory contains custom agents and slash commands for the HealthyMama project.

## UI Generation System

### Overview

The UI generation system allows you to create React components and pages using AI, with instant preview in a dedicated environment.

### Components

1. **UI Generator Agent** (`agents/ui-generator.md`)
   - Expert React/TypeScript component generator
   - Understands HealthyMama's stack (Next.js, Tailwind, shadcn/ui, Convex, Clerk)
   - Automatically invoked when you request UI creation
   - Generates production-ready, accessible code

2. **Slash Commands** (`commands/`)
   - `/ui` - General UI generation
   - `/component` - Create reusable components
   - `/page` - Generate complete pages
   - `/form` - Build forms with validation

3. **Preview Environment** (`app/ui-preview/`)
   - Live preview page at [http://localhost:3000/ui-preview](http://localhost:3000/ui-preview)
   - Hot reload for instant feedback
   - Full app context (Convex, Clerk, routing)

### Quick Start

#### 1. Generate a Component

```
/ui create a testimonial card with avatar, quote, author name, and rating
```

The agent will:
- Analyze existing component patterns
- Generate TypeScript component with proper types
- Use shadcn/ui primitives
- Apply Tailwind styling
- Include accessibility features
- Create in `app/ui-preview/components/`

#### 2. Preview It

Navigate to [http://localhost:3000/ui-preview](http://localhost:3000/ui-preview) to see your component live.

#### 3. Iterate

```
/ui update TestimonialCard: add company logo and make rating gold
```

Changes reflect immediately with hot reload.

#### 4. Deploy

```
Move TestimonialCard to components/ for use in production
```

### Usage Examples

#### Basic Component
```
/ui create a stat card showing a number, label, and trend indicator
```

#### Data-Connected Component
```
/component RecipeGrid "displays user's saved recipes from Convex"
```

#### Form with Validation
```
/form ProfileSettings "firstName lastName email dietaryPreferences"
```

#### Complete Page
```
/page UserDashboard "weekly meal plan, saved recipes, and nutrition stats"
```

### Features

#### Stack Integration
- **Next.js 14 App Router** - Modern routing and layouts
- **TypeScript** - Full type safety
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful pre-built components
- **Convex** - Real-time data and mutations
- **Clerk** - Authentication and user management

#### Best Practices Built-In
- ✅ Accessibility (ARIA labels, semantic HTML, keyboard navigation)
- ✅ Responsive design (mobile-first with breakpoints)
- ✅ Loading states and error handling
- ✅ TypeScript interfaces and JSDoc comments
- ✅ Form validation and toast notifications
- ✅ Performance optimization (server/client components)

#### Code Quality
- Follows existing codebase patterns
- Uses installed dependencies only
- Matches your component structure
- Includes proper imports and exports
- Production-ready from the start

### Workflow

```
┌─────────────────────────────────────────────┐
│  1. Describe UI                             │
│     "/ui create a card..."                  │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  2. AI Agent Analyzes                       │
│     - Checks existing components            │
│     - Reviews codebase patterns             │
│     - Identifies available UI primitives    │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  3. Generate Component                      │
│     - TypeScript with types                 │
│     - Tailwind + shadcn/ui                  │
│     - Convex/Clerk integration              │
│     - Accessibility features                │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  4. Preview at /ui-preview                  │
│     - Hot reload enabled                    │
│     - Full app context                      │
│     - Test all states                       │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  5. Iterate with Feedback                   │
│     "/ui update Component: make it blue"    │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  6. Move to Production                      │
│     - Copy to components/                   │
│     - Import in pages                       │
│     - Deploy to users                       │
└─────────────────────────────────────────────┘
```

### Tips

#### Automatic vs Explicit

**Automatic** (agent detects need):
```
"I need a search bar with autocomplete"
"Can you build a user profile page?"
"Create a form for recipe submission"
```

**Explicit** (you invoke command):
```
/ui create a navigation menu
/component SearchBar "autocomplete dropdown"
/page ProfilePage
/form RecipeSubmission "title ingredients instructions"
```

#### Getting Better Results

1. **Be specific** about features:
   - ✅ "create a card with image, title, description, tags, and save button"
   - ❌ "make a card"

2. **Mention data sources**:
   - "display user's saved recipes from Convex"
   - "show Clerk user profile data"

3. **Specify interactions**:
   - "clicking save button calls Convex mutation"
   - "form submits to Convex and shows toast on success"

4. **Request styles**:
   - "use gradient background from purple to pink"
   - "make it match the cookbook card style"

#### Common Patterns

**Recipe Card**
```
/ui create a recipe card with image, title, cooking time, diet tags, and save button connected to Convex
```

**User Profile Header**
```
/component ProfileHeader "Clerk user avatar, name, email, edit button that opens dialog"
```

**Dashboard Layout**
```
/page Dashboard "3-column grid with stats cards, recent activity list, and quick actions"
```

**Settings Form**
```
/form UserSettings "dietary preferences (multi-select), meal frequency (dropdown), notification settings (toggles)"
```

### File Locations

```
.claude/
├── agents/
│   └── ui-generator.md         # Main AI agent
├── commands/
│   ├── ui.md                    # General UI generation
│   ├── component.md             # Component-specific
│   ├── page.md                  # Page generation
│   └── form.md                  # Form generation
└── README.md                    # This file

app/
└── ui-preview/
    ├── page.tsx                 # Preview page UI
    ├── layout.tsx               # Preview layout
    └── components/              # Generated components
        └── [YourComponents].tsx
```

### Troubleshooting

#### Agent Not Triggering Automatically
- Use explicit slash command: `/ui [description]`
- Check if description clearly indicates UI generation
- Ensure `.claude/agents/ui-generator.md` exists

#### Component Not Appearing in Preview
- Check that file was created in `app/ui-preview/components/`
- Refresh browser (Ctrl+R or Cmd+R)
- Check browser console for errors
- Ensure dev server is running

#### Missing Dependencies
- Agent only uses installed packages
- If component needs a new library, install it first
- Check `package.json` for available dependencies

#### TypeScript Errors
- Agent follows strict TypeScript mode
- Check that all types are properly defined
- Ensure imports are correct

### Advanced Usage

#### Custom Styling
```
/ui create a card with gradient background from teal to blue, rounded corners, and shadow
```

#### Complex Layouts
```
/page UserProfile "left sidebar with avatar and bio, main area with tabs (About, Recipes, Activity), right sidebar with stats"
```

#### Integration with Existing Components
```
/ui create a RecipeList that uses the existing RecipeCard component to display Convex recipes data
```

#### Server vs Client Components
```
/component ServerRecipeCard "server component that fetches recipe data directly in Next.js"
/component ClientRecipeCard "client component with interactive save button and Convex mutation"
```

### Best Practices

1. **Start Simple** - Generate basic version first, then iterate
2. **Preview Early** - Check in `/ui-preview` before refining
3. **Follow Patterns** - Agent matches existing component styles
4. **Test States** - Check loading, error, and empty states
5. **Move Deliberately** - Test thoroughly before moving to production
6. **Clean Up** - Remove unused preview components periodically

### Contributing

When adding new agents or commands:
1. Follow existing file structure
2. Include clear descriptions in frontmatter
3. Document usage in this README
4. Test with real use cases
5. Commit to git for team sharing

---

**Need Help?**
- Check examples above
- Read agent file: `.claude/agents/ui-generator.md`
- Visit preview: [http://localhost:3000/ui-preview](http://localhost:3000/ui-preview)
- Ask AI: "How do I create a [component type]?"

Generated with ❤️ by the HealthyMama team
