import { config } from "../../package.json";
import { franc } from 'franc-min';


export async function resourceFilesName(url?: string) {
    url = url || `chrome://${config.addonRef}/content/schema/`;
    //@ts-ignore has
    const result = await Zotero.HTTP.request("GET", url);
    const filesInfo = result.response.split("\n").filter((e: string) => e.includes("FILE"));
    const files = filesInfo.map((e: string) => fileNameNoExt(e.split(" ")[1])).filter((e: any) => e && e != "");
    return files;
}

/**
 * 获取文件夹中的文件名
 * @param dir 
 * @param option 是否包含子文件夹、是否保留扩展名
 * @returns 
 */
export async function getFilesPathOrName(dir: string, option: any = { subDirectory: true, extension: false }) {
    const filesPathOrName: string[] = [];
    async function onOntry(entry: any) {
        if (entry.isDir && option.subDirectory) {
            await Zotero.File.iterateDirectory(entry.path, onOntry);
        }
        else if (entry.isDir && !option.subDirectory) {
            return;
        }
        else {
            if (!entry.name) return;
            if (option.extension) {
                filesPathOrName.push(entry.name);
            } else {
                filesPathOrName.push(fileNameNoExt(entry.name));
            }
        }
    }
    await Zotero.File.iterateDirectory(dir, onOntry);
    ztoolkit.log(filesPathOrName);
    return filesPathOrName;
}

export function arrToObj(keys: string[], values: any[]) {
    if (keys.length !== values.length) {
        throw ("keys and values amount is not equal");
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

export const { OS } = Components.utils.import("resource://gre/modules/osfile.jsm");
export async function readImage(path: string) {
    if (!await OS.File.exists(path)) { return; }
    const buf = await OS.File.read(path, {});
    const imgWidthHeight = ReadPNG(buf);
    const blob = new Blob([buf]);
    const temp = OS.Path.basename(path).split('.');
    const fileType = "image/" + temp.pop();
    const fileName = temp.join('');
    const file = new File([blob], fileName, { type: fileType, lastModified: Date.now() });
    const base64 = await trigerByImageBase64(file);
    return {
        width: imgWidthHeight?.width as number,
        height: imgWidthHeight?.height as number,
        base64: base64 as string,
        fileType: fileType,
        fileName: fileName
    };
}

export function fileNameNoExt(fileNameOrPath: string) {
    let fileNameNoExt;
    const baseName = OS.Path.basename(fileNameOrPath);
    const pos = baseName.lastIndexOf('.');
    if (pos > 0) {
        fileNameNoExt = baseName.substr(0, pos);
        const ext = baseName.substr(pos + 1);
    } else {
        fileNameNoExt = baseName;
    }
    return fileNameNoExt;
}

export function getDir(fileNameOrPath: string) {
    return OS.Path.dirname(fileNameOrPath);
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

export function trigerByImageBase64(blob: any) {
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


/**
 * 通过进度条显示信息
 * 关闭其他窗口若为true，则关闭最近一次生成的所有进度条
 * 但不会关闭更早的进度条窗口
 * 不传参数用 undefined 表示
 * @param {string} info 显示的信息
 * @param {number} closeTime 默认不自动关闭
 * @param {Window} window 指定显示在哪个窗口中，如指定 addon.data.prefs.window，否则主窗口
 * @param {boolean} closeOnClick 默认点击时关闭
 * @param {boolean} closeOtherProgressWindows 默认 true
 * @returns 
 */
export function showInfo(info: string, closeTime?: number, window?: Window, closeOnClick?: boolean, closeOtherProgressWindows?: boolean) {

    let popupWin = addon.mountPoint.popupWin;
    if (!popupWin) {
        popupWin = new ztoolkit.ProgressWindow(config.addonName, {
            window: window ? window : undefined,
            closeOnClick: closeOnClick ? closeOnClick : true,
            closeTime: closeTime ? closeTime : -1,
            closeOtherProgressWindows: closeOtherProgressWindows ? closeOtherProgressWindows : true
        });
    }
    popupWin.createLine({
        text: info,
        type: "default",
        progress: 0,
    });
    popupWin.show();
    if (closeTime) popupWin.startCloseTimer(closeTime);

    return popupWin;
}