# (SMADR) Strategic Multi-Agent Deep Research

SMADR is a sophisticated, web-based multi-agent AI system designed for in-depth research and analysis. It orchestrates a team of specialized AI agents in a sequential workflow to break down complex queries, gather information, critique and refine findings, and synthesize a comprehensive final answer.

This application is built to be flexible, allowing users to connect to various powerful AI models through different API providers like Google, Groq, and OpenRouter.

## Features

- **Sequential Agentic Workflow:** A structured four-step process (Strategize, Initialize, Refine, Synthesize) ensures well-planned and high-quality responses.
- **Swappable AI Providers:** Easily configure the application to use different backend models from Google, Groq, or OpenRouter via a simple settings panel.
- **Modern, Responsive UI:** A sleek, dark-themed interface provides a premium user experience, with clear status indicators for the agent process.
- **Downloadable Responses:** Save the final synthesized answer as a Markdown file for easy use in reports, documents, or further analysis.
- **Persistent Configuration:** Your API settings are saved locally, so you don't have to re-enter them every time.

## How It Works: The Agentic Flow

The system processes each query through a pipeline of specialized agents.

```mermaid
graph TD
    A[Start: User Submits Query] --> B{1. Strategist Agent};
    B -- Creates --> C[Execution Plan];
    C --> D{2. Initializer Agents (x4)};
    D -- Uses Plan to Generate --> E[4x Initial Responses];
    E --> F{3. Refiner Agents (x4)};
    F -- Each agent critiques its own<br/>initial response against the others --> G[4x Refined Responses];
    G --> H{4. Synthesizer Agent};
    H -- Analyzes and combines all<br/>refined responses --> I[Final Answer];
    I --> J[End: Display to User];
    J -- Provides --> K[Download Button];

    subgraph "Step 1: Planning"
        B
    end

    subgraph "Step 2: Initial Generation (Sequential)"
        D
    end

    subgraph "Step 3: Critical Refinement (Sequential)"
        F
    end

    subgraph "Step 4: Final Synthesis"
        H
    end

    subgraph "Final Output"
        J
    end
```

## Setup and Installation

### 1. Environment Variables

To use the application, you need to provide API keys for the AI services you want to use.

1.  Create a file named `.env` in the root directory of the project.
2.  Copy the contents of `.env.example` into your new `.env` file.
3.  Add your API keys to the `.env` file.

**File: `.env`**
```
# Get your Google AI API Key from Google AI Studio
GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"

# Get your Groq API Key from https://console.groq.com/keys
GROQ_API_KEY="YOUR_GROQ_API_KEY"

# Get your OpenRouter Key from https://openrouter.ai/keys
OPENROUTER_API_KEY="YOUR_OPENROUTER_API_KEY"
```

*Note: You only need to provide a key for the service(s) you intend to use.*

### 2. Running the Application

This project is designed to run in a web-based development environment that can load HTML, CSS, and TypeScript files and manage environment variables. Simply load the project files and open the `index.html` file in your browser.

## How to Use

1.  **Configure API (First Use):**
    *   Click the **gear icon** (⚙️) in the top-right corner to open the settings panel.
    *   Select your desired **API Provider** (e.g., Google, Groq).
    *   Enter the specific **Model Name** you wish to use (e.g., `gemini-2.5-flash`, `llama3-8b-8192`).
    *   If you didn't set up the `.env` file, you can enter your API keys directly into the password fields.
    *   Click **Save**. Your settings will be remembered for future sessions.

2.  **Ask a Query:**
    *   Type your complex question or research topic into the input box at the bottom.
    *   Press Enter or click the send button.

3.  **Monitor the Process:**
    *   Watch the loading indicator as it provides real-time status updates on which agent is currently working (Strategizing, Initializing, Refining, Synthesizing).

4.  **Get the Answer:**
    *   The final, synthesized response will appear in the chat window.
    *   Click the **Download** button to save the response as a Markdown file.

## License

This project is licensed under the MIT License.
