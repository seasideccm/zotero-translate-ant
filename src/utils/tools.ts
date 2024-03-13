import { config } from "../../package.json";
import { franc } from "franc-min";
import { addonStorageDir } from "./constant";
import { judgeAsync } from "../modules/ui/uiTools";
import { Cry } from "../modules/crypto";
import { getString } from "./locale";

export function requireModule(moduleName: string) {
  let require = ztoolkit.getGlobal("window").require;
  if (typeof require == "undefined") {
    require = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
      .getService(Components.interfaces.mozIJSSubScriptLoader)
      .loadSubScript('resource://zotero/require.js');
  }
  const module = require(moduleName);
  return module;
}






export function stringToArrayBuffer(str: string) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

export function uint8ArrayToString(buffer: Uint8Array) {
  let str = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    str += String.fromCharCode(buffer[i]);
  }
  return str;
}
export function stringToUint8Array(str: string) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}
export function stringToArrayBuffer2(str: string) {
  return stringToUint8Array(str).buffer;
}
export function arrayBufferTOstring(buffer: ArrayBuffer) {
  return uint8ArrayToString(new Uint8Array(buffer));
}




/**
 * - 添加时间戳确保路径可用 
 * - 没有点且没有扩展名
 * - 或最后一个点之后还有目录分割符，返回path+timeStamp
 * @param path 
 * @returns 
 */
export async function ensureNonePath(path: string) {
  if (!await IOUtils.exists(path)) return path;
  const timeStamp = "_" + Date.now();
  const lastIndexOfDot = path.lastIndexOf(".");

  if (lastIndexOfDot == -1 || path.includes("\\", lastIndexOfDot) || path.includes("/", lastIndexOfDot)) return path + timeStamp;
  return path.substring(0, lastIndexOfDot) + timeStamp + path.substring(lastIndexOfDot);

}
export async function getFilePath(choose: boolean = false) {
  let filePath: string;
  if (choose) return await chooseFilePath();
  return;


}

export function getAddonDir() {
  return PathUtils.join(Zotero.DataDirectory.dir, config.addonRef);
}

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

/**
 * 排序规则，数字、中英、所有语种的规则？？？
 * 有错误 出现undefined
 * 对象的键或值排序，给出各种排序组合
 * @param obj 
 * @param isPad 
 * @returns 
 */
