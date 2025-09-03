import React, { useState, useEffect, useRef, FormEvent, FC, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Content } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const DEFAULT_MODEL_NAME = 'gemini-2.5-flash';
const STRATEGIST_SYSTEM_INSTRUCTION = "You are a master strategist AI. Your task is to analyze the user's query and create a detailed, step-by-step plan for how a team of AI agents should approach answering it. Identify key areas to research, potential ambiguities to clarify, and the best structure for the final response. This plan will guide the other agents.";
const INITIAL_SYSTEM_INSTRUCTION = "You are an expert-level AI assistant. Your task is to provide a comprehensive, accurate, and well-reasoned initial response to the user's query, strictly following the provided execution plan. Aim for clarity and depth. Note: Your response is an intermediate step for other AI agents and will not be shown to the user. Be concise and focus on core information without unnecessary verbosity.";
const REFINEMENT_SYSTEM_INSTRUCTION = "You are a reflective AI agent. Your primary task is to find flaws. Critically analyze your previous response and the responses from other AI agents, considering the original execution plan. Focus specifically on identifying factual inaccuracies, logical fallacies, omissions, or any other weaknesses. Your goal is to generate a new, revised response that corrects these specific errors and is free from the flaws you have identified. Note: This refined response is for a final synthesizer agent, not the user, so be direct and prioritize accuracy over conversational style.";
const SYNTHESIZER_SYSTEM_INSTRUCTION = "You are a master synthesizer AI. Your PRIMARY GOAL is to write the final, complete response to the user's query. You will be given the user's query, an execution plan, and four refined responses from other AI agents. Your task is to analyze these responses—identifying their strengths to incorporate and their flaws to discard—while ensuring the final output aligns with the initial plan. Use this analysis to construct the single best possible answer for the user. Do not just critique the other agents; your output should BE the final, polished response.";

type ApiProvider = 'google' | 'groq' | 'openrouter';

interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
}

// --- UI Components ---

const DownloadButton: FC<{ content: string }> = ({ content }) => {
  const [status, setStatus] = useState<'idle' | 'downloading' | 'downloaded'>('idle');

  const handleDownload = () => {
    setStatus('downloading');
    try {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'smadr-response.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('downloaded');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to download file:', error);
      setStatus('idle');
    }
  };

  return (
    <button onClick={handleDownload} className="utility-button download-button" aria-label="Download answer" disabled={status !== 'idle'}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        {status === 'downloaded' ? (
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
        ) : (
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        )}
      </svg>
      {status === 'idle' && 'Download'}
      {status === 'downloading' && 'Downloading...'}
      {status === 'downloaded' && 'Done!'}
    </button>
  );
};

const CodeBlock: FC<{ children?: ReactNode }> = ({ children }) => {
  const [copied, setCopied] = useState(false);
  const textToCopy = String(children).replace(/\n$/, '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="code-block-wrapper">
      <pre><code>{children}</code></pre>
      <button onClick={handleCopy} className="utility-button copy-button" aria-label="Copy code">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
          {copied ? (
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          ) : (
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-5zm0 16H8V7h11v14z"/>
          )}
        </svg>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
};

const LoadingIndicator: FC<{ status: string; time: number }> = ({ status, time }) => {
  const getLoadingClass = () => {
    if (status.startsWith('Strategizing')) return 'strategizing';
    if (status.startsWith('Initializing')) return 'initial';
    if (status.startsWith('Refining')) return 'refining';
    return 'synthesizing';
  };
  
  const barCount = status.startsWith('Strategizing') || status.startsWith('Synthesizing') ? 1 : 4;
  
  return (
    <div className="loading-animation">
      <div className="loading-header">
        <span className="loading-status">{status}</span>
        <span className="timer-display">{(time / 1000).toFixed(1)}s</span>
      </div>
      <div className={`progress-bars-container ${getLoadingClass()}`}>
        {[...Array(barCount)].map((_, i) => (
           <div key={i} className="progress-bar" style={{ animationDelay: `${i * 0.2}s` }}></div>
        ))}
      </div>
    </div>
  );
};

const SettingsModal: FC<{
    isOpen: boolean;
    onClose: () => void;
    settings: any;
    onSave: (newSettings: any) => void;
}> = ({ isOpen, onClose, settings, onSave }) => {
    const [localSettings, setLocalSettings] = useState(settings);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(localSettings);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>API & Model Configuration</h2>
                
                <div className="form-group">
                    <label htmlFor="apiProvider">API Provider</label>
                    <select id="apiProvider" value={localSettings.provider} onChange={e => setLocalSettings({...localSettings, provider: e.target.value})}>
                        <option value="google">Google</option>
                        <option value="groq">Groq</option>
                        <option value="openrouter">OpenRouter</option>
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="modelName">Model Name</label>
                    <input type="text" id="modelName" value={localSettings.model} onChange={e => setLocalSettings({...localSettings, model: e.target.value})} placeholder="e.g., gemini-2.5-flash" />
                </div>
                
                <div className="form-group">
                    <label htmlFor="googleKey">Google API Key</label>
                    <input type="password" id="googleKey" value={localSettings.keys.google} onChange={e => setLocalSettings({...localSettings, keys: {...localSettings.keys, google: e.target.value}})} placeholder="Begins with 'AIza...'" />
                </div>

                <div className="form-group">
                    <label htmlFor="groqKey">Groq API Key</label>
                    <input type="password" id="groqKey" value={localSettings.keys.groq} onChange={e => setLocalSettings({...localSettings, keys: {...localSettings.keys, groq: e.target.value}})} placeholder="Begins with 'gsk_...'" />
                </div>

                 <div className="form-group">
                    <label htmlFor="openrouterKey">OpenRouter API Key</label>
                    <input type="password" id="openrouterKey" value={localSettings.keys.openrouter} onChange={e => setLocalSettings({...localSettings, keys: {...localSettings.keys, openrouter: e.target.value}})} placeholder="Begins with 'sk-or-...'"/>
                </div>
                
                <div className="modal-actions">
                    <button onClick={onClose} className="utility-button secondary">Cancel</button>
                    <button onClick={handleSave} className="utility-button primary">Save</button>
                </div>
            </div>
        </div>
    );
};


