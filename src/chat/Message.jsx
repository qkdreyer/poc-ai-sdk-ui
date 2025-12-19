const render = (part, index, _list, prefix = '') => {
  if (part.type === 'step-start') {
    return index > 0 ? (
      <div key={prefix + index.toString()} className="text-gray-500">
        <hr className="my-2 border-gray-300" />
      </div>
    ) : null;
  }
  if (part.type === 'text') {
    return <div key={prefix + index.toString()}>{part.text}</div>;
  }
  if (part.type === 'image') {
    return <img key={prefix + index.toString()} src={`data:${part.mimeType};base64,${part.data}`} />;
  }
  if (part.type?.startsWith('tool-')) {
    switch (part.state) {
      case 'input-streaming':
      case 'input-available':
        return (
          <pre key={part.toolCallId}>
            <>Calling {part.type}</>
            {part.input && <>with&nbsp;{JSON.stringify(part.input, null, 2)}</>}
          </pre>
        );
      case 'output-available':
        return (
          <pre key={part.toolCallId}>
            <>Called {part.type}</>
            {part.input && <>with&nbsp;{JSON.stringify(part.input, null, 2)}</>}
            {(part.type === 'tool-sub_agent' ? part.output.parts : Array.isArray(part.output) ? part.output : [part.output]).map((part, index) => render(part, index, _list, `${index}-`))}
          </pre>
        );
      case 'output-error':
        return <div key={part.toolCallId}>Error: {part.errorText}</div>;
    }
  }
  if (part.type === 'reasoning')
    return <div key={prefix + index.toString()}><i>{part.text}</i></div>;
  return <div key={prefix + index.toString()}>({part.type}) {part.text}</div>;
}

export const Message = ({ message }) => <div className={`message.${message.role}`} style={{
  marginBottom: 12,
  padding: 8,
  borderRadius: 8
}}>
  <strong style={{ color: message.role === 'user' ? '#0066cc' : '#cc6600' }}>
    {message.role === 'user' ? '👤 Utilisateur' : '🤖 Assistant'}:
  </strong>
  <div style={{ marginTop: 4, whiteSpace: 'pre-line' }}>
    {message.parts.map(render)}
  </div>
</div>
