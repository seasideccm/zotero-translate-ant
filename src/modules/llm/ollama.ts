import ollama from 'ollama/browser';
import { showInfo } from '../../utils/tools';
export async function llm() {
  /* if (window?.AbortController) {
    ollama.abortController = new window.AbortController();
    ollama.abort = () => {
      ollama.abortController.abort();
      ollama.abortController = new window.AbortController();
    };
  } */

  const content = 'Why is the sky blue? Please response in Chinese.';
  const response = await ollama.chat({
    model: 'hermis',
    messages: [{ role: 'user', content: content }],
  });
  showInfo(response.message.content);
  ztoolkit.log(response.message.content);

}


export async function aiCHat(content: string, model: string) {
  /* if (window?.AbortController) {
    ollama.abortController = new window.AbortController();
    ollama.abort = () => {
      ollama.abortController.abort();
      ollama.abortController = new window.AbortController();
    };
  } */

  //const content = 'Why is the sky blue? Please response in Chinese.';
  const response = await ollama.chat({
    // model: 'hermis',
    model: model,
    messages: [{ role: 'user', content: content }],
  });
  ztoolkit.log(response.message.content);
  return response.message.content;

}

export async function getModels() {
  const response = await ollama.list();
  const models = response.models.map((item: any) => item.model);
  ztoolkit.log(models);
  return models;
}


