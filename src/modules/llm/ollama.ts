import ollama from 'ollama/browser';
import { showInfo } from '../../utils/tools';
export async function llm() {
  if (window.AbortController) {
    ollama.abortController = new window.AbortController();
    ollama.abort = () => {
      ollama.abortController.abort();
      ollama.abortController = new window.AbortController();
    };
  }
  const response = await ollama.chat({
    model: 'hermis',
    messages: [{ role: 'user', content: 'Why is the sky blue? Please response in Chinese.' }],
  });
  showInfo(response.message.content);
  ztoolkit.log(response.message.content);
}