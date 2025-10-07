import { useState, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { Message } from "./Message";
import { mockTransport } from "./api/mockTransport";

const api = 'http://localhost:3001/api/conv'
const id = location.hash.replace('#', '') || 'default'
const interactiveToolTypes = ['askForConfirmation'].map(x => `tool-${x}`)
const serverToolTypes = ['getWeatherInformation'].map(x => `tool-${x}`)

const useMessages = () => {
  const [messages, setMessages] = useState();
  const [isStreaming, setStreaming] = useState(false);
  const [sync, setSync] = useState(Date.now());

  useEffect(
    () => {
      fetch(`${api}/${id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: window.name })
      }).then(async (res) => {
        const reader = res.body.getReader();
        while (true) {
          const { done, _ } = await reader.read();
          if (done) break;
          setSync(Date.now())
        }
      })
    },
    []
  )

  useEffect(() => {
    fetch(`${api}/${id}`)
      .then(res => res.json())
      .then(data => {
        const isStreaming = data.at(-1)?.parts.some(
          x => x.state === 'streaming' || (
            x.state === 'input-available' && !interactiveToolTypes.includes(x.type)
          )
        ) || false;
        setMessages(data)
        setStreaming(isStreaming);
        if (isStreaming) {
          setSync(Date.now())
        }
      })
      .catch(error => {
        console.error('Erreur lors du chargement des messages:', error);
        setMessages([]);
      });
  }, [id, sync]);

  return [messages, isStreaming];
}

const ChatWrapper = ({ initialMessages, isStreaming }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const { messages, setMessages, status, error, stop, sendMessage, addToolResult, resumeStream } = useChat({
    messages: initialMessages,
    transport: location.hash.startsWith('#mock') ? mockTransport : new DefaultChatTransport({
      api,
      body: { name: window.name },
    }),
    sendAutomaticallyWhen: ({ messages }) => lastAssistantMessageIsCompleteWithToolCalls({ messages }) && !serverToolTypes.includes(messages.at(-1).parts.at(-1).type),
    id,
    async onToolCall({ toolCall }) {
      console.log('🔧 Appel d\'outil détecté:', toolCall);
      if (toolCall.dynamic) {
        return;
      }

      if (toolCall.toolName === 'getLocation') {
        const cities = ['New York', 'Los Angeles', 'Chicago', 'San Francisco'];
        await new Promise(resolve => setTimeout(resolve, 2000));

        // No await - avoids potential deadlocks
        addToolResult({
          tool: 'getLocation',
          toolCallId: toolCall.toolCallId,
          output: cities[Math.floor(Math.random() * cities.length)],
        });
      }
    },
  });

  useEffect(
    () => {
      setMessages(initialMessages)
    },
    [setMessages, initialMessages]
  )

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    await sendMessage({ text: input });

    setInput("");
  };

  console.log({ status, isStreaming })

  return (
    <div style={{ border: "1px solid #ccc", padding: 16, maxWidth: 600 }}>
      <div style={{ overflowY: "auto", marginBottom: 8 }}>
        {messages.map(message => <Message key={message.id} message={message} />)}
        {(isStreaming || status==="streaming") && <div><em>… génération en cours …</em></div>}
        <div ref={messagesEndRef} />
      </div>

      {error && <div style={{ color:"red"}}>{String(error)}</div>}

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isStreaming || status!=="ready"}
          placeholder="Écris un message…"
          style={{ width:"80%", padding:8 }}
        />
        <button type="submit" disabled={isStreaming || status!=="ready"}>Envoyer</button>
        {status==="streaming" && <button type="button" onClick={stop}>Stop</button>}
        {status==="error" && <button type="button" onClick={resumeStream}>Reprendre</button>}
      </form>

      <div style={{ marginTop: 16, fontSize: '0.85em', color: '#666' }}>
        <strong>💡 Essayez ces commandes :</strong>
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li><code>météo à Paris</code> ([getWeatherInformation] Automatically executed server-side tool)</li>
          <li><code>confirmer l'action</code> ([askForConfirmation] User-interaction client-side)</li>
          <li><code>où suis-je ?</code> ([getLocation] Automatically executed client-side tool)</li>
        </ul>
      </div>
    </div>
  );
}

export function Chat() {
  const [initialMessages, isStreaming] = useMessages()
  return Array.isArray(initialMessages) && <ChatWrapper initialMessages={initialMessages} isStreaming={isStreaming} />
}
