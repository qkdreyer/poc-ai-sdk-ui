import { useState, useEffect, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai'

import { Message } from './Message'
import { WebSocketChatTransport, InitMessagesEvent, SubmitMessageEvent } from './api/WebSocketChatTransport'

const id = location.hash.replace('#', '') || 'default'
const serverToolTypes = ['getWeatherInformation'].map(x => `tool-${x}`)
const transport = new WebSocketChatTransport({ chatId: id })

export const Chat = () => {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const { messages, setMessages, status, error, stop, sendMessage, addToolResult, resumeStream } = useChat({
    transport: transport,
    sendAutomaticallyWhen: ({ messages }) => lastAssistantMessageIsCompleteWithToolCalls({ messages }) && !serverToolTypes.includes(messages.at(-1).parts.at(-1).type),
    id,
    async onToolCall({ toolCall }) {
      console.log('🔧 Appel d\'outil détecté:', toolCall)
      if (toolCall.dynamic) {
        return
      }

      if (toolCall.toolName === 'getLocation') {
        const cities = ['New York', 'Los Angeles', 'Chicago', 'San Francisco']
        await new Promise(resolve => setTimeout(resolve, 2000))

        // No await - avoids potential deadlocks
        addToolResult({
          tool: 'getLocation',
          toolCallId: toolCall.toolCallId,
          output: cities[Math.floor(Math.random() * cities.length)],
        })
      }
    },
  })

  useEffect(
    () => {
      transport.addEventListener(InitMessagesEvent.name, ({ detail }) => {
        setMessages(detail)
      })
    },
    [setMessages]
  )

  useEffect(
    () => {
      transport.addEventListener(SubmitMessageEvent.name, async ({ detail }) => {
        setInput(detail)
        await sendMessage({ text: detail })
        setInput('')
      })
    },
    [setMessages, sendMessage]
  )

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim()) return
    await sendMessage({ text: input }, { metadata: { send: true } })
    setInput('')
  }

  return (
    <div style={{ border: '1px solid #ccc', padding: 16, maxWidth: 600 }}>
      <div style={{ overflowY: 'auto', marginBottom: 8 }}>
        {messages.map(message => <Message key={message.id} message={message} />)}
        {status === 'streaming' && <div><em>… génération en cours …</em></div>}
        <div ref={messagesEndRef} />
      </div>

      {error && <div style={{ color:'red' }}>{String(error)}</div>}

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={status !== 'ready'}
          placeholder='Écris un message…'
          style={{ width:'80%', padding:8 }}
        />
        <button type='submit' disabled={status !== 'ready'}>Envoyer</button>
        {status === 'streaming' && <button type="button" onClick={stop}>Stop</button>}
        {status === 'error' && <button type="button" onClick={resumeStream}>Reprendre</button>}
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
  )
}
