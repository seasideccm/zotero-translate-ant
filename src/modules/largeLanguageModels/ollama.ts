import ollama from "./ollamajs.mjs";

export async function aiCHat(
  content: string,
  model: string,
  role: "user" | "assistant" | "system" = "user",
  isStream: boolean = false,
) {
  /*   if (window?.AbortController) {
      ollama.abortController = new window.AbortController();
      ollama.abort = () => {
        ollama.abortController.abort();
        ollama.abortController = new window.AbortController();
      };
    } */

  const response = await ollama.chat({
    model: model,
    messages: [{ role: role, content: content }],
    //@ts-ignore xxx
    stream: isStream,
  });
  if (isStream) return response;
  return response.message.content;
}

export async function getModels() {
  const response = await ollama.list();
  const models = response.models
    .map((item: any) => item.model)
    .filter((model: string) => !model.includes("embed"));
  ztoolkit.log(models);
  return models;
}
