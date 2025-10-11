<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Chat component that has thinking and other thigns states in shadcn

For building a chat component with thinking states in shadcn, there are excellent pre-built solutions available:

## Official shadcn AI Chatbot Component

Install the **official AI chatbot block** from shadcn which includes thinking states, streaming, and reasoning display:[^1]

```bash
npx shadcn@latest add https://www.shadcn.io/registry/ai-chatbot.json
```


### Key Features

**Thinking/Streaming States** - Shows "Thinking..." loader when AI starts processing, then streams responses character-by-character. The component automatically handles all loading states.[^2][^1]

**Reasoning Display** - Collapsible sections that show AI thought processes (perfect for showcasing how Ollama is reasoning). Auto-expands during reasoning, manual toggle after completion.[^3][^1]

**Streaming Coordination** - Handles scroll management, typing indicators, and state updates without breaking layout. No scroll jumping during character-by-character responses.[^4][^1]

**Model Selection** - Built-in dropdown for switching between models (GPT-4, Claude, Llama, etc.). Works perfectly for your Ollama integration.[^1]

### Basic Implementation

```typescript
'use client';

import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ui/shadcn-io/ai/conversation';
import { Loader } from '@/components/ui/shadcn-io/ai/loader';
import { Message, MessageAvatar, MessageContent } from '@/components/ui/shadcn-io/ai/message';
import { PromptInput, PromptInputSubmit, PromptInputTextarea } from '@/components/ui/shadcn-io/ai/prompt-input';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ui/shadcn-io/ai/reasoning';

type ChatMessage = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  reasoning?: string;
  isStreaming?: boolean;
};

export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: nanoid(),
      content: inputValue.trim(),
      role: 'user',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Add assistant message with streaming state
    const assistantId = nanoid();
    setMessages(prev => [...prev, {
      id: assistantId,
      content: '',
      role: 'assistant',
      timestamp: new Date(),
      isStreaming: true,
    }]);

    // Call Ollama via your IPC bridge
    const stream = await window.electronAPI.chatWithOllama(inputValue);
    
    // Stream response character by character
    for await (const chunk of stream) {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantId 
          ? { ...msg, content: msg.content + chunk, isStreaming: true }
          : msg
      ));
    }

    // Mark streaming complete
    setMessages(prev => prev.map(msg => 
      msg.id === assistantId 
        ? { ...msg, isStreaming: false }
        : msg
    ));
    
    setIsTyping(false);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background">
      {/* Conversation Area */}
      <Conversation className="flex-1">
        <ConversationContent className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="space-y-3">
              <Message from={message.role}>
                <MessageContent>
                  {message.isStreaming && message.content === '' ? (
                    <div className="flex items-center gap-2">
                      <Loader size={14} />
                      <span className="text-muted-foreground text-sm">
                        Thinking...
                      </span>
                    </div>
                  ) : (
                    message.content
                  )}
                </MessageContent>
                <MessageAvatar 
                  src={message.role === 'user' ? '/user-avatar.png' : '/ai-avatar.png'}
                  name={message.role === 'user' ? 'You' : 'AI'}
                />
              </Message>

              {/* Reasoning section */}
              {message.reasoning && (
                <div className="ml-10">
                  <Reasoning isStreaming={message.isStreaming} defaultOpen={false}>
                    <ReasoningTrigger />
                    <ReasoningContent>{message.reasoning}</ReasoningContent>
                  </Reasoning>
                </div>
              )}
            </div>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input Area */}
      <div className="border-t p-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask anything..."
            disabled={isTyping}
          />
          <PromptInputSubmit 
            disabled={!inputValue.trim() || isTyping}
            status={isTyping ? 'streaming' : 'ready'}
          />
        </PromptInput>
      </div>
    </div>
  );
}
```


## Alternative: shadcn-chatbot-kit

For more advanced features including tool execution states and cancellation:[^3]

```bash
npm install shadcn-chatbot-kit
```

**Features include**:[^5][^3]

- Visual thinking process blocks (WIP but functional)
- Tool execution states with cancel support
- Smart interrupt prompts
- File upload with preview
- Voice input support (WIP)


### Integration with Ollama

```javascript
// In Electron main process
ipcMain.handle('chat-with-ollama', async (event, message) => {
  const stream = await ollama.chat({
    model: 'llama3.2',
    messages: [{ role: 'user', content: message }],
    stream: true,
  });

  // Send chunks back to renderer
  for await (const chunk of stream) {
    event.sender.send('ollama-chunk', chunk.message.content);
  }
  
  event.sender.send('ollama-done');
});
```


## State Management

The component automatically handles these states:[^4][^1]

**Ready** - Default state, input enabled, submit button active[^1][^4]

**Thinking** - Shows `<Loader />` component with "Thinking..." text[^2][^1]

**Streaming** - Content appears character-by-character, scroll auto-follows[^6][^1]

**Complete** - Streaming stops, reasoning sections become toggleable[^1]

**Error** - Display error messages with retry option[^7][^4]

The official shadcn AI components handle all the complex coordination between streaming, scrolling, and state updates automatically, making it perfect for your tarr.ink Electron app with Ollama integration.[^8][^9][^3][^1]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20]</span>

<div align="center">⁂</div>

[^1]: https://www.shadcn.io/blocks/ai-chatbot

[^2]: https://www.shadcn.io/ai/loader

[^3]: https://github.com/Blazity/shadcn-chatbot-kit

[^4]: https://blog.logrocket.com/building-real-time-state-management-react-fluent-state/

[^5]: https://next.jqueryscript.net/shadcn-ui/ai-chatbots-kit/

[^6]: https://www.shadcn.io/ai/conversation

[^7]: https://stackoverflow.com/questions/77658021/react-chatbot-display-loading-message-while-sending-user-input-and-fetching-ai

[^8]: https://www.shadcn.io/ai

[^9]: https://www.youtube.com/watch?v=dS7hyPNvIb8

[^10]: https://www.youtube.com/watch?v=Tyezijzlm1I

[^11]: https://next.jqueryscript.net/shadcn-ui/accessible-chat-input/

[^12]: https://www.robinwieruch.de/react-ai-chat/

[^13]: https://ai-sdk.dev/elements/components/conversation

[^14]: https://github.com/jakobhoeg/shadcn-chat

[^15]: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot

[^16]: https://ui.shadcn.com/docs/components/sidebar

[^17]: https://github.com/assistant-ui/assistant-ui

[^18]: https://github.com/birobirobiro/awesome-shadcn-ui

[^19]: https://ts.llamaindex.ai/docs/chat-ui

[^20]: https://v0.app/chat/shadcn-component-list-9sMfk0XAvlR