export const objOrder = (obj: { [key: string]: string | number; }, isPad?: boolean) => {
  const objOrdered: {
    objOrderByKey: object[];
    objOrderByKeyReverse: object[];
    objOrderByValue: object[];
    objOrderByValueReverse: object[];
    keysOrderByValues: any[];
    keysOrderByValuesReverse: any[];
    keysOrderBykeys: any[];
    keysOrderBykeysReverse: any[];
    valuesOrderByvalues: any[];
    valuesOrderByvaluesReverse: any[];
    valuesOrderByKeys: any[];
    valuesOrderByKeysReverse: any[];
  } = {
    objOrderByKey: [],
    objOrderByKeyReverse: [],
    objOrderByValue: [],
    objOrderByValueReverse: [],
    keysOrderByValues: [],
    keysOrderByValuesReverse: [],
    keysOrderBykeys: [],
    keysOrderBykeysReverse: [],
    valuesOrderByvalues: [],
    valuesOrderByvaluesReverse: [],
    valuesOrderByKeys: [],
    valuesOrderByKeysReverse: [],
  };

  /* 按字符串排序;
  字符串中有数字，补齐后排序;
  按键排序;
  按值排序; */
  // 以 obj 的键作为字符串数组，根据相应键的值为条件排序

  const keys = Object.keys(obj);

  keys.sort();
  let values = Object.values(obj);
  //全部元素均可转为数字
  const valuesIsNumber = values.filter(e => !isNaN(Number(e))).length == values.length;
  const keysIsNumber = keys.filter(e => !isNaN(Number(e))).length == keys.length;
  const vv: any = {};
  const kk: any = {};
  if (isPad !== false) {
    const reg = [];
    reg.push(/^(\d+)$/m);//纯数字
    reg.push(/^(\d+).*?[^\d]+$/m);//首尾是数字
    reg.push(/^[^\d]+.*?(\d+)$/m);//结尾连续数字
    reg.push(/^[^\d]+.*?(\d+).*?[^\d]+$/m);//首尾非数字
    if (!keysIsNumber) {
      for (const reg0 of reg) {
        //提取reg匹配的内容
        //key一定是字符串
        let numbers: any[] = [];
        numbers = keys.map(k => k.match(reg0)).filter(e => e).map(e => e![1]);
        if (!numbers.length) { continue; }
        numbers = numbers.filter((e: any) => e);
        //确定最长数字串的长度
        const numLength = numbers.reduce((maxLength: number, num: any) => {
          if (num.length > maxLength) {
            maxLength = num.length;
          }
          return maxLength;
        }, 0);
        //对象所有键中的数字调整到等长，以最长的数字为基准，原来的键作为值另存到对象kk中
        keys.filter((k: any, i) => {
          const condition = k.match(reg0);
          if (condition) {
            const s1 = condition[1];
            const s2 = s1.padStart(numLength, '0');
            let temp = k;
            //查看临时对象是否有k对应的值，如果有则给替换后的k赋原值，以便于还原
            if (kk[k]) {
              temp = kk[k];
            }
            k = k.replace(s1, s2);//keys的元素被替换
            keys[i] = k;
            kk[k] = temp;//替换后的keys元素对应的值
          }
        });
      }
    }
    if (!valuesIsNumber) {
      for (const reg0 of reg) {
        //提取reg匹配的内容
        let numbers: any = [];
        values.map(k => {
          k = k.toString();
          const contition = k.match(reg0);
          if (contition == null) {
            return false;
          } else {
            numbers.push(contition[1]);
            return;
          }
        });
        if (!numbers.length) { continue; }
        numbers = numbers.filter((e: any) => e && e);
        //确定最长数字串的长度
        const numLength = numbers.reduce((maxLength: number, num: any) => {
          if (num.length > maxLength) {
            maxLength = num.length;
            return maxLength;
          }
        }, 0);
        values.filter((k: any, i) => {
          k = k.toString();
          const condition = k.match(reg0);
          if (condition) {
            const s1 = condition[1];
            const s2 = s1.padStart(numLength, '0');
            let temp = k;
            if (vv[k]) {
              temp = vv[k];
            }
            k = k.replace(s1, s2);
            values[i] = k;
            vv[k] = temp;
          }
        });
      }
    }
  }

  //按键排序
  if (!keysIsNumber) {
    keys.sort().filter(k => {
      const objTemp: any = {};
      k = kk[k];
      objTemp[k] = obj[k];
      objOrdered.objOrderByKey.push(objTemp);
      objOrdered.keysOrderBykeys.push(k);
      if (valuesIsNumber) {
        objOrdered.valuesOrderByKeys.push(Number(obj[k]));
      } else {
        objOrdered.valuesOrderByKeys.push(obj[k]);
      }
    });
    keys.reverse().filter(k => {
      const objTemp: any = {};
      k = kk[k];
      objTemp[k] = obj[k];
      objOrdered.objOrderByKeyReverse.push(objTemp);
      objOrdered.keysOrderBykeysReverse.push(k);
      if (valuesIsNumber) {
        objOrdered.valuesOrderByKeysReverse.push(Number(obj[k]));
      } else {
        objOrdered.valuesOrderByKeysReverse.push(obj[k]);
      }
    });
  } else {
    keys.sort((a, b) => Number(a) - Number(b)).filter(k => {
      const objTemp: any = {};
      objTemp[k] = obj[k];
      objOrdered.objOrderByKey.push(objTemp);
      objOrdered.keysOrderBykeys.push(Number(k));
      if (valuesIsNumber) {
        objOrdered.valuesOrderByKeys.push(Number(obj[k]));
      } else {
        objOrdered.valuesOrderByKeys.push(obj[k]);
      }
    });
    keys.reverse().filter(k => {
      const objTemp: any = {};
      objTemp[k] = obj[k];
      objOrdered.objOrderByKeyReverse.push(objTemp);
      objOrdered.keysOrderBykeysReverse.push(Number(k));
      if (valuesIsNumber) {
        objOrdered.valuesOrderByKeysReverse.push(Number(obj[k]));
      } else {
        objOrdered.valuesOrderByKeysReverse.push(obj[k]);
      }
    });
  }
  //按值排序,先去重
  values = [...new Set(values)];
  if (!valuesIsNumber) {
    values.sort().filter(e => {
      Object.keys(obj).filter(k => {
        //values的值已经是补齐0后的字符串，故而取出该值对应的字符串
        //由于字符串可能是纯数字转换而来，故而还要和转为数字做比对
        //原始对象有可能部分值为数字，
        if (obj[k] == vv[e] || obj[k] == Number(vv[e])) {
          const objTemp: any = {};
          k = vv[k];
          //取原始键值组成对象
          objTemp[k] = obj[k];
          objOrdered.objOrderByValue.push(objTemp);
          if (keysIsNumber) {
            objOrdered.keysOrderByValues.push(Number(k));
          } else {
            objOrdered.keysOrderByValues.push(k);
          }
          objOrdered.valuesOrderByvalues.push(obj[k]);
        }
      });
    });
    values.reverse().filter(e => {
      Object.keys(obj).filter(k => {
        if (obj[k] == vv[e] || obj[k] == Number(vv[e])) {
          const objTemp: any = {};
          k = vv[k];
          objTemp[k] = obj[k];
          objOrdered.objOrderByValueReverse.push(objTemp);
          if (keysIsNumber) {
            objOrdered.keysOrderByValuesReverse.push(Number(k));
          } else {
            objOrdered.keysOrderByValuesReverse.push(k);
          }
          objOrdered.valuesOrderByvaluesReverse.push(obj[k]);
        }
      });
    });
  } else {
    /* 排序后的值未变，逐一和对象的值对比，
    比对上就和相应的键构成单独的对象纳入数组中，
    一个值可以比对多个对象 */
    values.sort((a, b) => Number(a) - Number(b)).filter(e => {
      Object.keys(obj).filter(k => {
        if (obj[k] == e || obj[k] == Number(e)) {
          const objTemp: any = {};
          objTemp[k] = obj[k];
          objOrdered.objOrderByValue.push(objTemp);
          if (keysIsNumber) {
            objOrdered.keysOrderByValues.push(Number(k));
          } else {
            objOrdered.keysOrderByValues.push(k);
          }
          objOrdered.valuesOrderByvalues.push(Number(obj[k]));
        }
      });
    });
    //values已经排序，仅需翻转
    values.reverse().filter(e => {
      Object.keys(obj).filter(k => {
        if (obj[k] == e || obj[k] == Number(e)) {
          const objTemp: any = {};
          objTemp[k] = obj[k];
          objOrdered.objOrderByValueReverse.push(objTemp);
          if (keysIsNumber) {
            objOrdered.keysOrderByValuesReverse.push(Number(k));
          } else {
            objOrdered.keysOrderByValuesReverse.push(k);
          }
          objOrdered.valuesOrderByvaluesReverse.push(Number(obj[k]));
        }
      });
    });
  }

  // 如果排序后众数对应的高（字符串，在首位）的频次与第二位相同，
  // 则有可能未进行排序，不相等则一定做过排序
  //所有键均为数值数字，否则无法运行
  /// if (Object.keys(num).filter(e => e.match(/^[0-9.]+$/g) != null).length == Object.keys(num).length) {

  return objOrdered;
};




