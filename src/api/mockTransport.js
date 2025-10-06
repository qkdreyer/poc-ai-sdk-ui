// Simulation de réponses IA mock
const mockResponses = [
  "Bonjour ! Comment puis-je vous aider aujourd'hui ?",
  "C'est une excellente question ! Laissez-moi y réfléchir...",
  "Voici ce que je pense de votre demande : il s'agit d'un sujet intéressant qui mérite une analyse approfondie.",
  "D'accord, je vois ce que vous voulez dire. Permettez-moi de vous donner plus de détails.",
  "Merci pour cette conversation enrichissante ! Y a-t-il autre chose que je puisse faire pour vous ?",
];

// Définition des tools mock disponibles
const mockTools = {
  get_weather: {
    description: "Obtient la météo pour une ville donnée",
    parameters: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "Le nom de la ville"
        },
        country: {
          type: "string",
          description: "Le code pays (optionnel)"
        }
      },
      required: ["city"]
    },
    execute: async ({ city, country }) => {
      const temperatures = [18, 22, 25, 20, 15, 28, 12];
      const conditions = ["ensoleillé", "nuageux", "pluvieux", "partiellement nuageux"];
      const temp = temperatures[Math.floor(Math.random() * temperatures.length)];
      const condition = conditions[Math.floor(Math.random() * conditions.length)];
      const location = country ? `${city}, ${country}` : city;

      return {
        location,
        temperature: temp,
        condition,
        humidity: Math.floor(Math.random() * 40) + 40,
        windSpeed: Math.floor(Math.random() * 20) + 5
      };
    }
  },

  calculate: {
    description: "Effectue des calculs mathématiques",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "L'expression mathématique à calculer (ex: '2 + 3 * 4')"
        }
      },
      required: ["expression"]
    },
    execute: async ({ expression }) => {
      try {
        // Simple évaluateur sécurisé pour les expressions basiques
        const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, '');
        const result = Function(`"use strict"; return (${sanitized})`)();
        return {
          expression: sanitized,
          result: result,
          isValid: true
        };
      } catch (error) {
        return {
          expression,
          result: null,
          error: "Expression invalide",
          isValid: false
        };
      }
    }
  },

  search_web: {
    description: "Effectue une recherche web simulée",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "La requête de recherche"
        },
        limit: {
          type: "number",
          description: "Nombre maximum de résultats (défaut: 5)"
        }
      },
      required: ["query"]
    },
    execute: async ({ query, limit = 5 }) => {
      const mockResults = [
        { title: `Résultat 1 pour "${query}"`, url: "https://example1.com", snippet: "Description du premier résultat..." },
        { title: `Guide complet: ${query}`, url: "https://example2.com", snippet: "Un guide détaillé sur le sujet..." },
        { title: `${query} - Wikipédia`, url: "https://wikipedia.org", snippet: "Article encyclopédique..." },
        { title: `Actualités sur ${query}`, url: "https://news.example.com", snippet: "Dernières nouvelles..." },
        { title: `Forum de discussion: ${query}`, url: "https://forum.example.com", snippet: "Discussions de la communauté..." }
      ];

      return {
        query,
        results: mockResults.slice(0, Math.min(limit, mockResults.length)),
        totalFound: mockResults.length
      };
    }
  },

  get_time: {
    description: "Obtient l'heure et la date actuelles",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "Fuseau horaire (optionnel, défaut: local)"
        }
      }
    },
    execute: async ({ timezone = "local" }) => {
      const now = new Date();
      return {
        timestamp: now.toISOString(),
        date: now.toLocaleDateString('fr-FR'),
        time: now.toLocaleTimeString('fr-FR'),
        timezone: timezone,
        weekday: now.toLocaleDateString('fr-FR', { weekday: 'long' })
      };
    }
  }
};

// Mots-clés qui déclenchent l'utilisation de tools
const toolTriggers = {
  weather: ['météo', 'temps', 'température', 'weather'],
  calculate: ['calcul', 'calculer', 'math', 'mathématique', 'addition', 'multiplication', 'division', 'soustraction'],
  search: ['recherche', 'chercher', 'search', 'trouve', 'trouver'],
  time: ['heure', 'date', 'temps', 'maintenant', 'aujourd\'hui']
};

let responseIndex = 0;

// Fonction utilitaire pour créer des chunks de streaming
function createTextChunk(id, type, data = {}) {
  return {
    type,
    id,
    ...data,
  };
}

// Générateur d'IDs simples
let chunkIdCounter = 0;
function generateChunkId() {
  return `chunk-${++chunkIdCounter}`;
}

