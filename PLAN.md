# Site Assistant: Embeddable AI Website Assistant

## Product Architecture

### Overview
A lightweight, embeddable AI assistant that website owners can add via a single script tag. The system consists of four main components:

1. **Widget Runtime** - The client-side JavaScript that loads on the host website
2. **Backend API** - Handles configuration, analytics, and AI responses
3. **Admin Dashboard** - Web interface for managing the assistant
4. **Content/Config Store** - Database storing assistant configurations, knowledge, and analytics

### Component Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                    Host Website                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Widget Runtime (Shadow DOM)                        │   │
│  │  - Animation engine (Lottie)                        │   │
│  │  - Chat UI                                          │   │
│  │  - Context reader                                   │   │
│  │  - Behavior triggers                                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
            │
            │ HTTPS API calls
            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (Node.js)                      │
│  - REST endpoints for widget config                         │
│  - AI response generation                                   │
│  - Analytics collection                                     │
│  - Authentication                                           │
└─────────────────────────────────────────────────────────────┘
            │
            │ SQL queries
            ▼
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                        │
│  - Widget configurations                                   │
│  - Knowledge base                                          │
│  - Usage analytics                                         │
│  - User accounts                                           │
└─────────────────────────────────────────────────────────────┘
            ▲
            │
┌─────────────────────────────────────────────────────────────┐
│                  Admin Dashboard (React)                    │
│  - Widget configuration                                    │
│  - Knowledge management                                    │
│  - Analytics view                                          │
│  - Embed code generator                                    │
└─────────────────────────────────────────────────────────────┘
```

## MVP Feature Breakdown

### Core Widget Features
1. Single script tag embedding
2. Shadow DOM isolation
3. Animated avatar (idle, thinking, typing, attention states)
4. Chat panel with message history
5. Basic page context reading (URL, title)
6. Configurable proactive triggers (time on page, scroll depth)
7. Fallback to static mode if animations disabled

### Backend API Features
1. Widget configuration endpoint
2. AI response generation via LLM API
3. Analytics event collection
4. Rate limiting and authentication
5. Multi-tenant support (widget isolation)

### Dashboard Features
1. User authentication and widget management
2. Assistant personality configuration (name, tone, avatar)
3. System prompt / instruction set editor
4. Knowledge base management (FAQs, text snippets)
5. Page-specific message rules
6. Proactive trigger configuration
7. Embed code generator
8. Basic analytics dashboard (usage, conversations)

### Knowledge Layer
1. Manual FAQ entry
2. Text snippet storage
3. Page-specific help content
4. Basic text search (no vector DB for MVP)

## Recommended Stack

### Backend
- **Runtime**: Node.js 18+ (LTS)
- **Framework**: Express.js (lightweight, minimal overhead)
- **Database**: PostgreSQL 14+ (with Prisma ORM for type safety)
- **Authentication**: JWT with refresh tokens
- **AI Integration**: OpenAI API (or compatible LLM APIs)
- **Rate Limiting**: express-rate-limit

### Widget
- **Core**: Vanilla JavaScript (ES2020)
- **Build Tool**: esbuild (fast, minimal)
- **Styling**: CSS-in-JS with Shadow DOM
- **Animation**: Lottie (lottie-web) for lightweight animations
- **HTTP Client**: Fetch API (native)

### Dashboard
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS
- **State Management**: React Context + useReducer
- **Build Output**: Static files served by backend

### Deployment
- **Containerization**: Docker with multi-stage builds
- **Process Manager**: PM2 (for production)
- **Reverse Proxy**: Nginx (for SSL, static files)
- **Cloud**: Optimized for Railway, Render, or DigitalOcean App Platform

## Database Schema Outline

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Widgets Table
```sql
CREATE TABLE widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Widget Config (JSONB structure)
```json
{
  "personality": {
    "name": "Assistant",
    "tone": "professional",
    "avatar": "lottie-animation-url",
    "welcome_message": "Hi! How can I help?"
  },
  "behavior": {
    "proactive_triggers": [
      { "type": "time_on_page", "seconds": 30, "message": "Need help?" },
      { "type": "scroll_depth", "percent": 70, "message": "Looking for something?" }
    ],
    "page_rules": [
      { "url_pattern": "/pricing", "message": "Want me to explain our plans?" },
      { "url_pattern": "/checkout", "message": "Need help with checkout?" }
    ]
  },
  "ai": {
    "system_prompt": "You are a helpful assistant...",
    "temperature": 0.7,
    "max_tokens": 150
  }
}
```