/**
 * 对象深度克隆
 * @param value 
 * @returns 
 */
export function deepClone(value: any) {
  const cache = new WeakMap();
  function _deepClone(value: any) {
    if (value === null || typeof value !== "object") {
      return value;
    }
    if (cache.has(value)) {
      return cache.get(value);
    }
    const result: any = Array.isArray(value) ? [] : {};
    cache.set(value, result);
    for (const key in value) {
      if ((Object.prototype.hasOwnProperty.call(value, key))) {
        result[key] = _deepClone(value[key]);
      }
    }
    return result;
  }
  return _deepClone(value);
}

/**
 * 对象属性不同返回 true，
 * @param obj1 
 * @param obj2 
 * @returns 
 */
export function differObject(obj1: any, obj2: any) {
  const cache1 = new WeakMap();
  const cache2 = new WeakMap();
  function _differObject(obj1: any, obj2: any) {
    if (!compareType(obj1, obj2)) {
      return true;
    }

    if (obj1 === null || typeof obj1 !== "object") {
      if (obj1 != obj2) {
        return true;
      } else {
        return false;
      }
    }
    if (cache1.has(obj1) && cache2.has(obj2)) {
      const cond1 = cache1.get(obj1).parent == cache1.get(obj1).child;
      const cond2 = cache2.get(obj2).parent == cache2.get(obj2).child;
      const cond3 = Object.keys(obj1).length == Object.keys(obj2).length;
      if (cond1 && cond2 && cond3) {
        return false;
      } else {
        return true;
      }
    }
    if ((cache1.has(obj1) && !cache2.has(obj2)) || (!cache1.has(obj1) && cache2.has(obj2))) {
      return true;
    }
    //缓存保存自身循环引用，即obj1=obj1[key]
    /*  let resultObj1: any = Array.isArray(obj1) ? [] : {};
     cache1.set(obj1, resultObj1);
     let resultObj2: any = Array.isArray(obj2) ? [] : {};
     cache2.set(obj2, resultObj2); */

    for (const key in obj1) {
      const cond1 = Object.prototype.hasOwnProperty.call(obj1, key);
      const cond2 = Object.prototype.hasOwnProperty.call(obj2, key);
      if (cond1 && !cond2) return true;
      if (!cond1 && cond2) return true;
      if (cond1 && cond2) {
        const resultObj1 = { parent: obj1, child: obj1[key] };
        cache1.set(obj1, resultObj1);
        const resultObj2 = { parent: obj2, child: obj2[key] };
        cache2.set(obj2, resultObj2);
        if (_differObject(obj1[key], obj2[key])) {
          return true;
        };
      }
    }
    return false;
  }
  const result = _differObject(obj1, obj2);
  return result;
}
function compareType(a: any, b: any) {
  return Object.prototype.toString.call(a) === Object.prototype.toString.call(b);
}
export function test1() {
  const obj1: any = { 1: 1, 2: 2, 3: { 4: 5 } };
  obj1[4] = obj1;
  const obj2: any = { 1: 1, 2: 2, 3: { 4: 5 } };
  obj2[4] = obj2;
  const res = obj1 == obj2;
  showInfo("obj1==obj2: " + res);
  const res2 = differObject(obj1, obj2);
  showInfo("obj1==obj2: " + res);
}


