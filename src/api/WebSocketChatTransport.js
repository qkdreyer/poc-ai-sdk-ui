export class InitMessagesEvent extends CustomEvent {
  constructor (detail) {
    super(InitMessagesEvent.name, { detail })
  }
}

export class SubmitMessageEvent extends CustomEvent {
  constructor (detail) {
    super(SubmitMessageEvent.name, { detail })
  }
}

/**
 * WebSocket-based ChatTransport implementation
 *
 * This transport uses WebSocket for bidirectional real-time communication
 * instead of HTTP POST requests. It maintains a persistent connection to the server.
 */
export class WebSocketChatTransport extends EventTarget {
  constructor({ url = `ws://localhost:3001?token=${location.hash.replace('#', '')}`, reconnectDelay = 1000 } = {}) {
    super()
    this.url = url
    this.reconnectDelay = reconnectDelay
    this.ws = null
    this.messageQueue = []
    this.streamController = null
    this.ensureConnection()
  }
  /**
   * Ensure WebSocket connection is established
   */
  async ensureConnection() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return
    }
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url)
      this.ws.onopen = () => {
        console.log('🔌 WebSocket connected')
        // Send queued messages
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift()
          this.ws.send(JSON.stringify(message))
        }
        resolve()
      }
      this.ws.onerror = (error) => {
        console.error('🔴 WebSocket error:', error)
        reject(error)
      }
      this.ws.onclose = () => {
        console.log('🔌 WebSocket closed')
        // Attempt reconnection after delay
        setTimeout(() => {
          if (this.streamController) {
            this.ensureConnection().catch(console.error)
          }
        }, this.reconnectDelay)
      }
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const { trigger } = data
          if (trigger === 'init-messages') {
            this.dispatchEvent(new InitMessagesEvent(data.messages))
            return
          }
          if (trigger === 'submit-message' && data.message.parts.at(0).type === 'text') {
            this.dispatchEvent(new SubmitMessageEvent(data.message.parts.at(0).text))
            return
          }
          this.handleMessage(data)
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }
    })
  }
  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    const { type, error } = data
    if (!this.streamController) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(Uint8Array.of())
      }
      return
    }
    this.streamController.enqueue(data)

    // Close the stream
    if (type === 'finish')
      this.streamController.close()

    // Error occurred
    if (type === 'error')
      this.streamController.error(new Error(error || 'Stream error'))

    if (type === 'finish' || type === 'error')
      delete this.streamController
  }
  /**
   * Send messages via WebSocket and return a ReadableStream of UIMessageChunk
   *
   * Required by ChatTransport interface
   */
  async sendMessages({ chatId, messages, trigger, abortSignal, metadata: { send } = {} }) {
    await this.ensureConnection()
    return new ReadableStream({
      start: (controller) => {
        // Store the stream controller
        this.streamController = controller

        if (!send) {
          return
        }

        // Prepare the message to send
        const message = {
          messages,
          trigger,
          id: chatId,
        }

        // Send via WebSocket
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(message))
        } else {
          // Queue the message if connection is not ready
          this.messageQueue.push(message)
        }
        // Handle abort signal
        if (abortSignal) {
          abortSignal.addEventListener('abort', () => {
            // Send abort message to server
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({
                type: 'abort',
                chatId
              }))
            }
            controller.error(new DOMException('Aborted', 'AbortError'))
            delete this.streamController
          })
        }
      },
      cancel: () => {
        // Clean up when stream is cancelled
        delete this.streamController
      }
    })
  }
  /**
   * Reconnect to an existing stream
   *
   * Required by ChatTransport interface
   */
  async reconnectToStream() {
    throw new Error('Not implemented')
  }
  /**
   * Close the WebSocket connection
   */
  close() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.streamController = null
    this.messageQueue = []
  }
}
