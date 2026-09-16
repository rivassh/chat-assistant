import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const TMUX_SESSION = process.env.TMUX_SESSION || '2';
const TMUX_WINDOW = process.env.TMUX_WINDOW || '0';

export async function sendToMimo(message) {
  try {
    const { stdout: before } = await execAsync(`tmux capture-pane -t ${TMUX_SESSION}:${TMUX_WINDOW} -p`);
    const beforeLines = before.split('\n').length;
    
    await execAsync(`tmux send-keys -t ${TMUX_SESSION}:${TMUX_WINDOW} '${message.replace(/'/g, "'\\''")}' Enter`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response = await captureResponse(beforeLines);
    return response;
  } catch (err) {
    console.error('[Tmux] Error sending to mimo:', err.message);
    throw new Error('Failed to communicate with mimo');
  }
}

async function captureResponse(beforeLines, timeout = 30000) {
  const startTime = Date.now();
  let lastContent = '';
  let stableCount = 0;
  
  while (Date.now() - startTime < timeout) {
    try {
      const { stdout } = await execAsync(`tmux capture-pane -t ${TMUX_SESSION}:${TMUX_WINDOW} -p`);
      const content = stdout.trim();
      
      if (content === lastContent) {
        stableCount++;
        if (stableCount >= 3) {
          const lines = content.split('\n');
          const newLines = lines.slice(beforeLines);
          return newLines.join('\n').trim() || content;
        }
      } else {
        lastContent = content;
        stableCount = 0;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return lastContent;
}

export async function getMimoStatus() {
  try {
    const { stdout } = await execAsync(`tmux has-session -t ${TMUX_SESSION} 2>&1 && echo "active" || echo "inactive"`);
    return stdout.trim() === 'active';
  } catch {
    return false;
  }
}
