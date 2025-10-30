import { WebSocketServer } from 'ws'
import { createUIMessageStream, readUIMessageStream } from 'ai'
import mock from './mock.js'

const wss = new WebSocketServer({ port: 3001 })
wss.conversations = new Map()
wss.on('connection', (ws, { url }) => {
  const token = new URLSearchParams(url.substring(2)).get('token')
  if (!wss.conversations.has(token)) {
    wss.conversations.set(token, { clients: [], uiMessages: [] })
  }
  const conversation = wss.conversations.get(token)
  conversation.clients.push(ws)
  console.log(`Conversation ${token} (${conversation.clients.length} clients)`)

  if (conversation.uiMessages.length > 0) {
    ws.send(JSON.stringify({ trigger: 'init-messages', messages: conversation.uiMessages }))
  }

  ws.on('message', async message => {
    if (message.length === 0) {
      ws.send(JSON.stringify({ trigger: 'init-messages', messages: conversation.uiMessages }))
      return
    }

    const { messages, trigger, id } = JSON.parse(message)
    console.log(`Conversation ${token} message: ${JSON.stringify(messages.at(-1).parts.at(0))}`)

    conversation.uiMessages = messages
    conversation.clients.forEach(client => {
      if (client !== ws) {
        client.send(JSON.stringify({ message: messages.at(-1), trigger, id }))
      }
    })

    const [clientStream, uiMessageStream] = createUIMessageStream({ execute: ({ writer: { write } }) => mock(messages, write) }).tee()
    await Promise.all([
      (async () => {
        for await (const chunk of clientStream) {
          conversation.clients.forEach(client => {
            client.send(JSON.stringify({ ...chunk }))
          })
        }
      })(),
      (async () => {
        const { uiMessages } = conversation
        for await (const uiMessage of readUIMessageStream({ stream: uiMessageStream })) {
          if (uiMessages.at(-1).id !== uiMessage.id) {
            uiMessages.push(uiMessage)
          } else {
            uiMessages[uiMessages.length - 1] = uiMessage
          }
        }
      })()
    ])
  })

  ws.on('close', () => {
    conversation.clients = conversation.clients.filter(client => client !== ws)
  })
})

console.log(`🚀 Serveur WebSocket démarré sur ws://localhost:${wss.options.port}`)
