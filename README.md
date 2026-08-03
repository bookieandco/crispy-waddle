# Jhadina Monorepo

A unified personal AI operating system with multiple intelligence layers.

## System Architecture

Jhadina is designed as **one product with multiple capabilities**, not a collection of separate apps:

- **JANET** - Memory, identity, taste, personalization
- **DELIA** - Strategy, analysis, prioritization
- **MARISA** - Production, automation, execution
- **Safeguard** - Security, permissions, policy enforcement

All modules connect through shared infrastructure (event bus, knowledge graph, database).

For detailed architecture: see [ARCHITECTURE.md](./ARCHITECTURE.md)

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose (for local database)

### Installation

```bash
# Install dependencies
pnpm install

# Start local infrastructure
docker-compose up -d

# Run development environment
pnpm dev
```

This starts:
- Jhadina web UI
- All AI services
- Local PostgreSQL database
- Event bus
- Hot module reloading

## Monorepo Structure

```
jhadina/
├── apps/                          # User-facing applications
│   ├── jhadina-web/              # Main dashboard (Next.js)
│   ├── jhadina-mobile/           # Mobile app (React Native)
│   ├── janet-memory/             # Memory service
│   ├── delia-intelligence/       # Strategy service
│   ├── marisa-studio/            # Production service
│   ├── overageos/                # Opportunity intelligence
│   ├── entertainment/            # Culture system
│   └── money-core/               # Financial intelligence
│
├── packages/                       # Shared libraries
│   ├── memory-core/              # Memory interfaces
│   ├── knowledge-graph/          # Entity relationships
│   ├── ai-core/                  # AI provider abstraction
│   ├── security-core/            # Auth & encryption
│   ├── notification-engine/      # Alert system
│   ├── connector-framework/      # API integration
│   └── types/                    # Shared TypeScript types
│
├── infrastructure/                # Core systems
│   ├── database/                 # PostgreSQL schema & migrations
│   ├── event-bus/                # Event orchestration
│   └── config/                   # Environment & feature flags
│
├── scripts/                        # Monorepo utilities
├── docker-compose.yml            # Local development environment
├── pnpm-workspace.yaml           # pnpm workspace config
├── turbo.json                    # Turborepo pipeline
├── tsconfig.json                 # TypeScript root config
└── README.md
```

## Phase 1 Priority

Build the foundation:

1. **jhadina-web** - Main user interface
2. **janet-memory** - Personal memory system
3. **memory-core** - Shared memory interfaces
4. **security-core** - Auth and encryption
5. **notification-engine** - Alert system
6. **connector-framework** - API integration

## Available Commands

```bash
# Development
pnpm dev              # Start all services
pnpm dev --filter=@jhadina/memory-core  # Specific package

# Building
pnpm build            # Build all packages
pnpm build --filter=@jhadina/ai-core    # Specific package

# Testing
pnpm test             # Run all tests
pnpm test -- --watch  # Watch mode

# Linting
pnpm lint             # Lint all packages
pnpm type-check       # TypeScript checks

# Database
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed sample data
```

## Adding New Packages

### New App
```bash
cd apps
mkdir my-new-app
cd my-new-app
# Copy tsconfig.json and package.json from existing app
# Adjust name to @jhadina/my-new-app
```

### New Shared Package
```bash
cd packages
mkdir my-new-package
cd my-new-package
# Copy tsconfig.json and package.json from existing package
# Adjust name to @jhadina/my-new-package
```

After creating new package:
1. Update `tsconfig.json` root paths
2. Update `turbo.json` if new task types needed
3. Run `pnpm install` to link workspaces

## Configuration

### Environment Variables

Create `.env.local` in root:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/jhadina

# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Auth
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key

# Services
EVENT_BUS_URL=http://localhost:3001
```

### Feature Flags

Edit `infrastructure/config/feature-flags.json`:

```json
{
  "features": {
    "memory-v2": false,
    "delia-recommendations": true,
    "marisa-automation": false
  }
}
```

## Development Workflow

### 1. Start Development Environment
```bash
pnpm dev
```

### 2. Make Changes
- Edit files in `apps/` or `packages/`
- Hot reload automatically applies changes

### 3. Run Tests
```bash
pnpm test
```

### 4. Create Pull Request
- Commit to feature branch
- Push and open PR
- CI/CD runs checks automatically

### 5. Deploy
- Merge to main
- Automated deployment to staging/production

## Service Communication

Services communicate via:

1. **Direct API Calls** - REST/GraphQL between services
2. **Event Bus** - Async event processing
3. **Shared Packages** - In-memory interfaces for same process
4. **Database** - Persistent state and relationships

## Security

⚠️ **Never commit secrets to the repository**

- Store API keys in `.env.local` (not in repo)
- Use GitHub Secrets for CI/CD
- Rotate keys regularly
- All sensitive operations logged via audit system

## Monitoring

Key services to monitor:
- Database query performance
- Event bus lag and throughput
- API response times
- Error rates by service
- Memory usage patterns

## Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes following architecture patterns
3. Write tests for new functionality
4. Run `pnpm test` and `pnpm lint`
5. Create PR with description of changes

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and patterns
- [apps/jhadina-web/README.md](./apps/jhadina-web/README.md) - Web app docs
- [packages/memory-core/README.md](./packages/memory-core/README.md) - Memory core API

## Resources

- [Turborepo Docs](https://turbo.build)
- [pnpm Docs](https://pnpm.io)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Next.js Docs](https://nextjs.org/docs)

## License

Private repository. All rights reserved.

## Support

For questions or issues, open a GitHub issue or contact the team.
