import OpenAI from 'openai';
import ollama from './ollamajs.mjs';
// 实验性兼容
export async function openAIOllama() {

    const openai = new OpenAI({
        baseURL: 'http://localhost:11434/v1',
        apiKey: 'ollama', // required but unused
    });

    const completion = await openai.chat.completions.create({
        model: 'qwen',
        messages: [{ role: 'user', content: '介绍一下你自己' }],
    });
    ztoolkit.log(completion);
}

export async function openAICustom(baseURL: string, apiKey: string = 'null') {
    //baseURL: 'http://localhost:11434/v1',
    const openai = new OpenAI({
        baseURL: baseURL,
        apiKey: apiKey, // required but unused
    });
    return openai;
}



export function prepairLLM(provider: string = "ollama") {
    if (provider == "ollama") {
        return ollama;
    } else if (provider.toLocaleLowerCase() != "openai") {
        return openAICustom;
    } else {
        return new OpenAI({
            apiKey: getApikey(provider.toLocaleLowerCase())
        });
    }
}

function getApikey(provider: string) {
    return "apiKey";
}

//, model: string = "qwen", role: "user" | "assistant" | "system" = "user", stream: boolean = false,content: string,