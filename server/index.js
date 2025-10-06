import { deepEqual } from 'node:assert'
import express from 'express';
import cors from 'cors';
import { pipeUIMessageStreamToResponse, createUIMessageStream, readUIMessageStream } from 'ai';
import mock from './mock.js';

const app = express();
const conversations = {}
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/conv', async (req, res) => {
  const { id } = req.query;
  if (!conversations[id]) {
    conversations[id] = { messages: [], sockets: {} }
  }
  res.json(conversations[id].messages);
})

app.post('/api/conv/sync', async (req, res) => {
  const { id, name } = req.body;
  if (!conversations[id]) {
    conversations[id] = { messages: [], sockets: {} }
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.flushHeaders();

  conversations[id].sockets[name] = res
  res.on('error', () => {
    delete conversations[id].sockets[name]
  })
  res.on('end', () => {
    delete conversations[id].sockets[name]
  })
})

app.post('/api/conv/chat', async (req, res) => {
  const { id } = req.body;
  // deepEqual(conversations[req.body.id].messages, req.body.messages.slice(0, -1))
  conversations[id].messages = req.body.messages || []

  for (const [name, socket] of Object.entries(conversations[id].sockets)) {
    if (name !== req.body.name) {
      socket.write('data: ping\n\n')
    }
  }

  pipeUIMessageStreamToResponse({
    response: res,
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        await mock(req, writer.write)
        if (false) {
          // node_modules/ai/dist/index.mjs:3788 add "state.message.parts = [];"
          res.write('data: [DONE]\n\n')
          await mock(req, writer.write)
        }
      },
      // onFinish: ({ messages, isContinuation, responseMessage }) => {
      //   console.log('Stream finished with messages:', messages, isContinuation, responseMessage);
      // },
    }),
    consumeSseStream: async (options) => {
      options.stream = options.stream.pipeThrough(
        new TransformStream({
          async transform(chunk, controller) {
            const data = chunk.replace('data:', '').trim()
            if (data !== '[DONE]') {
              controller.enqueue(JSON.parse(data));
            }
          }
        })
      )
      const { messages } = conversations[id]
      for await (const uiMessage of readUIMessageStream(options)) {
        if (messages.at(-1).id !== uiMessage.id) {
          messages.push(uiMessage)
        } else {
          messages[messages.length - 1] = uiMessage
        }
      }
    },
  })
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📡 API disponible sur http://localhost:${PORT}/api/chat`);
});
