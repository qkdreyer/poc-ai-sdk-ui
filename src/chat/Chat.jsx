import { useState, useEffect, useRef, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai'

import { Message } from './Message'
import { WebSocketChatTransport, InitMessagesEvent, SubmitMessageEvent } from './WebSocketChatTransport'

const commands = [
  'Get my user info then show me info about node 1 using a sub agent',
  'Give me the name of RY12-K2-Y4 and RX31-Q0-P0 agents',
  'Give me the disk usage of the agent RY12-K2-Y4',
]

export const Chat = ({ id, url, token, body }) => {
  const transport = useMemo(() => new WebSocketChatTransport({ id, url, token }), [id, url, token])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputValueRef = useRef('')
  const inputElementRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const { messages, setMessages, status, error, stop, sendMessage, addToolResult, resumeStream } = useChat({
    transport,
    sendAutomaticallyWhen: ({ messages }) => {
      const sendAutomaticallyWhen = lastAssistantMessageIsCompleteWithToolCalls({ messages })
      // setup hack hiding previous parts within same user message
      if (sendAutomaticallyWhen) {
        messages.at(-1)._parts = messages.at(-1).parts
        messages.at(-1).parts = []
      }
      return sendAutomaticallyWhen
    },
    id,
    async onToolCall({ toolCall }) {
      console.log('🔧 toolCall', toolCall, toolCall.dynamic)
      if (toolCall.dynamic) {
        return
      }
    },
  })

  useEffect(() => {
    inputValueRef.current = input
  }, [input])

  useEffect(
    () => {
      transport.addEventListener(InitMessagesEvent.name, async ({ detail: { input, messages } }) => {
        setMessages(messages)
        if (input) {
          setInput(input)
          await sendMessage(null, { metadata: { sync: true } })
          setInput('')
        }
      })

      transport.addEventListener(SubmitMessageEvent.name, async ({ detail }) => {
        // TODO remove when sender is filtered (using generated clientId upon websocket connection)
        if (inputValueRef.current === '') {
          setInput(detail)
          await sendMessage({ text: detail }, { metadata: { read: true } })
          setInput('')
        }
      })

      return () => {
        transport.close()
      }
    },
    [transport]
  )

  // useEffect(() => {
  //   scrollToBottom()
  // }, [messages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim()) return
    await sendMessage({ text: input }, { body, metadata: { send: true } })
    setInput('')
  }

  return (
    <>
      <div style={{ overflowY: 'auto', marginBottom: 8, maxHeight: 'calc(100vh - 382px)' }}>
        {messages.map(message => <Message key={message.id} message={message} addToolResult={addToolResult} />)}
        {status === 'streaming' && <div><em>… génération en cours …</em></div>}
        <div ref={messagesEndRef} />
      </div>

      {error && <div style={{ color: 'red' }}>
        {String(error)}
      </div>}
      {error && console.error(error.stack)}

      <form onSubmit={handleSubmit}>
        <input
          ref={inputElementRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={status !== 'ready'}
          placeholder="Écris un message…"
          style={{ width: '80%', padding: 8 }}
          data-form-type="other"
        />
        <button type="submit" disabled={status !== 'ready'}>Envoyer</button>
        {status === 'streaming' && <button type="button" onClick={stop}>Stop</button>}
        {status === 'error' && <button type="button" onClick={resumeStream}>Reprendre</button>}
      </form>

      <div style={{ marginTop: 16, fontSize: '0.85em', color: '#666' }}>
        <strong>💡 Essayez ces commandes :</strong>
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          {commands.map((command, index) => <li key={index}><code onClick={({ target: { innerHTML } }) => setInput(innerHTML) || inputElementRef.current.focus()}>{command}</code></li>)}
        </ul>
      </div>
    </>
  )
}