//数组不含对象、集合、字典，函数
/**
 * 不同返回 true
 * @param keys1 
 * @param keys2 
 * @returns 
 */
export function arrayDiffer(keys1: any[], keys2: any[]) {
  if (keys1.length != keys2.length) return true;
  let allKeys = keys1.concat(keys2);
  allKeys = [...new Set(allKeys)];
  const diffKeys = allKeys.filter((e: any) => !keys1.includes(e) || !keys2.includes(e));
  if (diffKeys.length) return true;
  const sameKeys = allKeys.filter(e => !diffKeys.includes(e));
  return false;
}

function arrayRemoveDuplicate(arr: any[]) {
  arr = [...new Set(arr)];
  const obj = {} as any;
  const arrNoDuplicate = arr.reduce((total, next) => {
    if (!obj[next]) {
      obj[next] = true;
      total.push(next);
    }
    return total;
  }, []);
  return arrNoDuplicate;

  /* 对象数组
  const secretkeysingle = arr.reduce((total, next) => {
    if (!obj[next.key]) {
      obj[next.key] = true;
      total.push(next);
    }
    return total;
  }, [] as SecretKey[]
  ); */
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
      //
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



  //
  await Zotero.File.iterateDirectory(dir, onOntry);
  ztoolkit.log(filesPathOrName);
  return filesPathOrName;
}

