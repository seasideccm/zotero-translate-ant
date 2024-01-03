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

export function base64ToBytes(imageDataURL: string): {
    u8arr:
    Uint8Array;
    mime: string;
} | undefined {
    const parts = imageDataURL.split(',');
    if (!parts[0].includes('base64')) return;
    const mime = parts[0].match(/:(.*?);/)![1];
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return {
        u8arr: u8arr,
        mime: mime,
    };
}

export function base64ToBlob(imageDataURL: string): Blob | undefined {
    const temp = base64ToBytes(imageDataURL);
    if (!temp) return;
    const blob = new Blob([temp.u8arr], { type: temp.mime });
    return blob;
}

export async function fileToblob(path: string) {
    const buf = await IOUtils.read(path);
    return new Blob([buf]);
}

const { OS } = Components.utils.import("resource://gre/modules/osfile.jsm");
export async function readImage(path: string) {
    if (!await OS.File.exists(path)) { return; }
    const buf = await OS.File.read(path, {});
    const imgWidthHeight = ReadPNG(buf);
    const blob = new Blob([buf]);
    const temp = OS.Path.basename(path).split('.');
    const fileType = "image/" + temp.pop();
    const fileName = temp.join('');
    const file = new File([blob], fileName, { type: fileType, lastModified: Date.now() });
    const base64 = await getImageBase64(file);
    return {
        width: imgWidthHeight?.width as number,
        height: imgWidthHeight?.height as number,
        base64: base64 as string,
        fileType: fileType,
        fileName: fileName
    };
}

export async function saveImage(dataURL: string, outputPath: string) {
    const temp = base64ToBytes(dataURL);
    if (!temp) return;
    const u8arr = temp.u8arr;
    const mime = temp.mime;
    //事先建好目录可以保存，图片大小适中
    const dir = outputPath.replace(/[^/\\]+$/m, '');
    if (!await OS.File.exists(dir)) {
        await OS.File.makeDir(dir);
    }
    await OS.File.writeAtomic(outputPath, u8arr);
    return {
        u8arr: u8arr,
        mime: mime
    };
}

export function getImageBase64(blob: any) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => {
            const base64 = reader.result;
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

function readUint32BE(bytes: any, start: number) {
    const uarr = new Uint32Array(1);
    uarr[0] = (bytes[start + 0] & 0xFF) << 24;
    uarr[0] = uarr[0] | ((bytes[start + 1] & 0xFF) << 16);
    uarr[0] = uarr[0] | ((bytes[start + 2] & 0xFF) << 8);
    uarr[0] = uarr[0] | (bytes[start + 3] & 0xFF);
    return uarr[0];
}

const IMAGE_HEAD_SIGS = {
    GIF: [0x47, 0x49, 0x46], //'G' 'I' 'F' ascii
    PNG: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    JPG: [0xff, 0xd8, 0xff, 0xe0],
    BMP: [0x42, 0x4d]
};

export function ReadPNG(buf: any) {
    if (buf.slice(0, 8).toString() === IMAGE_HEAD_SIGS.PNG.toString()) {
        const width = readUint32BE(buf, 16);
        const height = readUint32BE(buf, 20);
        return { width, height };
    }
}