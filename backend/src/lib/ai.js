import { config } from '../config.js';
import { sendToMimo, getMimoStatus } from './tmux.js';

export async function generateResponse({ systemPrompt, messages, temperature, maxTokens }) {
  const isMimoActive = await getMimoStatus();
  
  if (!isMimoActive) {
    return {
      content: 'Mimo is not available. Please try again later.',
      usage: null,
    };
  }

  try {
    const lastMessage = messages[messages.length - 1];
    const userMessage = lastMessage?.content || '';
    
    const response = await sendToMimo(userMessage);
    
    return {
      content: response || 'I couldn\'t generate a response. Please try again.',
      usage: null,
    };
  } catch (err) {
    console.error('[AI] Mimo request failed:', err.message);
    return {
      content: 'I\'m experiencing a temporary issue. Please try again shortly.',
      usage: null,
    };
  }
}
