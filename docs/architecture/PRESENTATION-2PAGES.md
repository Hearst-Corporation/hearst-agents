# 🧠 Hearst OS — Architecture Technique

> **Plateforme IA Multi-Agents Enterprise** | v2.0 | 2026

---

## PAGE 1 — VUE D'ENSEMBLE & ARCHITECTURE

---

### 🎯 Mission

**Hearst OS** est le système nerveux numérique de l'entreprise moderne — un cerveau IA multi-agents qui comprend, apprend, et agit en autonomie supervisée.

```mermaid
graph LR
    subgraph "Vision"
        A["Assistant IA<br/>Multi-Modal"] --> B["Mémoire<br/>Sémantique"]
        B --> C["Orchestration<br/>Intelligente"]
        C --> D["Intégration<br/>Écosystème"]
        D --> E["Apprentissage<br/>Continu"]
    end
    style A fill:#e1f5fe
    style B fill:#e8f5e9
    style C fill:#fff3e0
    style D fill:#fce4ec
    style E fill:#f3e5f5
```

---

### 🏗️ Architecture Globale

```mermaid
graph TB
    subgraph "🖥️ Client"
        C1["Next.js 15<br/>React 19"]
        C2["Electron<br/>Desktop"]
        C3["PWA<br/>Mobile"]
    end

    subgraph "🌐 Edge"
        E1["CDN Vercel"]
        E2["WAF / Rate Limit"]
    end

    subgraph "⚡ API Gateway"
        G1["REST + SSE"]
        G2["WebSocket"]
        G3["Auth JWT + RBAC"]
    end

    subgraph "🧠 AI Core"
        A1["Orchestrateur"]
        A2["Agent Runtime"]
        A3["Prompt Engine"]
        A4["Memory Service"]
        A5["Retrieval RAG"]
    end

    subgraph "📊 Data"
        D1[("PostgreSQL<br/>Supabase")]
        D2[("Pinecone<br/>Vector DB")]
        D3[("Redis<br/>Cache + Queue")]
        D4[("S3<br/>Stockage")]
    end

    subgraph "🔧 Workers"
        W1["Files"]
        W2["Analytics"]
        W3["Notifs"]
        W4["Billing"]
    end

    subgraph "🔭 Observabilité"
        O1["Langfuse"]
        O2["Prometheus"]
        O3["Grafana"]
        O4["Sentry"]
    end

    subgraph "🌍 LLM Providers"
        L1["OpenAI<br/>GPT-4o"]
        L2["Anthropic<br/>Claude 3.5"]
        L3["Google<br/>Gemini 1.5"]
    end

    C1 --> E1
    C2 --> E1
    C3 --> E1
    E1 --> E2 --> G1
    G1 --> G3 --> A1
    G2 --> A1
    A1 --> A2 --> A3 --> A4 --> A5
    A2 --> L1
    A2 --> L2
    A2 --> L3
    A4 --> D1
    A4 --> D2
    A5 --> D2
    A1 --> D3
    W1 --> D3
    W2 --> D3
    W1 --> D4
    A1 --> O1
    A2 --> O2
    G1 --> O4
```

---

### 🛠️ Stack Technique

| Couche | Technologie | Rôle | Justification |
|--------|-------------|------|---------------|
| **Frontend** | Next.js 15 + React 19 + Tailwind 4 + shadcn/ui | UI moderne, SSR, RSC | Performance, SEO, design system |
| **State** | Zustand + Immer | Global state minimal | TypeScript-first, middlewares |
| **Desktop** | Electron + Vite | App native macOS/Windows | Codebase partagée |
| **Auth** | Supabase Auth | JWT, OAuth2, MFA, RLS | SOC2, intégration PG |
| **API** | Next.js API Routes + Edge | Gateway unifiée | Serverless, auto-scale |
| **AI SDK** | Vercel AI SDK | Abstraction multi-LLM | Streaming, tool calling, type-safe |
| **Vector DB** | Pinecone Serverless | Embeddings + recherche | <50ms latence, hybrid search |
| **Cache/Queue** | Redis (Upstash) | Sessions, jobs, pub/sub | Serverless, structures riches |
| **Object Storage** | AWS S3 / R2 | Fichiers, assets | 11 9s durabilité, CDN |
| **Queue Engine** | BullMQ | Workers async | Retry, scheduling, DLQ |
| **Observability** | Langfuse + Prometheus + Grafana + Sentry | LLM tracing + metrics + logs + errors | Standard industrie |
| **CI/CD** | GitHub Actions + Vercel | Build, test, deploy | Matrix builds, edge deploy |
| **Infra** | Terraform + Docker | IaC, local dev | Reproductible, testable |