### Knowledge Entries Table
```sql
CREATE TABLE knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Conversations Table
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
  visitor_id VARCHAR(255) NOT NULL,
  messages JSONB DEFAULT '[]',
  page_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Analytics Events Table
```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  visitor_id VARCHAR(255),
  page_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Widget Loading Strategy

### Script Tag Implementation
```html
<script 
  src="https://debug.adl.ir/widget.js" 
  data-widget-id="UNIQUE_ID"
  data-api-url="https://debug.adl.ir"
  async
  defer>
</script>
```

### Loading Sequence
1. **Initial Load** (synchronous, <10KB):
   - Core loader script
   - Creates Shadow DOM container
   - Fetches widget configuration from API

2. **Deferred Load** (asynchronous):
   - Animation library (Lottie)
   - Chat UI components
   - Context reading module
   - Behavior trigger system

3. **Lazy Load** (on demand):
   - Conversation history
   - Knowledge base content
   - Additional animations

### Performance Considerations
- Total initial payload: <20KB gzipped
- Animation assets loaded on first interaction
- API calls batched where possible
- LocalStorage for caching configuration
- Respects `prefers-reduced-motion` media query

## Backend API Design

### Widget Endpoints
```
GET  /api/widgets/:id/config      - Get widget configuration
POST /api/widgets/:id/conversations - Start/continue conversation
GET  /api/widgets/:id/knowledge    - Get knowledge entries for context
POST /api/widgets/:id/analytics    - Track analytics events
```

### Dashboard Endpoints
```
POST /api/auth/login               - User authentication
POST /api/auth/register            - User registration
GET  /api/user/widgets             - List user's widgets
POST /api/user/widgets             - Create new widget
PUT  /api/user/widgets/:id         - Update widget configuration
GET  /api/user/widgets/:id/analytics - Get widget analytics
POST /api/user/widgets/:id/knowledge - Add knowledge entry
PUT  /api/user/widgets/:id/knowledge/:entryId - Update knowledge
DELETE /api/user/widgets/:id/knowledge/:entryId - Delete knowledge
```

### AI Response Endpoint
```
POST /api/ai/respond
Body: {
  widget_id: string,
  message: string,
  context: {
    page_url: string,
    page_title: string,
    conversation_history: Message[]
  }
}
Response: {
  response: string,
  suggestions?: string[]
}
```

## Dashboard Page Structure

### Authentication Pages
- Login page
- Registration page
- Password reset

### Main Dashboard
- Widget list/overview
- Quick actions (create widget, view analytics)

### Widget Management
- **Configuration Tab**:
  - Assistant name & tone
  - Avatar/animation selection
  - Welcome message
  - System prompt editor
  
- **Behavior Tab**:
  - Proactive triggers configuration
  - Page-specific rules
  - Context awareness settings
  
- **Knowledge Tab**:
  - FAQ management
  - Text snippets
  - Document upload (text files)
  - Search/test knowledge base
  
- **Analytics Tab**:
  - Usage metrics (conversations, visitors)
  - Popular pages
  - Conversation transcripts
  - Performance metrics

- **Embed Tab**:
  - Copy embed code
  - Installation instructions
  - Widget preview

## Proactive Behavior Logic Design

### Trigger Types
1. **Time-based**: After X seconds on page
2. **Scroll-based**: At X% scroll depth
3. **Behavior-based**: Mouse hesitation, rapid scrolling
4. **URL-based**: Match specific page patterns
5. **Exit-intent**: When mouse moves toward browser close

### Decision Engine
```
IF (time_on_page >= trigger.seconds) 
  AND (scroll_depth >= trigger.scroll_percent OR trigger.scroll_percent == null)
  AND (page_url matches trigger.url_pattern OR trigger.url_pattern == null)
  AND (not shown in last 5 minutes)
  AND (user hasn't dismissed similar message)
THEN show proactive message
```

### Anti-Spam Rules
- Maximum 1 proactive message per 5 minutes
- Maximum 3 proactive messages per session
- Immediate dismissal = don't show similar message again
- Respect "Don't show again" preference (LocalStorage)

### Contextual Awareness
1. **Page Analysis**:
   - Extract key topics from page content
   - Identify user intent (browsing, buying, researching)
   
