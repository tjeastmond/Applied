## Learned User Preferences

- Use Shadcn UI for frontend components
- Show status feedback with Sonner toasts in the bottom-right corner, not inline alert banners
- Add and edit job applications in a Shadcn Dialog modal, not inline on the page
- Do not edit attached plan files when implementing plans

## Learned Workspace Facts

- Applied.dev is a single-page job application tracker
- Stack: Bun runtime, Vite build, strict TypeScript, React, Tailwind CSS, Shadcn UI
- Dev server and API run on port 3000 (`PORT` env overrides default)
- Tooling includes Prettier, ESLint, and Vitest (run via `bun`)
- Required application form fields: job posting URL, title, company, apply date; all other fields are optional
- Parsed job postings store cleaned minimal HTML in `full_jd`, separate from user notes
- SQLite persistence via Bun (`data/applied.db` by default)
