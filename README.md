# Site Assistant

An embeddable contextual AI site assistant with personality — inspired by Microsoft Office's Clippy, but modern, useful, and non-intrusive. Now powered by Mimo via tmux integration.

## Architecture

```
site-assistant/
├── backend/          # Express + PostgreSQL API server
│   ├── prisma/       # Database schema
│   ├── src/          # API routes, middleware, AI/tmux integration
│   └── Dockerfile
├── widget/           # Embeddable JavaScript widget
│   ├── src/          # Shadow DOM, avatar, chat, proactive engine
│   └── build.js      # esbuild bundler
├── dashboard/        # React admin dashboard + standalone chat page
│   ├── src/          # Pages, API client, auth
│   ├── chat.html     # Standalone chat interface
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or use Docker)
- Tmux with Mimo running in session 2

### 1. Start Database
```bash
docker-compose up postgres -d
```

### 2. Setup Backend
```bash
cd backend
cp .env.example .env   # Edit with your values
npm install
npx prisma db push
npm run dev
```

### 3. Setup Dashboard
```bash
cd dashboard
npm install
npm run dev
```

### 4. Build Widget
```bash
cd widget
npm install
npm run build
```

### 5. Docker (all-in-one)
```bash
cp backend/.env.example backend/.env   # Edit TMUX_SESSION if needed
docker-compose up -d
```

## Usage

### For Website Owners

1. Sign up at the dashboard
2. Create an assistant (name, personality, knowledge)
3. Copy the embed script
4. Add to your website:
```html
<script 
  src="https://cdn.siteassistant.io/widget.js" 
  data-widget-id="your-widget-slug"
  data-api-url="http://localhost:3001"
  async defer>
</script>
```

### Standalone Chat Page

Access the standalone chat interface at:
```
http://localhost:3001/chat
```

### API Endpoints

**Public (for widget):**
- `GET /api/public/widgets/:slug/config` — Get widget configuration
- `POST /api/public/widgets/:slug/chat` — Send message, get AI response
- `POST /api/public/widgets/:slug/events` — Track analytics event

**Authenticated (for dashboard):**
- `POST /api/auth/register` / `POST /api/auth/login` — Authentication
- `GET/POST/PUT/DELETE /api/widgets` — Widget CRUD
- `GET/POST/PUT/DELETE /api/widgets/:id/knowledge` — Knowledge management
- `GET /api/widgets/:id/analytics` — Usage analytics

**Chat:**
- `GET /chat` — Standalone chat page

## Features

### Widget
- **Shadow DOM isolation** — No CSS/JS conflicts with host site
- **Animated avatar** — Lottie-based with fallback to static SVG
- **Proactive triggers** — Time on page, scroll depth, page rules
- **Context-aware** — Reads page URL, title, and metadata
- **Lightweight** — <20KB initial load, lazy animations

### Standalone Chat
- Full-page chat interface
- Real-time message display
- Typing indicators
- Responsive design

### Dashboard
- Create/manage multiple assistants per account
- Configure personality, tone, avatar color, position
- Set proactive triggers and page-specific rules
- Manage knowledge base (FAQs, text snippets)
- View usage analytics
- One-click embed code copy

### Backend
- Multi-tenant with JWT authentication
- Mimo integration via tmux (session 2)
- Keyword-based knowledge retrieval (no vector DB needed)
- Efficient PostgreSQL schema with proper indexing
- Rate limiting ready

## Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Widget isolation | Shadow DOM | Native, no iframe overhead, better UX |
| Animation | Lottie (inline) | Lightweight, vector, progressive enhancement |
| Knowledge search | Keyword matching | No external dependencies, good enough for MVP |
| Backend | Express + Prisma | Lightweight, type-safe, production-proven |
| Database | PostgreSQL | JSONB for flexible config, good for multi-tenant |
| AI integration | Tmux/Mimo | Direct CLI interaction, no API keys needed |
| Dashboard | React + Vite | Fast dev, small bundle, Tailwind for styling |

## Roadmap

### MVP ✅
- Embeddable widget with Shadow DOM
- Animated avatar with state machine
- Chat panel with Mimo responses via tmux
- Proactive triggers (time, scroll, page rules)
- Knowledge base management
- Basic analytics
- Admin dashboard
- Standalone chat page

### V2
- Conversation history and search
- Multi-language support
- Advanced analytics (funnels, heatmaps)
- A/B testing for messages
- Webhook integrations
- Custom CSS/JS injection

### V3
- Vector search for knowledge (pgvector)
- Sentiment analysis
- Multi-LLM provider support
- Team management and roles
- White-label support
- API access for developers

## License

MIT
