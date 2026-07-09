# @workspace/db

Prisma database client package using PostgreSQL via `pg` adapter.

## Setup

```ini
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
```

## Scripts

```bash
bun run generate    # Generate Prisma client
bun run migrate     # Run migrations (dev)
bun run push        # Push schema to DB
bun run studio      # Open Prisma Studio
bun run typecheck   # TypeScript check
```