2. **User Behavior**:
   - Track interaction patterns
   - Identify confusion signals (repeated clicks, backtracking)
   
3. **Knowledge Matching**:
   - Match page context to knowledge base entries
   - Suggest relevant help topics

## Animation/Avatar Implementation

### Animation Approach
- Use Lottie for complex animations (JSON-based, lightweight)
- Predefined animation states:
  - `idle`: Gentle floating/breathing animation
  - `thinking`: Processing animation (dots, spinning)
  - `typing`: Message composition animation
  - `attention`: Subtle wave or gesture
  - `success`: Celebration animation

### Technical Implementation
```javascript
// Animation state machine
const animationStates = {
  idle: 'idle.json',
  thinking: 'thinking.json',
  typing: 'typing.json',
  attention: 'attention.json',
  success: 'success.json'
};

// Load animation based on state
function setAnimation(state) {
  const animationPath = animationStates[state];
  lottie.loadAnimation({
    container: document.getElementById('avatar'),
    renderer: 'svg',
    loop: state === 'idle',
    autoplay: true,
    path: animationPath
  });
}
```

### Fallback Strategy
- If animations disabled (`prefers-reduced-motion`): Static SVG avatar
- If Lottie fails to load: Simple CSS animations
- If JavaScript disabled: Static image with alt text

### Asset Optimization
- Compress Lottie JSON files (<50KB each)
- Use vector animations (scale without quality loss)
- Lazy load non-idle animations
- Cache animations in Service Worker

## Phased Roadmap

### Phase 1: MVP (4-6 weeks)
**Goal**: Basic working system with core features
- Backend API with authentication
- Widget with basic chat and configuration
- Simple dashboard for widget management
- Manual knowledge entry
- Basic analytics
- Single LLM integration (OpenAI)

### Phase 2: Enhanced UX (2-3 months)
**Goal**: Polish and improve user experience
- Advanced animations and avatar customization
- More proactive trigger types
- Page-specific knowledge suggestions
- Conversation history and search
- Basic analytics dashboard
- Multi-language support

### Phase 3: Advanced Features (3-6 months)
**Goal**: Scale and add advanced capabilities
- Vector search for knowledge base
- Multiple LLM provider support
- A/B testing for messages
- Advanced analytics and insights
- API access for developers
- Webhook integrations

### Phase 4: Enterprise & Scale (6+ months)
**Goal**: Enterprise features and scaling
- Multi-team management
- Role-based access control
- Custom branding white-label
- Advanced AI features (sentiment analysis, intent detection)
- Performance optimizations
- Global CDN deployment

## Implementation Priorities

### Critical Path (Must Have)
1. Widget embedding and basic UI
2. Backend configuration API
3. Simple dashboard for management
4. Basic AI response generation
5. Essential analytics

### Important (Should Have)
1. Shadow DOM isolation
2. Animation system
3. Proactive triggers
4. Knowledge base management
5. User authentication

### Nice to Have (Could Have)
1. Advanced analytics
2. Multi-language support
3. A/B testing
4. Webhook integrations
5. Mobile optimization

## Technical Decisions & Trade-offs

### Chosen Approach: Monorepo Structure
**Pros**:
- Shared code between backend/dashboard
- Simplified deployment
- Easier development setup

**Cons**:
- Larger repository size
- Potential build complexity

### Alternative: Microservices
**Pros**:
- Independent scaling
- Technology flexibility
- Better isolation

**Cons**:
- More complex deployment
- Higher operational overhead
- Not justified for MVP

### Recommendation: Start with monorepo, extract services later if needed.

## Cost Considerations

### MVP Hosting (Self-hosted)
- **Database**: PostgreSQL ($0-20/month)
- **Backend**: Small VPS ($5-20/month)
- **CDN**: Cloudflare free tier
- **LLM API**: Pay-per-use ($0.01-0.10 per conversation)

### Scaling Costs
- **Database**: Managed PostgreSQL ($50-200/month)
- **Backend**: Container orchestration ($100-500/month)
- **CDN**: Bandwidth costs ($10-100/month)
- **LLM API**: Volume discounts available

### Break-even Estimate
- 100 websites × $20/month = $2,000/month revenue
- Basic hosting costs: ~$100/month
- LLM costs: ~$200/month (assuming 10 conversations/site/day)
- **Net profit**: ~$1,700/month at 100 customers