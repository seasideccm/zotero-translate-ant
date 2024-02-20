import { config } from "../../package.json";
import { franc } from "franc-min";
import { addonStorageDir } from "./constant";

export async function resourceFilesName(url?: string) {
  url = url || `chrome://${config.addonRef}/content/schema/`;
  //@ts-ignore has
  const result = await Zotero.HTTP.request("GET", url);
  const filesInfo = result.response
    .split("\n")
    .filter((e: string) => e.includes("FILE"));
  const files = filesInfo
    .map((e: string) => fileNameNoExt(e.split(" ")[1]))
    .filter((e: any) => e && e != "");
  return files;
}

export function compareObj(obj1: any, obj2: any) {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  const allKeys = keys1.concat(keys2);
  const diffKeys = allKeys.filter(e => !keys1.includes(e) || !keys2.includes(e));
  const sameKeys = allKeys.filter(e => !diffKeys.includes(e));
  //const diffKeys=Zotero.Utilities.arrayDiff(keys1, keys2).concat(Zotero.Utilities.arrayDiff(keys2, keys1))
  for (const key of sameKeys) {
    if (obj1[key] !== obj2[key]) {
      diffKeys.push(key);
    }
  }
  if (diffKeys.length) return diffKeys;
  return true;
}

export function deepEqual(object1: any, object2: any) {
  const keys1 = Object.keys(object1);
  const keys2 = Object.keys(object2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (let index = 0; index < keys1.length; index++) {
    const val1 = object1[keys1[index]];
    const val2 = object2[keys2[index]];
    const areObjects = isObject(val1) && isObject(val2);
    if (areObjects && !deepEqual(val1, val2) ||
      !areObjects && val1 !== val2) {
      return false;
    }
  }

  return true;
}

function isObject(object: any) {
  return object != null && typeof object === 'object';
}



/**
 * 获取文件夹中的文件名
 * @param dir
 * @param option 是否包含子文件夹、是否保留扩展名
 * @returns
 */
export async function getFilesPathOrName(
  dir: string,
  option: any = { subDirectory: true, extension: false },
) {
  const filesPathOrName: string[] = [];
  async function onOntry(entry: any) {
    if (entry.isDir && option.subDirectory) {
      await Zotero.File.iterateDirectory(entry.path, onOntry);
    } else if (entry.isDir && !option.subDirectory) {
      return;
    } else {
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
    throw "keys and values amount is not equal";
  }
  const obj = {};
  keys.forEach((key: string, i: number) => {
    Object.assign(obj, { [key]: values[i] });
  });
  return obj;
}

export function arrsToObjs(keys: string[]) {
  return function (values: any[] | any[][]) {
    if (!Array.isArray(values[0]))
      return [arrToObj(keys, values)];
    return values.map((value) => arrToObj(keys, value));
  };
}

export function base64ToBytes(imageDataURL: string):
  | {
    u8arr: Uint8Array;
    mime: string;
  }
  | undefined {
  const parts = imageDataURL.split(",");
  if (!parts[0].includes("base64")) return;
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

export const { OS } = Components.utils.import(
  "resource://gre/modules/osfile.jsm",
);
export async function readImage(path: string) {
  if (!(await OS.File.exists(path))) {
    return;
  }
  const buf = await OS.File.read(path, {});
  const imgWidthHeight = ReadPNG(buf);
  const blob = new Blob([buf]);
  const temp = OS.Path.basename(path).split(".");
  const fileType = "image/" + temp.pop();
  const fileName = temp.join("");
  const file = new File([blob], fileName, {
    type: fileType,
    lastModified: Date.now(),
  });
  const base64 = await trigerByImageBase64(file);
  return {
    width: imgWidthHeight?.width as number,
    height: imgWidthHeight?.height as number,
    base64: base64 as string,
    fileType: fileType,
    fileName: fileName,
  };
}

export function fileNameNoExt(fileNameOrPath: string) {
  let fileNameNoExt;
  const baseName = OS.Path.basename(fileNameOrPath);
  const pos = baseName.lastIndexOf(".");
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
  const dir = outputPath.replace(/[^/\\]+$/m, "");
  if (!(await OS.File.exists(dir))) {
    await OS.File.makeDir(dir);
  }
  await OS.File.writeAtomic(outputPath, u8arr);
  return {
    u8arr: u8arr,
    mime: mime,
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
    reader.onerror = (error) => reject(error);
  });
}

function readUint32BE(bytes: any, start: number) {
  const uarr = new Uint32Array(1);
  uarr[0] = (bytes[start + 0] & 0xff) << 24;
  uarr[0] = uarr[0] | ((bytes[start + 1] & 0xff) << 16);
  uarr[0] = uarr[0] | ((bytes[start + 2] & 0xff) << 8);
  uarr[0] = uarr[0] | (bytes[start + 3] & 0xff);
  return uarr[0];
}

const IMAGE_HEAD_SIGS = {
  GIF: [0x47, 0x49, 0x46], //'G' 'I' 'F' ascii
  PNG: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  JPG: [0xff, 0xd8, 0xff, 0xe0],
  BMP: [0x42, 0x4d],
};

export function ReadPNG(buf: any) {
  if (buf.slice(0, 8).toString() === IMAGE_HEAD_SIGS.PNG.toString()) {
    const width = readUint32BE(buf, 16);
    const height = readUint32BE(buf, 20);
    return { width, height };
  }
}


export function getPopupWin(header: string = config.addonName, option?: OptionsPopupWin) {
  if (!addon.mountPoint["popupWin"] || option) {
    addon.mountPoint["popupWin"] = new ztoolkit.ProgressWindow(header, option);
  }
  return addon.mountPoint["popupWin"];
}
export function showInfo(infos?: string | string[], option?: OptionsPopupWin, header?: string, optionsCreatLine?: OptionsPopupWinCreateLine) {
  const noop = () => {
  };
  !header ? header = config.addonName : noop;
  //const popupWin = addon.mountPoint["popupWin"] = new ztoolkit.ProgressWindow(header, option);
  const popupWin = new ztoolkit.ProgressWindow(header, option);
  //if (!option || option.closeTime != -1) {
  //  Zotero.ProgressWindowSet.closeAll();
  //}
  if (!infos && (!optionsCreatLine || !optionsCreatLine.text)) {
    throw "info and optionsCreatLine.text can't all undefinde";
  }
  !optionsCreatLine ? optionsCreatLine = {} : noop;
  !optionsCreatLine.type ? optionsCreatLine.type = "default" : noop;
  if (infos) {
    if (!Array.isArray(infos)) infos = [infos];
    infos.filter((info: string) => {
      optionsCreatLine!.text = info;
      popupWin.createLine(optionsCreatLine!);
    });
  } else (
    popupWin.createLine(optionsCreatLine)
  );
  popupWin.show();
  return popupWin;
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
/* export function showInfo(
  info: string,
  closeTime?: number,
  window?: Window,
  closeOnClick?: boolean,
  closeOtherProgressWindows?: boolean,
) {
  let popupWin = addon.mountPoint.popupWin;
  if (!popupWin) {
    popupWin = new ztoolkit.ProgressWindow(config.addonName, {
      window: window ? window : undefined,
      closeOnClick: closeOnClick ? closeOnClick : true,
      closeTime: closeTime ? closeTime : -1,
      closeOtherProgressWindows: closeOtherProgressWindows
        ? closeOtherProgressWindows
        : true,
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
} */

export async function saveJsonToDisk(
  obj: any,
  filename: string,
  dir?: string,
  ext?: string,
) {
  const objJson = JSON.stringify(obj);
  const tempObj = getPathDir(filename, dir, ext);
  const path = tempObj.path;
  dir = tempObj.dir;
  if (!(await OS.File.exists(dir))) {
    await OS.File.makeDir(dir);
  }
  await OS.File.writeAtomic(path, objJson);
  return path;
}

/**
 *
 * @param filename 单独文件名或伴扩展名或绝对路径
 * @param dir 可选参数
 * @param ext 可选参数 伴或不伴点，如 .png 或 png
 * @returns
 */
export const getPathDir = (filename: string, dir?: string, ext?: string) => {
  filename = fileNameLegal(filename);
  dir = dir || addonStorageDir;
  ext = ext || ".json";
  if (filename.match(/\.[^./\\]+$/m)) {
    ext = filename.match(/\.[^./\\]+$/m)![0];
  }
  if (filename.match(/[/\\]/g)) {
    //文件名是包括扩展名的完整路径
    dir = "";
    ext = "";
  }
  if (!ext.startsWith(".")) {
    ext = "." + ext;
  }
  dir = OS.Path.normalize(dir);
  const path = OS.Path.join(dir, (filename + ext));
  return {
    path: path,
    dir: dir,
  };
};

export function fileNameLegal(fileName: string) {
  fileName = fileName.replace(/[/\\?%*:|"<>]/g, "_");
  return fileName;
}

export async function zipFile(dirOrPath: string, zipPath: string) {
  return await Zotero.File.zipDirectory(dirOrPath, zipPath, undefined);
}

export async function getFilesRecursive(dir: string, ext?: string) {
  let files: any[] = [];
  const dirs: any[] = [dir];
  async function onEntry(entry: any) {
    if (!entry.isDir) {
      files.push({
        name: entry.name,
        path: entry.path,
      });
      return;
    }
    dirs.push(entry.path);
    await Zotero.File.iterateDirectory(entry.path, onEntry);

  }
  try {
    if (!await OS.File.exists(dir)) {
      ztoolkit.log(`${dir} does not exist`);
      return files;
    }
    await Zotero.File.iterateDirectory(dir, onEntry);
    files.sort((a, b) => {
      return b.lastModified - a.lastModified;
    });
  }
  catch (e: any) {
    Zotero.logError(e);
  }
  for (let i = 0; i < files.length; i++) {
    const info = await OS.File.stat(files[i].path);
    files[i].size = info.size;
    files[i].lastModified = info.lastModificationDate;
  }
  files.push({
    name: "dirs",
    dirs: dirs
  });
  files = ext ? files.filter(e => (e.name as string).endsWith(ext)) : files;
  ztoolkit.log(files);
  return files;
}


export async function collectFilesRecursive(dirPath: string, parents = [], files = []) {
  //@ts-ignore has
  await Zotero.File.iterateDirectory(dirPath, async ({ isDir, _isSymlink, name, path }) => {
    if (isDir) {
      //@ts-ignore has
      await collectFilesRecursive(path, [...parents, name], files);
    }
    // TODO: Also check for hidden file attribute on windows?
    else if (!name.startsWith('.')) {
      //@ts-ignore has
      files.push({ parents, path, name });
    }
  });
  ztoolkit.log(files);
  return files;
};


export async function resourceFilesRecursive(url: string = `chrome://${config.addonRef}/content/schema/`, files: any[] = [], ext?: string) {
  const req = await Zotero.File.getResourceAsync(url);
  const filesInfo = req.split("\n");
  for (let str of filesInfo) {
    str = str.trim();
    if (str.endsWith("DIRECTORY")) {
      await resourceFilesRecursive(url + str.split(" ")[1] + '/', files, ext);
    } else if (str.endsWith("FILE")) {
      files.push({
        name: str.split(" ")[1],
        path: url,
        size: str.split(" ")[2],
      });
    }
  }
  /* filesInfo.forEach(async (str: string) => {
    str = str.trim();
    if (str.endsWith("DIRECTORY")) {
      url = url + str.split(" ")[1] + '/';
      await resourceFilesRecursive(url, files, ext);
    }else if (str.endsWith("FILE")) {
      files.push({
        name: str.split(" ")[1],
        path: url,
        size: str.split(" ")[2],
      });
    }
  }); */
  files = ext ? files.filter(e => (e.name as string).endsWith(ext)) : files;
  return files;
}


export function reduceDuplicates(arr: any[]) {
  const obj = {} as any;
  return arr.reduce((total, next) => {
    if (!obj[next]) {
      obj[next] = true;
      total.push(next);
    }
    return total;
  }, [] as any[]
  );
}

const arrs = [
  "DROP INDEX IF EXISTS schema",
  "CREATE TABLE account(serialNumber INT NOT NULL, appID TEXT NOT NULL, secretKey TEXT NOT NULL, UNIQUE(serialNumber, appID), FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "CREATE TABLE charConsum(serialNumber INT NOT NULL PRIMARY KEY, charConsum INT NOT NULL, dataMarker TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "CREATE TABLE accessToken(serialNumber INT NOT NULL, token TEXT NOT NULL UNIQUE, UNIQUE(serialNumber, token), FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "CREATE TABLE alive(serialNumber INT NOT NULL PRIMARY KEY, isAlive INT NOT NULL, FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "CREATE TABLE totalCharConsum(serialNumber INT PRIMARY KEY, totalCharConsum INT NOT NULL DEFAULT 0, dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "DROP TRIGGER IF EXISTS translation_targetTextID_targetText_targetTextID",
  "CREATE TABLE account(serialNumber INT NOT NULL, appID TEXT NOT NULL, secretKey TEXT NOT NULL, charConsum INT NOT NULL, dataMarker TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, isAlive INT NOT NULL, UNIQUE(serialNumber, appID), FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "CREATE TABLE accessToken(serialNumber INT NOT NULL, token TEXT NOT NULL UNIQUE, isAlive INT NOT NULL, UNIQUE(serialNumber, token), FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "CREATE TABLE totalCharConsum(serialNumber INT NOT NULL UNIQUE, totalCharConsum INT NOT NULL, dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)"
];
