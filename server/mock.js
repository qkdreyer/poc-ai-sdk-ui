import { generateId } from 'ai';

const mockResponses = [
  "Bonjour ! Comment puis-je vous aider aujourd'hui ?",
  "Hmm... Très bien je vois. Pouvez-vous me donner plus de détails ?",
  "Ok? Je vous écoute.",
  "D'accord. Et ensuite ? Avez-vous d'autres questions ?",
];

// Mock tools configuration
const mockTools = {
  getWeatherInformation: {
    description: 'show the weather in a given city to the user',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string' }
      },
      required: ['city']
    }
  },
  askForConfirmation: {
    description: 'Ask the user for confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The message to ask for confirmation.' }
      },
      required: ['message']
    }
  },
  getLocation: {
    description: 'Get the user location to provide location-based services.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
};

// Helper functions for mock tool executions
function generateChunkId() {
  return generateId();
}

function mockWeatherResponse(city) {
  const weatherOptions = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'];
  return weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
}

function mockLocationResponse() {
  const cities = ['New York', 'Los Angeles', 'Chicago', 'San Francisco', 'Paris', 'London', 'Tokyo'];
  return cities[Math.floor(Math.random() * cities.length)];
}

// Check if user message should trigger a tool call
function shouldTriggerToolCall(userMessage) {
  const weatherKeywords = ['météo', 'weather', 'temps', 'température'];
  const confirmationKeywords = ['confirmer', 'confirmation', 'êtes-vous sûr', 'voulez-vous'];
  const locationKeywords = ['où', 'position', 'location', 'localisation'];

  const message = userMessage.toLowerCase();

  if (weatherKeywords.some(keyword => message.includes(keyword))) {
    return 'weather';
  }
  if (confirmationKeywords.some(keyword => message.includes(keyword))) {
    return 'confirmation';
  }
  if (locationKeywords.some(keyword => message.includes(keyword))) {
    return 'location';
  }
  return null;
}

let responseIndex = 0;

export default async (messages, write) => {
  const lastMessage = messages[messages.length - 1];
  const userMessage = lastMessage?.parts?.find(part => part.type === 'text')?.text || '';

  let textId = generateChunkId();
  const toolCallId = generateChunkId();

  try {
    write({ type: 'start', messageId: generateId() });
    if (messages.length === 1) {
      write({ type: 'data-custom', data: { foo: Date.now() } });
    }
    write({ type: 'start-step' });

    // Check if we should trigger a tool call
    const toolType = shouldTriggerToolCall(userMessage);

    if (toolType) {
      // Simulate tool call based on detected intent
      let toolName, toolInput;

      switch (toolType) {
        case 'weather':
          toolName = 'getWeatherInformation';
          // Extract city from user message or use default
          const cityMatch = userMessage.match(/(?:à|pour|de|dans)\s+([A-Za-zÀ-ÿ\s]+)/i);
          toolInput = { city: cityMatch ? cityMatch[1].trim() : 'Paris' };
          break;
        case 'confirmation':
          toolName = 'askForConfirmation';
          toolInput = { message: 'Voulez-vous vraiment continuer ?' };
          break;
        case 'location':
          toolName = 'getLocation';
          toolInput = {};
          break;
      }

      // Generate tool call using streaming events
      write({
        type: 'tool-input-available',
        toolCallId: toolCallId,
        toolName: toolName,
        input: toolInput
      });

      // For server-side tools (getWeatherInformation), execute immediately
      if (toolName === 'getWeatherInformation') {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing delay

        const result = mockWeatherResponse(toolInput.city);
        write({
          type: 'tool-output-available',
          toolCallId: toolCallId,
          output: result
        });
      }
      // For client-side tools, they will be handled on the client
      else if (toolName === 'getLocation') {
        // The client will handle this automatically - just send the input
      }
      else if (toolName === 'askForConfirmation') {
        // The client will display the confirmation dialog - just send the input
      }
    } else {
      // Normal text response
      const mockResponse = mockResponses[responseIndex % mockResponses.length];
      responseIndex++;

      write({ type: 'text-start', id: textId });

      for (let i = 0; i < mockResponse.length; i++) {
        write({ type: 'text-delta', id: textId, delta: mockResponse[i] });
        await new Promise(resolve => setTimeout(resolve, 30));
      }

      write({ type: 'text-end', id: textId });
    }    // Fin du streaming
    write({ type: 'finish-step' });

    await new Promise(resolve => setTimeout(resolve, 1000));
    await write({ type: 'finish' });
  } catch (error) {
    console.error('❌ Erreur:', error);
    write({ type: 'error', errorText: error.message });
  }
}
