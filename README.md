# Puzzel Co-Work

A collaborative workspace platform built with Next.js, TypeScript, and PostgreSQL.

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start the database
pnpm db:up

# 3. Generate Prisma client
pnpm db:generate

# 4. Push schema to database
pnpm db:push

# 5. Seed database with admin user
ADMIN_PASSWORD=YourSecurePassword123! pnpm db:seed

# 6. Start development server
pnpm dev

# 7. Verify health check
curl http://localhost:3002/api/health
```

## Scripts

| Command                       | Description                               |
| ----------------------------- | ----------------------------------------- |
| `pnpm dev`                    | Start development server (port 3002)     |
| `pnpm build`                  | Build for production                      |
| `pnpm start`                  | Start production server (port 3002)     |
| `pnpm lint`                   | Run ESLint                                |
| `pnpm format`                 | Format code with Prettier                 |
| `pnpm db:up`                  | Start PostgreSQL (Docker)                |
| `pnpm db:down`                | Stop PostgreSQL                           |
| `pnpm db:generate`            | Generate Prisma client                    |
| `pnpm db:push`                | Push schema to database (dev only)        |
| `pnpm db:seed`                | Seed database with initial data           |
| `pnpm db:studio`              | Open Prisma Studio                        |
| `pnpm generate:secrets`       | Generate secure secrets for deployment    |

### ⚠️ Database Migration Safety

**NEVER use these commands in production:**

- `pnpm db:reset` - **DROPS ALL DATA** (development only)
- `prisma db push --force-reset` - **DROPS ALL TABLES**

**Always use for production:**

- `npx prisma migrate deploy` - Safely applies pending migrations

## Project Structure

```
puzzel-co-work/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Database seeding script
├── src/
│   ├── app/
│   │   ├── api/           # API routes
│   │   │   ├── auth/      # Authentication endpoints
│   │   │   ├── csrf-token/# CSRF token endpoint
│   │   │   └── health/    # Health check endpoint
│   │   ├── globals.css    # Global styles
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Home page
│   ├── components/        # React components
│   │   └── navigation/    # Navigation components
│   ├── lib/               # Utility libraries
│   │   ├── auth/          # Authentication module
│   │   ├── db.ts          # Prisma client
│   │   ├── env.ts         # Environment validation
│   │   ├── csrf.ts        # CSRF protection
│   │   ├── password.ts    # Password utilities
│   │   ├── permissions.ts # RBAC permissions
│   │   ├── validation.ts # Zod validation schemas
│   │   ├── rate-limit.ts  # Rate limiting
│   │   └── audit.ts       # Audit logging
│   └── types/             # TypeScript types
├── docker-compose.yml     # Local database
├── .env.example           # Environment template
└── .env.local             # Local environment (gitignored)
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable          | Description                          |
| ----------------- | ------------------------------------ |
| `DATABASE_URL`    | PostgreSQL connection string          |
| `NEXTAUTH_SECRET` | JWT signing secret                   |
| `NEXTAUTH_URL`    | Application URL (http://localhost:3002) |
| `ADMIN_PASSWORD`  | Admin user password (for seeding)    |

## Port Configuration

- **Application Port**: 3002 (fixed)
- **PostgreSQL Port**: 5434 (to avoid conflict with other apps)

## Security Features

- CSRF protection for state-changing operations
- Security headers (HSTS, X-Frame-Options, CSP, etc.)
- Request size limits
- Password hashing with bcryptjs
- JWT-based authentication
- RBAC foundation (roles and permissions)
- Audit logging infrastructure
- Rate limiting for API endpoints

## Development

The application uses:

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Prisma** - Database ORM
- **PostgreSQL** - Database
- **Tailwind CSS 4** - Styling
- **Zod** - Schema validation

## Cursor Rules & Skills

This project includes Cursor rules and skills for consistent development:

- **`.cursor/.cursorrules`** - Project-specific development guidelines
- **`AGENTS.md`** - Shared operating guide for humans and agents
- **`.cursor/skills/`** - Development skills for common tasks (API routes, database, UI, etc.)

See `AGENTS.md` for details on using skills and following development patterns.

## License

Private - Puzzel Internal Use Only