// --- Main App Component ---

const App: FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [timer, setTimer] = useState<number>(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [apiSettings, setApiSettings] = useState(() => {
    const savedSettings = localStorage.getItem('smadrApiSettings');
    const defaults = {
        provider: 'google' as ApiProvider,
        model: DEFAULT_MODEL_NAME,
        keys: {
            google: process.env.GOOGLE_API_KEY || '',
            groq: process.env.GROQ_API_KEY || '',
            openrouter: process.env.OPENROUTER_API_KEY || ''
        }
    };
    return savedSettings ? { ...defaults, ...JSON.parse(savedSettings) } : defaults;
  });

  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, isLoading]);
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      interval = setInterval(() => {
        setTimer(prevTime => prevTime + 100);
      }, 100);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);
  
  const handleSaveSettings = (newSettings: any) => {
    setApiSettings(newSettings);
    localStorage.setItem('smadrApiSettings', JSON.stringify(newSettings));
  };
  
  const callGenerativeAI = async (
    contents: Content[],
    systemInstruction: string,
  ): Promise<string> => {
    const { provider, model, keys } = apiSettings;

    if (provider === 'google') {
        const apiKey = keys.google;
        if (!apiKey) throw new Error("Google API key is missing.");
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: model || DEFAULT_MODEL_NAME,
            contents: contents,
            config: { systemInstruction },
        });
        return response.text;

    } else { // OpenAI-compatible APIs (Groq, OpenRouter)
        let apiUrl: string, apiKey: string;
        
        if (provider === 'groq') {
            apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
            apiKey = keys.groq;
        } else { // openrouter
            apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
            apiKey = keys.openrouter;
        }
        
        if (!apiKey) throw new Error(`${provider} API key is missing.`);

        const messagesForApi = [];
        if (systemInstruction) {
            messagesForApi.push({ role: 'system', content: systemInstruction });
        }
        contents.forEach(content => {
           messagesForApi.push({ role: content.role, content: content.parts.map(p => p.text).join('\n') });
        });
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                ...(provider === 'openrouter' && {
                    'HTTP-Referer': 'https://github.com/your-repo/smadr', // Replace with your actual repo/site
                    'X-Title': '(SMADR) Strategic Multi-Agent Deep Research',
                })
            },
            body: JSON.stringify({
                model: model,
                messages: messagesForApi,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error from ${provider}: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }
  };


  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const userInput = formData.get('userInput') as string;
    event.currentTarget.reset();
    if (!userInput.trim()) return;

    const userMessage: Message = { role: 'user', parts: [{ text: userInput }] };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setIsLoading(true);

    try {
      const mainChatHistory: Content[] = currentMessages.slice(0, -1).map(msg => ({
        role: msg.role,
        parts: msg.parts,
      }));
      const currentUserTurn: Content = { role: 'user', parts: [{ text: userInput }] };

      // STEP 0: Strategize
      setLoadingStatus('Strategizing: Formulating optimal approach...');
      const plan = await callGenerativeAI([...mainChatHistory, currentUserTurn], STRATEGIST_SYSTEM_INSTRUCTION);
      
      const userQueryWithPlan = `User Query: "${userInput}"\n\nExecution Plan:\n${plan}`;
      const plannedUserTurn: Content = { role: 'user', parts: [{ text: userQueryWithPlan }] };

      // STEP 1: Initial Responses (Sequential)
      const initialAnswers: string[] = [];
      for (let i = 0; i < 4; i++) {
        setLoadingStatus(`Initializing agent ${i + 1}/4: Generating analysis...`);
        const response = await callGenerativeAI([...mainChatHistory, plannedUserTurn], INITIAL_SYSTEM_INSTRUCTION);
        initialAnswers.push(response);
      }
      
      // STEP 2: Refined Responses (Sequential)
      const refinedAnswers: string[] = [];
      for (let i = 0; i < 4; i++) {
        setLoadingStatus(`Refining answer ${i + 1}/4: Critiquing and improving...`);
        const initialAnswer = initialAnswers[i];
        const otherAnswers = initialAnswers.filter((_, j) => j !== i);
        const refinementContext = `My initial response was: "${initialAnswer}". The other agents responded with: 1. "${otherAnswers[0]}" 2. "${otherAnswers[1]}" 3. "${otherAnswers[2]}". Based on this context, critically re-evaluate and provide a new, improved response.`;
        
        const refinementTurn: Content = { role: 'user', parts: [{ text: `${userQueryWithPlan}\n\n---INTERNAL CONTEXT---\n${refinementContext}` }] };
        const response = await callGenerativeAI([...mainChatHistory, refinementTurn], REFINEMENT_SYSTEM_INSTRUCTION);
        refinedAnswers.push(response);
      }

      // STEP 3: Final Synthesis
      setLoadingStatus('Synthesizing: Compiling final response...');
      const synthesizerContext = `Here are the four refined responses to the user's query. Your task is to synthesize them into the best single, final answer.\n\nRefined Response 1:\n"${refinedAnswers[0]}"\n\nRefined Response 2:\n"${refinedAnswers[1]}"\n\nRefined Response 3:\n"${refinedAnswers[2]}"\n\nRefined Response 4:\n"${refinedAnswers[3]}"`;
      const synthesizerTurn: Content = { role: 'user', parts: [{ text: `${userQueryWithPlan}\n\n---INTERNAL CONTEXT---\n${synthesizerContext}` }] };

      const finalResponseText = await callGenerativeAI([...mainChatHistory, synthesizerTurn], SYNTHESIZER_SYSTEM_INSTRUCTION);
      
      setIsLoading(false);

      const finalMessage: Message = { role: 'model', parts: [{ text: finalResponseText }] };
      setMessages(prev => [...prev, finalMessage]);

    } catch (error) {
      console.error('Error sending message to agents:', error);
      setIsLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Sorry, I encountered an error. Please check your API keys and try again.';
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: errorMessage }] }]);
    }
  };

  return (
    <div className="chat-container">
      <header>
        <h1>(SMADR)</h1>
        <button className="settings-button" onClick={() => setIsSettingsOpen(true)} aria-label="Settings">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
            </svg>
        </button>
        <div className="header-glow"></div>
      </header>
      <div className="message-list" ref={messageListRef}>
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
             <div className="message-header">
                {msg.role === 'model' && <span className="agent-label">Synthesizer Agent</span>}
                {msg.role === 'model' && index === messages.length - 1 && !isLoading && (
                  <DownloadButton content={msg.parts[0].text} />
                )}
             </div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code(props) {
                  const {children, ...rest} = props
                  return <CodeBlock>{String(children)}</CodeBlock>
                }
              }}
            >
              {msg.parts[0].text}
            </ReactMarkdown>
          </div>
        ))}
        {isLoading && <LoadingIndicator status={loadingStatus} time={timer} />}
      </div>
      <form className="input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          name="userInput"
          placeholder="Ask the agents..."
          aria-label="User input"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading} aria-label="Send message">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
        </button>
      </form>
       <SettingsModal 
         isOpen={isSettingsOpen} 
         onClose={() => setIsSettingsOpen(false)} 
         settings={apiSettings}
         onSave={handleSaveSettings}
       />
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);