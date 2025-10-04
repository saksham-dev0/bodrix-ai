# AI Assistant for Spreadsheet

This feature adds AI-powered assistance to the spreadsheet application, allowing users to interact with their data using natural language with support for multiple LLM providers.

## Features

### 🤖 AI Chat Interface
- **Collapsible Sidebar**: Clean, Cursor-like interface that slides in from the right
- **Multiple Conversations**: Create and manage multiple chat sessions
- **Context-Aware**: AI understands your current sheet, selected range, and data
- **Real-time Responses**: Instant AI responses powered by multiple LLM providers
- **Agent Selection**: Choose from different AI models and providers

### 🔧 Multi-LLM Support
- **OpenAI**: GPT-4o, GPT-4o-mini, GPT-3.5-turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Opus
- **Google**: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini Pro
- **Mistral**: Mistral Large, Mistral Medium, Mistral Small
- **Custom Agents**: Create and configure your own AI agents

### 📊 Chart Generation
- **Natural Language Charts**: Ask AI to create charts and it will generate them inline
- **Smart Range Detection**: AI automatically detects appropriate data ranges
- **Multiple Chart Types**: Supports line, bar, area, and pie charts

### 🧠 Smart Context Building
- **Sheet Data Analysis**: AI can analyze your spreadsheet data
- **Formula Suggestions**: Get help with Excel/Google Sheets formulas
- **Data Insights**: Ask questions about trends, patterns, and summaries
- **Range-Aware**: AI knows what cells you have selected

## How to Use

1. **Open AI Assistant**: Click the "AI" button in the spreadsheet toolbar
2. **Select AI Model**: Choose from available AI models in the dropdown (GPT-4o, Claude, Gemini, etc.)
3. **Start Chatting**: Type your questions or requests in natural language
4. **Create Charts**: Ask "Create a line chart for the selected data" or "Show me a bar chart of sales data"
5. **Get Insights**: Ask "What trends do you see in this data?" or "Summarize the data in column B"
6. **Multiple Conversations**: Create new conversations for different topics using the "+" button
7. **Manage Agents**: Create custom AI agents with specific prompts and configurations

## Example Prompts

- "Create a line chart for the selected range"
- "What's the average value in column C?"
- "Generate a pie chart showing the distribution of sales by region"
- "Summarize the trends in this data"
- "Help me create a formula to calculate the total"
- "What insights can you provide about this dataset?"

## Technical Implementation

### Backend (Convex)
- **Database Schema**: Added `aiConversations`, `aiMessages`, `aiAgents`, and `aiThreads` tables
- **Multi-LLM Integration**: Support for OpenAI, Anthropic, Google, and Mistral via AI SDK
- **Convex Agents**: Agent-based architecture for scalable AI interactions
- **Real-time Updates**: Convex subscriptions for live chat updates
- **Chart Data**: Structured chart generation with metadata
- **Thread Management**: Persistent conversation threads for each agent

### Frontend (React)
- **AISidebar Component**: Modal-based chat interface with agent selection
- **AIAgentManager Component**: Create and manage custom AI agents
- **Context Extraction**: Automatic sheet data and selection context
- **Chart Rendering**: Inline chart display using ChartJS
- **State Management**: Conversation, message, and agent state management

### Environment Setup
- **API Keys**: Required for each LLM provider in Convex environment variables
- **Dependencies**: AI SDK, Convex Agents, and multiple LLM providers

## Configuration

Make sure you have set the required API keys for each LLM provider in your Convex deployment:

```bash
# OpenAI
npx convex env set OPENAI_API_KEY your_openai_api_key_here

# Anthropic
npx convex env set ANTHROPIC_API_KEY your_anthropic_api_key_here

# Google
npx convex env set GOOGLE_API_KEY your_google_api_key_here

# Mistral
npx convex env set MISTRAL_API_KEY your_mistral_api_key_here
```

## Security

- **User Authentication**: All AI features require user authentication
- **Data Privacy**: Only spreadsheet owners can access their AI conversations
- **API Key Security**: All API keys are stored securely in Convex environment variables
- **Context Isolation**: Each user's data context is isolated and private
- **Agent Isolation**: Each user can only access and modify their own AI agents
- **Thread Security**: Conversation threads are isolated per user and agent
