import { completion } from 'litellm';
process.env['OPENAI_API_KEY'] = 'NULL';

export function responseOllam() {
    const response = completion({
        model: "ollama/qwen",
        messages: [{ "content": "Hello, how are you?", "role": "user" }],
        //api_base: "http://localhost:11434"
    });
    ztoolkit.log(response);
}
/* 
const response = await completion({

    model: 'gpt-3.5-turbo',
    messages: [{ content: 'Hello, how are you?', role: 'user' }],
});

// or stream the results
const stream = await completion({
    model: "gpt-3.5-turbo",
    messages: [{ content: "Hello, how are you?", role: "user" }],
    stream: true
});

for await (const part of stream) {
    process.stdout.write(part.choices[0]?.delta?.content || "");
} */




