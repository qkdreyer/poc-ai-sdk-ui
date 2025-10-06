export const Message = ({ message }) => <div style={{
  marginBottom: 12,
  padding: 8,
  backgroundColor: message.role === 'user' ? '#f0f8ff' : '#f9f9f9',
  borderRadius: 8
}}>
  <strong style={{ color: message.role === 'user' ? '#0066cc' : '#cc6600' }}>
    {message.role === 'user' ? '👤 Utilisateur' : '🤖 Assistant'}:
  </strong>
  <div style={{ marginTop: 4 }}>
    {message.parts?.map((part, i) => {
      switch (part.type) {
        case 'text':
          return <span key={i}>{part.text}</span>;

        case 'tool-askForConfirmation': {
          const callId = part.toolCallId;

          switch (part.state) {
            case 'input-streaming':
              return (
                <div key={callId}>Loading confirmation request...</div>
              );
            case 'input-available':
              return (
                <div key={callId}>
                  {part.input.message}
                  <div>
                    <button
                      onClick={() =>
                        addToolResult({
                          tool: 'askForConfirmation',
                          toolCallId: callId,
                          output: 'Yes, confirmed.',
                        })
                      }
                    >
                      Yes
                    </button>
                    <button
                      onClick={() =>
                        addToolResult({
                          tool: 'askForConfirmation',
                          toolCallId: callId,
                          output: 'No, denied',
                        })
                      }
                    >
                      No
                    </button>
                  </div>
                </div>
              );
            case 'output-available':
              return (
                <div key={callId}>
                  Location access allowed: {part.output}
                </div>
              );
            case 'output-error':
              return <div key={callId}>Error: {part.errorText}</div>;
          }
          break;
        }

        case 'tool-getLocation': {
          const callId = part.toolCallId;

          switch (part.state) {
            case 'input-streaming':
              return (
                <div key={callId}>Preparing location request...</div>
              );
            case 'input-available':
              return <div key={callId}>Getting location...</div>;
            case 'output-available':
              return <div key={callId}>Location: {part.output}</div>;
            case 'output-error':
              return (
                <div key={callId}>
                  Error getting location: {part.errorText}
                </div>
              );
          }
          break;
        }

        case 'tool-getWeatherInformation': {
          const callId = part.toolCallId;

          switch (part.state) {
            // example of pre-rendering streaming tool inputs:
            case 'input-streaming':
              return (
                <pre key={callId}>{JSON.stringify(part, null, 2)}</pre>
              );
            case 'input-available':
              return (
                <div key={callId}>
                  Getting weather information for {part.input.city}...
                </div>
              );
            case 'output-available':
              return (
                <div key={callId}>
                  Weather in {part.input.city}: {part.output}
                </div>
              );
            case 'output-error':
              return (
                <div key={callId}>
                  Error getting weather for {part.input.city}:{' '}
                  {part.errorText}
                </div>
              );
          }
          break;
        }
      }

      if (part.type?.startsWith("data-")) {
        return (
          <div key={i} style={{
            backgroundColor: '#fff7e6',
            border: '1px solid #ffa500',
            padding: 8,
            margin: '4px 0',
            borderRadius: 4,
            fontSize: '0.9em'
          }}>
            <strong>📦 Données ({part.type}) :</strong>
            <pre style={{
              margin: '4px 0',
              whiteSpace: 'pre-wrap',
              fontSize: '0.85em',
              backgroundColor: 'transparent'
            }}>
              {JSON.stringify(part.data || part, null, 2)}
            </pre>
          </div>
        );
      }
      return null;
    })}
  </div>
</div>
