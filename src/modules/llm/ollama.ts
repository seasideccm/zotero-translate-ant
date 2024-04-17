import ollama from './ollamajs.mjs';
import { showInfo } from '../../utils/tools';

export async function aiCHat(content: string, model: string, role: "user" | "assistant" | "system" = "user", stream: boolean = false) {
  if (window?.AbortController) {
    ollama.abortController = new window.AbortController();
    ollama.abort = () => {
      ollama.abortController.abort();
      ollama.abortController = new window.AbortController();
    };
  }

  //const content = 'Why is the sky blue? Please response in Chinese.';
  const response = await ollama.chat({
    // model: 'hermis',
    model: model,
    messages: [{ role: role, content: content }],
    stream: stream
  });
  if (stream) return response;
  ztoolkit.log(response.message.content);
  return response.message.content;

}

export async function getModels() {
  const response = await ollama.list();
  const models = response.models.map((item: any) => item.model).filter((model: string) => !model.includes("embed"));
  ztoolkit.log(models);
  return models;
}