/**
 * 文件路径格式转换 win2Unix
 * @param filePath 
 * @returns 
 */
export function path2UnixFormat(filePath: string) {
  return filePath.toLocaleLowerCase().replace(/^([\w]):/, "/$1").replace(/[\\]/g, "/");
}

export function arrToObj(keys: string[], values: any[]) {
  const obj = {};
  keys.forEach((key: string, i: number) => {
    if (values[i] == void 0) return;
    Object.assign(obj, { [key]: values[i] });
  });
  return obj;
}

/**
 * get single object or object array
 * @param keys 
 * @returns 
 */
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
  //字母转字节
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


export function getPopupWin(option?: OptionsPopupWin, header?: string) {
  if (!addon.mountPoint["popupWin"] || option) {
    if (!header) header = config.addonName;
    addon.mountPoint["popupWin"] = new ztoolkit.ProgressWindow(header, option);
  }
  return addon.mountPoint["popupWin"];
}
export function showInfo(infos?: string | string[],
  option?: OptionsPopupWin,
  header?: string,
  optionsCreatLine?: OptionsPopupWinCreateLine) {
  const noop = () => { };
  !header ? header = config.addonName : noop;
  // 默认 options = {closeOnClick: true,closeTime: 5000,}
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
  addon.mountPoint["popupWins"] ? addon.mountPoint["popupWins"].push(popupWin) : addon.mountPoint["popupWins"] = [popupWin];
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
  "CREATE TABLE alive(serialNumber INT NOT NULL PRIMARY KEY, usable INT NOT NULL, FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "CREATE TABLE totalCharConsum(serialNumber INT PRIMARY KEY, totalCharConsum INT NOT NULL DEFAULT 0, dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "DROP TRIGGER IF EXISTS translation_targetTextID_targetText_targetTextID",
  "CREATE TABLE account(serialNumber INT NOT NULL, appID TEXT NOT NULL, secretKey TEXT NOT NULL, charConsum INT NOT NULL, dataMarker TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, usable INT NOT NULL, UNIQUE(serialNumber, appID), FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "CREATE TABLE accessToken(serialNumber INT NOT NULL, token TEXT NOT NULL UNIQUE, usable INT NOT NULL, UNIQUE(serialNumber, token), FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "CREATE TABLE totalCharConsum(serialNumber INT NOT NULL UNIQUE, totalCharConsum INT NOT NULL, dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)"
];


export function batchAddEventListener(...args: [element: Node, eventType: string[], callBack: ((...args: any[]) => void)[]][]) {
  for (const arg of args) {
    if (!arg[2]) throw 'At least give one callback';
    if (Array.isArray(arg[2]) && !arg[2].length) throw 'At least give one callback';
    let func;
    if (typeof arg[2] == 'function') func = arg[2];
    for (let i = 0; i < arg[1].length; i++) {
      const event = arg[1][i];
      func = arg[2][i] ? arg[2][i] : func;
      arg[0].addEventListener(event, func!);
    }
  }
}

export function doTryCatch(func: (...args: any[]) => any) {
  return function (...args: any[]) {
    return async function () {
      try {
        if (judgeAsync(func)) {
          return await func(...args);
        } else {
          return func(...args);
        }
        /*  const result = fn(...args);
         if (result.then) {
           return async function () {
             return await result;
           };
         }
         return result; */
      }
      catch (e) {
        ztoolkit.log(e);
        showInfo('Execute failed: ' + args[0]);
        throw e;
      }
    };
  };
}


const getCharCode = function (event: KeyboardEvent) {
  if (event.key) {
    showInfo("event.key: " + "'" + event.key + "'");
    return event.key;
  }
  const charcode = event.charCode;
  if (typeof charcode == "number" && charcode != 0) {
    showInfo("charcode: " + charcode + " || " + "'" + String.fromCharCode(charcode) + "'");
    return charcode;
  } else {
    //在中文输入法下 keyCode == 229 || keyCode == 197(Opera)
    showInfo("keyCode: " + event.keyCode + " || " + "'" + String.fromCharCode(event.keyCode) + "'");
    return event.keyCode;
  }
};

export function batchAddEventListener2(optins: {
  element: Node;
  events: {
    eventType: string;
    callBack: (...args: any[]) => void;
  }[];
}[]) {
  for (const option of optins) {
    for (const event of option.events) {
      option.element.addEventListener(event.eventType, event.callBack);
    }
  }
}

/**
 * 默认目录
 * @param isDir 默认目录
 * @returns 
 */
export async function chooseDirOrFilePath(isDir: boolean = true, defaultPath?: string) {
  const FilePicker = window.require("zotero/modules/filePicker").default;
  const fp = new FilePicker();
  if (isDir) {
    if (Zotero.isMac) {
      fp.init(window, "Select application", fp.modeOpen);
      fp.appendFilter("Mac OS X Application Bundle", "*.app");
    } else {
      fp.init(window, getString("info-SelectDirectory"), fp.modeGetFolder);
    }
  } else {
    fp.init(window, "Select file", fp.modeOpen);
    fp.appendFilters(fp.filterAll);
  }
  fp.displayDirectory = defaultPath || getDefaultPath();
  const rv = await fp.show();
  if (rv !== fp.returnOK && rv !== fp.returnReplace) {
    if (rv == fp.returnCancel) showInfo(getString("info-userCancle"));
    return;
  }
  const message = (isDir ? "Directory " : "File ") + `is ${fp.file}`;
  Zotero.debug(message);
  return fp.file;
}
/**
 * 废弃，请使用 chooseDirOrFilePath
 * @param defaultPath 
 * @returns 
 */
export async function chooseFilePath(defaultPath?: string) {
  //const FilePicker = ztoolkit.getGlobal("require")("zotero/modules/filePicker").default;
  const FilePicker = window.require("zotero/modules/filePicker").default;
  const fp = new FilePicker();

  if (Zotero.isMac) {
    fp.init(window, "Select application", fp.modeOpen);
    fp.appendFilter("Mac OS X Application Bundle", "*.app");
  } else {
    fp.init(window, "Select directory", fp.modeGetFolder);
  }
  fp.displayDirectory = defaultPath || getDefaultPath();
  const rv = await fp.show();
  if (rv !== fp.returnOK && rv !== fp.returnReplace) {
    return;
  }
  Zotero.debug(`File is ${fp.file}`);
  return fp.file;
}
function getDefaultPath() {
  if (Zotero.isWin) {
    return "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs";
  } else {
    return "";
  }
}

export function fileSizeFormat(fileSize: number, idx = 0) {
  const units = ["B", "KB", "MB", "GB"];
  if (fileSize < 1024 || idx === units.length - 1) {
    return fileSize.toFixed(1) + units[idx];
  }
  return fileSizeFormat(fileSize / 1024, ++idx);
}

export async function readJsonFromDisk(filename: string, dir?: string, ext?: string) {
  const path = getPathDir(filename, dir, ext).path;
  if (!await OS.File.exists(path)) { return; }
  const buf = await OS.File.read(path, {});
  const blob = new Blob([buf]);
  const response = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result);
    };
    reader.readAsText(blob);
  });
  return JSON.parse(response as string);
  //特殊符号出乱码return JSON.parse(arrayBufferToString(buf));
}

/**
 * c:\\path\\to\\file.json
 * 
 * /c/path/to/file/json
 * @param path 
 * @returns 
 */
export const getFileInfo = async (path: string) => {
  return await OS.File.stat(path);

};