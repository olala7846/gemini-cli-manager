# GeminiClaw Architecture

This document describes the high-level architecture of GeminiClaw, inheriting the resilient and modular traits from the Nanobot and OpenClaw projects, adapted for the Gemini CLI core.

## Key Components Diagram

```mermaid
graph TD
    %% External Interfaces (Channels)
    subgraph Channels["Channels (Input / Output)"]
        TG["Telegram / Chat Apps"]
        API["REST API / Webhooks"]
        CLI["Local CLI"]
    end

    %% Routing Layer
    Gateway{"Gateway Router"}

    %% Automated Triggers
    subgraph Automation["Task Automation (P1)"]
        Cron["Cron Jobs (e.g., Nightly worker)"]
        TasksDB[("DAG Task DB")]
    end

    %% Core System
    subgraph CoreSystem["GeminiClaw Core"]
        SessionStore[("Session Management\n(Context & State)")]
        MemStore[("Memory Management\n(Observations & History)")]
        
        %% Agent Personas
        subgraph Agents["Multi-Agent Personas"]
            AgentA["Agent: Primary Assistant"]
            AgentB["Agent: Specialized Worker"]
        end
        
        %% Core Engine Interface
        GeminiEngine[("Gemini CLI Core\n(LLM & Tools)")]
    end

    %% Flow logic
    TG --> Gateway
    API --> Gateway
    CLI --> Gateway
    Cron -->|Triggers Tasks| Gateway
    
    Cron -->|Maintains| MemStore
    Cron -->|Process| TasksDB

    Gateway -->|Routes Messages| Agents
    
    Agents <--> SessionStore
    Agents <--> MemStore
    
    Agents -->|Executes prompt + context| GeminiEngine
```

## Tech Stack Choices

The overall architecture requires finalizing toolsets and frameworks for several core components. Below is the list of pending decisions:

### 1. Gateway & Routing
*Responsible for receiving external events and routing them to the correct agent.*
- **API Framework:** `express` (To start with)
- **Event Bus:** In-memory event emitter (To start with)

### 2. Session & Memory Storage
*Responsible for storing chat history, agent state, and long-term observations.*
- **Session DB:** Simple JSON files.
- **Memory Retrieval:** Progressive disclosure using markdown files. Maintained automatically with a cron job to keep it clean via progressive summarization. (No vector DB needed yet)

### 3. Task Automation & Cron
*Responsible for background jobs, memory compaction, and scheduled triggers.*
- **Task Queue & Scheduler:** `BullMQ` (Serves as both the queuing system and the cron-like job scheduler)

### 4. Core Engine Integration
*Responsible for LLM generation and tool use.*
- **SDK Wrapping:** We are using Google's `@google/gemini-cli-sdk`.
- **Model Choice:** Flexible; starting with **Gemini 2.5 Flash** (Leveraging existing Gemini subscription for tokens).

### 5. Channels
*Responsible for ingesting external prompts and delivering agent responses.*
- **Telegram Bot API library:** `grammY` (Consistent with the OpenClaw architecture)

*(Each of these components will be expanded upon during the detailed design phase)*