---

### 🔌 Services (18 Microservices)

```mermaid
graph LR
    subgraph "Services"
        S1["API Gateway"]
        S2["Auth"]
        S3["Users"]
        S4["Billing"]
        S5["AI Orchestrator"]
        S6["Agent Runtime"]
        S7["Prompt Engine"]
        S8["Memory"]
        S9["Embedding"]
        S10["Retrieval"]
        S11["Workflow Engine"]
        S12["Notifications"]
        S13["Analytics"]
        S14["Admin"]
        S15["File Processing"]
        S16["Realtime WS"]
        S17["Vector DB"]
        S18["Observability"]
    end

    S1 --> S2
    S1 --> S5
    S5 --> S6 --> S7 --> S8 --> S9 --> S10
    S5 --> S11
    S11 --> S6
    S1 --> S16
    S8 --> S17
    S10 --> S17
```

---

### 📈 Cas d'Usage & Valeur Métier

| Cas d'usage | Agents | Gain |
|-------------|--------|------|
| Analyse financière | Analyste + Data + Notification | **-80%** temps analyse |
| Génération de contenu | Rédacteur + Relecteur + SEO | **×5** productivité |
| Recherche intelligente | Retrieval + Synthèse + Citation | **95%+** précision |
| Ordonnancement | Planning + Calendar + Notification | **Zero** oubli |
| Support technique | Support + Tech + Escalation | **-60%** tickets |
| Veille stratégique | Veille + Analyste + Briefing | **Temps réel** |

---

### 💰 Coûts & Scaling (10K MAU)

| Poste | Mensuel |
|-------|---------|
| Infra (Vercel + Supabase + Pinecone + Redis + S3) | **~$1,436** |
| LLM (OpenAI + Anthropic) | **~$1,200** |
| **TOTAL** | **~$2,636** |

```mermaid
graph LR
    S1["10K MAU<br/>$2.6K"] --> S2["100K MAU<br/>$12K"] --> S3["1M MAU<br/>$80K"] --> S4["10M MAU<br/>$500K"]
    style S1 fill:#e8f5e9
    style S2 fill:#fff3e0
    style S3 fill:#fce4ec
    style S4 fill:#f3e5f5
```

---

## PAGE 2 — DÉTAIL TECHNIQUE

---

### 🤖 Architecture des Agents

```mermaid
graph TB
    subgraph "Multi-Agent System"
        ORCH["🎯 Orchestrateur<br/>Commandeur"]
        
        subgraph "Agent Pool"
            A1["📊 Analyste"]
            A2["✍️ Rédacteur"]
            A3["🔍 Rechercheur"]
            A4["📅 Planificateur"]
            A5["💻 Codeur"]
            A6["✅ Vérificateur"]
        end
        
        subgraph "Shared Memory"
            M1["🧠 Short-Term<br/>Redis"]
            M2["🧠 Long-Term<br/>PostgreSQL"]
            M3["🧠 Vector<br/>Pinecone"]
            M4["🧠 Semantic<br/>Knowledge Graph"]
        end
        
        subgraph "Tools"
            T1["🔧 APIs externes"]
            T2["🔧 Functions"]
            T3["🔧 Calculs"]
        end
    end

    ORCH --> A1 & A2 & A3 & A4 & A5 & A6
    A1 & A2 & A3 & A4 & A5 & A6 --> M1 & M2 & M3 & M4
    A1 & A2 & A3 & A4 & A5 & A6 --> T1 & T2 & T3
    A1 -.->|collab| A2
    A3 -.->|feed| A1
    A5 -.->|review| A6
```

---

### ⚡ Agent Execution Loop

```mermaid
graph TB
    E1["👤 User Request"] --> E2["🧠 Load Context<br/>Memory + Tools"]
    E2 --> E3["💭 LLM Reasoning"]
    E3 --> E4{"🔧 Action?"}
    E4 -->|Oui| E5["⚡ Execute Tool<br/>Sandboxed 30s"] --> E6["👁️ Observation"] --> E3
    E4 -->|Non| E7{"✅ Complete?"}
    E7 -->|Non| E3
    E7 -->|Oui| E8["🛡️ Validate<br/>Quality Gate"]
    E8 -->|Fail| E3
    E8 -->|Pass| E9["💾 Save Memory"] --> E10["📤 Stream Response"] --> E11["🏁 END"]
    
    style E1 fill:#e1f5fe
    style E11 fill:#e8f5e9
    style E5 fill:#fff3e0
    style E8 fill:#fce4ec
```

