# PEGMS Deployment

## Required Production Environment Variables

Set these in Vercel Project Settings > Environment Variables:

```env
DATABASE_URL="postgresql://...supabase-pooler.../postgres?schema=public"
DIRECT_URL="postgresql://...supabase-direct.../postgres?schema=public"
AUTH_SECRET="generate-a-long-random-secret"
AUTH_URL="https://your-vercel-domain.vercel.app"
```

## Supabase

- Use `DATABASE_URL` for the pooled Supabase connection.
- Use `DIRECT_URL` for the direct Supabase connection used by Prisma migrations.
- Run migrations once against Supabase:

```bash
npm.cmd exec prisma migrate deploy
```

Optional seed for first admin/demo records:

```bash
npm.cmd run prisma:seed
```

## Vercel

- Build command: `npm run build`
- Install command: `npm install`
- Output: Next.js default
- `postinstall` runs `prisma generate` automatically.

## GitHub

Use a PEGMS-specific repository. Do not push this project to an unrelated existing repository.