// Détecte quel tool utiliser en fonction du message
function detectToolToUse(message) {
  const text = message.toLowerCase();

  for (const [toolType, keywords] of Object.entries(toolTriggers)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      switch (toolType) {
        case 'weather':
          const cityMatch = text.match(/(?:météo|temps|température).*?(?:à|de|pour|sur)\s+([a-záàâäéèêëíìîïóòôöúùûüç\s]+)/i);
          if (cityMatch) {
            return { tool: 'get_weather', params: { city: cityMatch[1].trim() } };
          }
          break;
        case 'calculate':
          const mathMatch = text.match(/(?:calcul|calculer|math).*?([0-9+\-*/.() ]+)/);
          if (mathMatch) {
            return { tool: 'calculate', params: { expression: mathMatch[1].trim() } };
          }
          break;
        case 'search':
          const searchMatch = text.match(/(?:recherche|chercher|trouve).*?(?:sur|pour)?\s+(.+)/i);
          if (searchMatch) {
            return { tool: 'search_web', params: { query: searchMatch[1].trim() } };
          }
          break;
        case 'time':
          return { tool: 'get_time', params: {} };
      }
    }
  }
  return null;
}

export const mockTransport = {
  async sendMessages({ messages, chatId, trigger, messageId, abortSignal }) {
    const lastMessage = messages[messages.length - 1];
    const userMessage = lastMessage?.parts?.find(part => part.type === 'text')?.text || '';

    // Détecter si on doit utiliser un tool
    const toolToUse = detectToolToUse(userMessage);

    const textId = generateChunkId();
    const toolCallId = generateChunkId();

    // Créer un stream readable avec les chunks appropriés
    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (chunk) => console.log(chunk) || controller.enqueue(chunk);
        try {
          // Émettre le chunk de démarrage
          enqueue(createTextChunk(null, 'start'));
          enqueue(createTextChunk(null, 'start-step'));

          if (toolToUse) {
            // Utiliser un tool
            const tool = mockTools[toolToUse.tool];

            // 1. Émettre le tool call
            enqueue({
              type: 'tool-input-start',
              toolCallId: toolCallId,
              toolName: toolToUse.tool
            });

            // Petite pause pour simuler le traitement
            await new Promise(resolve => setTimeout(resolve, 500));

            // 1.bis Émettre un tool input delta
            enqueue({
              type: 'tool-input-delta',
              toolCallId: toolCallId,
              inputTextDelta: 'delta...'
            });

            // Petite pause pour simuler le traitement
            await new Promise(resolve => setTimeout(resolve, 500));

            enqueue({
              type: 'tool-input-available',
              toolCallId: toolCallId,
              toolName: toolToUse.tool,
              input: toolToUse.params
            });

            // 2. Exécuter le tool et émettre le résultat
            const result = await tool.execute(toolToUse.params);

            enqueue({
              type: 'tool-output-available',
              toolCallId: toolCallId,
              output: result
            });

            // 3. Générer une réponse textuelle basée sur le résultat
            let responseText = '';
            switch (toolToUse.tool) {
              case 'get_weather':
                responseText = `Voici la météo pour ${result.location} : il fait ${result.temperature}°C avec un temps ${result.condition}. L'humidité est de ${result.humidity}% et le vent souffle à ${result.windSpeed} km/h.`;
                break;
              case 'calculate':
                responseText = result.isValid
                  ? `Le calcul de "${result.expression}" donne : ${result.result}`
                  : `Désolé, je n'ai pas pu calculer "${result.expression}". ${result.error}`;
                break;
              case 'search_web':
                responseText = `J'ai trouvé ${result.totalFound} résultats pour "${result.query}". Voici les principaux : ${result.results.map((r, i) => `${i+1}. ${r.title}`).join(', ')}.`;
                break;
              case 'get_time':
                responseText = `Nous sommes le ${result.date} (${result.weekday}) et il est ${result.time}.`;
                break;
              default:
                responseText = `J'ai utilisé l'outil ${toolToUse.tool} et obtenu un résultat.`;
            }

            // 4. Streamer la réponse textuelle
            enqueue(createTextChunk(textId, 'text-start'));

            for (let i = 0; i < responseText.length; i++) {
              if (abortSignal?.aborted) {
                controller.close();
                return;
              }

              enqueue(createTextChunk(textId, 'text-delta', { delta: responseText[i] }));
              await new Promise(resolve => setTimeout(resolve, 30));
            }

            enqueue(createTextChunk(textId, 'text-end'));

          } else {
            // Réponse normale sans tool
            const mockResponse = mockResponses[responseIndex % mockResponses.length];
            responseIndex++;

            enqueue(createTextChunk(textId, 'text-start'));

            for (let i = 0; i < mockResponse.length; i++) {
              if (abortSignal?.aborted) {
                controller.close();
                return;
              }

              enqueue(createTextChunk(textId, 'text-delta', { delta: mockResponse[i] }));
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            enqueue(createTextChunk(textId, 'text-end'));
          }

          // Terminer le streaming
          enqueue(createTextChunk(null, 'finish-step'));
          enqueue(createTextChunk(null, 'finish'));
          controller.close();

        } catch (error) {
          enqueue({
            type: 'error',
            error: error.message || 'Une erreur est survenue'
          });
          controller.close();
        }
      }
    });

    return stream;
  }, async reconnectToStream({ chatId }) {
    // Pour ce mock, on ne gère pas la reconnexion
    // Retourner null indique qu'il n'y a pas de stream à reprendre
    return null;
  }
};