---

### 🧠 LLM Routing Intelligent

```mermaid
graph TB
    ROUTE["📊 Request Analysis<br/>Complexity × Context × Latency × Cost"] --> Q1{"Complex?"}
    Q1 -->|Oui| P1["🥇 GPT-4o<br/>ou Claude 3.5 Sonnet<br/>$2.5-3/M input"]
    Q1 -->|Non| Q2{"Long context<br/>>100K?"}
    Q2 -->|Oui| P2["🥇 Claude 3.5 Sonnet<br/>200K context<br/>$3/M input"]
    Q2 -->|Non| Q3{"Fast?"}
    Q3 -->|Oui| S1["🥈 GPT-4o-mini<br/>ou Haiku<br/>$0.15-0.25/M input"]
    Q3 -->|Non| Q4{"Multimodal?"}
    Q4 -->|Oui| P3["🥇 Gemini 1.5 Pro<br/>1M context<br/>$3.5/M input"]
    Q4 -->|Non| S2["🥈 GPT-4o-mini<br/>Standard<br/>$0.15/M input"]
    
    P1 -.->|Timeout| S1
    P2 -.->|Timeout| S1
    S1 -.->|Error| F1["🥉 Gemini Flash<br/>Fallback<br/>$0.35/M input"]
    S2 -.->|Error| F1
    
    style P1 fill:#e8f5e9
    style P2 fill:#e8f5e9
    style S1 fill:#fff3e0
    style S2 fill:#fff3e0
    style F1 fill:#fce4ec
```

---

### 📚 Pipeline RAG Complet

```mermaid
graph LR
    subgraph "Ingestion"
        I1["📄 Upload"] --> I2["🔍 OCR/Parse"] --> I3["✂️ Chunk<br/>512-1024t"]
    end
    
    subgraph "Index"
        I4["🔢 Embed<br/>3072d"] --> I5["📦 Upsert<br/>Pinecone"]
    end
    
    subgraph "Query"
        Q1["❓ Question"] --> Q2["🔢 Embed"] --> Q3["🔍 Vector Search<br/>Top 10"]
        Q3 --> Q4["🎯 Rerank<br/>Cross-Encoder"] --> Q5["📋 Top 5"]
    end
    
    subgraph "Generate"
        G1["💉 Context Injection<br/>+ Citations"] --> G2["🤖 LLM Generate<br/>RAG-enhanced"]
    end

    I3 --> I4
    I5 -.->|Query time| Q1
    Q5 --> G1 --> G2
```

---

### 🛡️ Sécurité — Defense in Depth

```mermaid
graph LR
    S1["🌐 Edge<br/>WAF + DDoS + Bot"] --> S2["🔐 Transport<br/>TLS 1.3 + mTLS"]
    S2 --> S3["🔑 Auth<br/>JWT RS256 + MFA + OAuth2"]
    S3 --> S4["🛂 AuthZ<br/>RBAC + ABAC + RLS"]
    S4 --> S5["✅ Input<br/>Zod + Sanitization"]
    S5 --> S6["🤖 AI Guardrails<br/>Prompt injection + Jailbreak + PII"]
    S6 --> S7["🔒 Data<br/>AES-256 + Field encryption"]
    S7 --> S8["📋 Audit<br/>Immutable logs"]
    
    style S1 fill:#ffebee
    style S6 fill:#ffebee
    style S7 fill:#ffebee
```

| Couche | Mécanisme | Priorité |
|--------|-----------|----------|
| Edge | Cloudflare WAF, Arcjet rate limit | 🔴 Critique |
| Auth | Supabase Auth, JWT RS256, MFA | 🔴 Critique |
| AuthZ | RBAC middleware, PostgreSQL RLS | 🟠 Haute |
| Input | Zod schemas, regex sanitization | 🟠 Haute |
| AI Safety | Prompt injection detection, output filtering, PII redaction | 🔴 Critique |
| Data | AES-256 at rest, field-level encryption | 🟠 Haute |
| Secrets | HashiCorp Vault, rotation automatique | 🟠 Haute |
| Audit | Append-only signed logs, GDPR compliant | 🟡 Moyenne |

