export function arrToObj(keys: string[], values: any[]) {
    if (keys.length !== values.length) {
        throw "keys and values amount is not equal";
    }
    const obj = {};
    keys.forEach((key: string, i: number) => {
        Object.assign(obj, { [key]: values[i] });
    });
    return obj;
}