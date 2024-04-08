export async function FetchWithAuth(this: { username: string | null, password: string | null; }, input: RequestInfo | URL, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    const authorization = btoa(`${this?.username}:${this?.password}`);
    console.log(`Authorization: ${authorization}`);
    headers.set('Authorization', `Basic ${authorization}`);
    return fetch(input, { ...init, headers });
}