---

### ☁️ Infrastructure Cloud

```mermaid
graph TB
    subgraph "Edge"
        E1["Vercel Edge<br/>Global CDN"]
    end
    
    subgraph "Compute"
        C1["Next.js Serverless<br/>Frontend + API"]
        C2["ECS Fargate<br/>Workers"]
        C3["Lambda<br/>Webhooks"]
    end
    
    subgraph "Data"
        D1["PostgreSQL<br/>Primary + Replica"]
        D2["Pinecone<br/>Serverless"]
        D3["Redis<br/>Upstash"]
        D4["S3<br/>Object Store"]
    end
    
    subgraph "Observability"
        O1["Langfuse<br/>LLM Traces"]
        O2["Grafana<br/>Dashboards"]
        O3["Sentry<br/>Errors"]
    end
    
    E1 --> C1
    C1 --> D1 & D2 & D3
    C2 --> D1 & D3 & D4
    C1 --> O1 & O2 & O3
```

---

### 📊 Monitoring & Alerting

| Dashboard | Métriques clés | Audience |
|-----------|----------------|----------|
| **LLM Performance** | Latence P99, coût/requête, token usage, quality score | AI Engineers |
| **System Health** | CPU, memory, DB connections, queue depth | DevOps |
| **Business** | DAU, MRR, churn, feature usage | Product / Exec |
| **Agent Performance** | Success rate, execution time, tool usage | AI Engineers |
| **Security** | Auth failures, rate limit hits, anomalies | Security |
| **RAG Quality** | Precision@K, hallucination rate, MRR | AI Engineers |

| Alerte | Seuil | Canal | Escalade |
|--------|-------|-------|----------|
| API Error Rate | > 1% | PagerDuty | 5 min |
| LLM Latency P99 | > 10s | Slack | 10 min |
| Queue Depth | > 1000 | Slack | 15 min |
| Auth Failures | > 10/min | Security Slack | Immédiat |
| Hallucination Rate | > 5% | AI Team | 30 min |

---

### 🚀 Roadmap 2024-2027

```mermaid
gantt
    title Roadmap Technique
    dateFormat  YYYY-MM
    section 2024 — Fondations
    Chat multi-agents         :done, 2024-01, 2024-06
    Mémoire sémantique        :done, 2024-03, 2024-08
    Workflows basiques        :done, 2024-06, 2024-10
    
    section 2025 — Scale
    Multi-agent avancé        :active, 2025-01, 2025-06
    Autonomie partielle       :2025-04, 2025-09
    Fine-tuning propriétaire  :2025-06, 2025-12
    Voice interface           :2025-08, 2025-12
    
    section 2026 — Intelligence
    Multimodal natif          :2026-01, 2026-06
    Realtime AI <500ms        :2026-03, 2026-09
    Edge AI local             :2026-06, 2026-12
    
    section 2027 — Autonomie
    Agents autonomes          :2027-01, 2027-06
    Auto-improvement          :2027-04, 2027-09
    Cross-platform ubiquity   :2027-06, 2027-12
```

---

### 🎯 KPIs Architecture

| Pilier | Score | Preuve |
|--------|-------|--------|
| **Modularité** | ⭐⭐⭐⭐⭐ | 18 microservices découplés, chaque composant remplaçable |
| **Observabilité** | ⭐⭐⭐⭐⭐ | Tracing complet, coûts trackés, qualité mesurée en temps réel |
| **Sécurité** | ⭐⭐⭐⭐⭐ | 8 couches defense-in-depth, guardrails IA, audit immuable |
| **Scalabilité** | ⭐⭐⭐⭐⭐ | Horizontal scaling, serverless, 10K → 10M MAU |
| **Résilience** | ⭐⭐⭐⭐ | Circuit breakers, fallbacks multi-LLM, graceful degradation |
| **Optimisation** | ⭐⭐⭐⭐⭐ | Routing intelligent, caching 90%, batching -40% coûts |

---

> **"D'ici 2027, Hearst OS sera le système nerveux numérique de référence — orchestrant des milliers d'agents spécialisés, apprenant en continu, et multipliant la productivité humaine par 10."**

---

*Document généré le 2026-05-11 — Version 2.0*  
*Hearst OS Engineering Team*
