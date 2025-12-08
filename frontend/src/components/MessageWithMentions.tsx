interface MessageWithMentionsProps {
  text: string;
  className?: string;
}

export function MessageWithMentions({ text, className = "" }: MessageWithMentionsProps) {
  // Regex para capturar menções no formato @[Nome](user_id)
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  
  const parts: Array<{ type: "text" | "mention"; content: string; userId?: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Adiciona o texto antes da menção
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }

    // Adiciona a menção
    parts.push({
      type: "mention",
      content: match[1], // Nome do usuário
      userId: match[2], // ID do usuário
    });

    lastIndex = match.index + match[0].length;
  }

  // Adiciona o texto restante
  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === "mention") {
          return (
            <span
              key={index}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-sm font-medium"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
                color: "var(--color-primary)",
              }}
              title={`User ID: ${part.userId}`}
            >
              @{part.content}
            </span>
          );
        }
        return <span key={index}>{part.content}</span>;
      })}
    </span>
  );
}
