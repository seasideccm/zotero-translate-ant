import { config } from "../../package.json";
import { addonDatabaseDir, addonStorageDir } from "./constant";
import { judgeAsync } from "../modules/ui/uiTools";
import { getString } from "./locale";


function getClosestOffset(chars: any, rect: number[]) {
  let dist = Infinity;
  let idx = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const distance = rectsDist(ch.rect, rect);
    if (distance < dist) {
      dist = distance;
      idx = i;
    }
  }
  return idx;
}

function rectsDist([ax1, ay1, ax2, ay2]: number[], [bx1, by1, bx2, by2]: number[],) {
  const left = bx2 < ax1;
  const right = ax2 < bx1;
  const bottom = by2 < ay1;
  const top = ay2 < by1;

  if (top && left) {
    return Math.hypot(ax1 - bx2, ay2 - by1);
  }
  else if (left && bottom) {
    return Math.hypot(ax1 - bx2, ay1 - by2);
  }
  else if (bottom && right) {
    return Math.hypot(ax2 - bx1, ay1 - by2);
  }
  else if (right && top) {
    return Math.hypot(ax2 - bx1, ay2 - by1);
  }
  else if (left) {
    return ax1 - bx2;
  }
  else if (right) {
    return bx1 - ax2;
  }
  else if (bottom) {
    return ay1 - by2;
  }
  else if (top) {
    return by1 - ay2;
  }

  return 0;
}

export function flattenChars(structuredText: any) {
  const flatCharsArray = [];
  for (const paragraph of structuredText.paragraphs) {
    for (const line of paragraph.lines) {
      for (const word of line.words) {
        for (const charObj of word.chars) {
          flatCharsArray.push(charObj);
        }
      }
    }
  }
  return flatCharsArray;
}

function getFlattenedCharsByIndex(pdfPages: any[], pageIndex: number) {
  const structuredText = pdfPages[pageIndex].structuredText;
  return flattenChars(structuredText);
}

/**
 * 计算给定矩形和角度的旋转变换矩阵。
 * 一个圆是360度，2pai弧度.弧度用弧长与半径的比值来表示
 * @param rect 
 * @param degrees 
 * @returns 
 */
export function getRotationTransform(rect: number[], degrees: number) {
  degrees = degrees * Math.PI / 180;//角度转换为弧度
  const cosValue = Math.cos(degrees);
  const sinValue = Math.sin(degrees);
  const m = [cosValue, sinValue, -sinValue, cosValue, 0, 0];
  rect = normalizeRect(rect);
  const x1 = rect[0] + (rect[2] - rect[0]) / 2;
  const y1 = rect[1] + (rect[3] - rect[1]) / 2;
  const rect2 = getAxialAlignedBoundingBox(rect, m);
  const x2 = rect2[0] + (rect2[2] - rect2[0]) / 2;
  const y2 = rect2[1] + (rect2[3] - rect2[1]) / 2;
  const deltaX = x1 - x2;
  const deltaY = y1 - y2;
  m[4] = deltaX;
  m[5] = deltaY;
  return m;
}

/**
 * 规范化矩形
 * @param rect 
 * @returns 
 */
function normalizeRect(rect: number[]) {
  const r = rect.slice(0); // clone rect
  if (rect[0] > rect[2]) {
    r[0] = rect[2];
    r[2] = rect[0];
  }
  if (rect[1] > rect[3]) {
    r[1] = rect[3];
    r[3] = rect[1];
  }
  return r;
}

export function getAxialAlignedBoundingBox(r: number[], m: number[]) {
  const p1 = applyTransform(r, m);
  const p2 = applyTransform(r.slice(2, 4), m);
  const p3 = applyTransform([r[0], r[3]], m);
  const p4 = applyTransform([r[2], r[1]], m);
  return [
    Math.min(p1[0], p2[0], p3[0], p4[0]),
    Math.min(p1[1], p2[1], p3[1], p4[1]),
    Math.max(p1[0], p2[0], p3[0], p4[0]),
    Math.max(p1[1], p2[1], p3[1], p4[1]),
  ];
}

export function getPositionBoundingRect(position: any, pageIndex?: number) {
  // Use nextPageRects
  if (position.rects) {
    let rects = position.rects;
    if (position.nextPageRects && position.pageIndex + 1 === pageIndex) {
      rects = position.nextPageRects;
    }
    if (position.rotation) {
      const rect = rects[0];
      const tm = getRotationTransform(rect, position.rotation);
      const p1 = applyTransform([rect[0], rect[1]], tm);
      const p2 = applyTransform([rect[2], rect[3]], tm);
      const p3 = applyTransform([rect[2], rect[1]], tm);
      const p4 = applyTransform([rect[0], rect[3]], tm);
      return [
        Math.min(p1[0], p2[0], p3[0], p4[0]),
        Math.min(p1[1], p2[1], p3[1], p4[1]),
        Math.max(p1[0], p2[0], p3[0], p4[0]),
        Math.max(p1[1], p2[1], p3[1], p4[1]),
      ];
    }
    return [
      Math.min(...rects.map((x: number[]) => x[0])),
      Math.min(...rects.map((x: number[]) => x[1])),
      Math.max(...rects.map((x: number[]) => x[2])),
      Math.max(...rects.map((x: number[]) => x[3]))
    ];
  }
  else if (position.paths) {
    const x = position.paths[0][0];
    const y = position.paths[0][1];
    const rect = [x, y, x, y];
    for (const path of position.paths) {
      for (let i = 0; i < path.length - 1; i += 2) {
        const x = path[i];
        const y = path[i + 1];
        rect[0] = Math.min(rect[0], x);
        rect[1] = Math.min(rect[1], y);
        rect[2] = Math.max(rect[2], x);
        rect[3] = Math.max(rect[3], y);
      }
    }
    return rect;
  }
}

export function getSortIndex(pdfPages: any, position: any) {
  const { pageIndex } = position;
  let offset = 0;
  let top = 0;
  if (pdfPages[position.pageIndex]) {
    const chars = getFlattenedCharsByIndex(pdfPages, position.pageIndex);
    const viewBox = pdfPages[position.pageIndex].viewBox;
    const rect = getPositionBoundingRect(position)!;
    offset = chars.length && getClosestOffset(chars, rect) || 0;
    const pageHeight = viewBox[3] - viewBox[1];
    top = pageHeight - rect[3];
    if (top < 0) {
      top = 0;
    }
  }
  return [
    pageIndex.toString().slice(0, 5).padStart(5, '0'),
    offset.toString().slice(0, 6).padStart(6, '0'),
    Math.floor(top).toString().slice(0, 5).padStart(5, '0')
  ].join('|');
}


/**
 * 
 * @param rect 
 * @param view 
 * @param tolerancePercent 0-100
 * @returns 
 */
export function isExceedBoundary(rect: number[], view: number[], tolerancePercent: number) {
  tolerancePercent = tolerancePercent / 100;
  return (rect[0] < view[2] * tolerancePercent || rect[0] > view[2] * (1 - tolerancePercent)
    || rect[1] < view[3] * tolerancePercent || rect[1] > view[3] * (1 - tolerancePercent)
    || rect[2] < view[2] * tolerancePercent || rect[2] > view[2] * (1 - tolerancePercent)
    || rect[3] < view[3] * tolerancePercent || rect[3] > view[3] * (1 - tolerancePercent));
}

/**
 * 判断矩形是否相邻，可设定容差，单位 mm
 * @param rect1 
 * @param rect2 
 * @param tolerance_mm 
 * @returns 
 */
export function adjacentRect(rect1: number[], rect2: number[], tolerance_mm?: number) {
  function correctEdgeOrder(rect: number[]) {
    let temp: number;
    if (rect[0] > rect[2]) {
      temp = rect[0];
      rect[0] = rect[2];
      rect[2] = temp;
    }
    if (rect[1] > rect[3]) {
      temp = rect[1];
      rect[1] = rect[3];
      rect[3] = temp;
    }
    return rect;
  }
  rect1 = correctEdgeOrder(rect1);
  rect2 = correctEdgeOrder(rect2);

  tolerance_mm = tolerance_mm || 0;
  if (
    !(
      rect2[0] > rect1[2] ||
      rect2[2] < rect1[0] ||
      rect2[1] > rect1[3] ||
      rect2[3] < rect1[1]
    )
  ) {
    return false;
  } else {
    return !(
      (rect2[0] >= rect1[2] && rect2[0] - rect1[2] > tolerance_mm) ||
      (rect2[2] <= rect1[0] && rect1[0] - rect2[2] > tolerance_mm) ||
      (rect2[1] >= rect1[3] && rect2[1] - rect1[3] > tolerance_mm) ||
      (rect2[3] <= rect1[1] && rect1[1] - rect2[3] > tolerance_mm)
    );
  }

  //未考虑旋转

}

/**
 * 
 * @param rect1  rectangle [x1, y1, x2, y2]
 * @param rect2  rectangle [x1, y1, x2, y2]
 * @returns 
 */
export function quickIntersectRect(rect1: number[], rect2: number[]) {
  return !(
    rect2[0] > rect1[2]
    || rect2[2] < rect1[0]
    || rect2[1] > rect1[3]
    || rect2[3] < rect1[1]
  );
}


/**
 * 
 * @param p pdfPoint([x1,y1,x2,y2])
 * @param m transform
 * @returns pdfRect([x1,y1,x2,y2])
 */
export function getPosition(p: number[], m: number[]) {
  if (!m || !m.length) {
    m = [1, 0, 0, 1, 0, 0];
  }
  const p1 = applyTransform([p[0], p[1]], m);
  const p2 = applyTransform([p[2], p[3]], m);
  return [p1[0], p1[1], p2[0], p2[1]];
}


/**
 * 拓展两个矩形的边界 如果坐标超出边界，取边界值
 * @param r1 
 * @param rect2 
 * @param page 
 * @returns 
 */
export function expandBoundingBox(rect1: number[], rect2: number[], viewBox: number[]) {
  /* let [left, bottom, right, top] = page.originalPage.viewport.viewBox;
  originalPage==pageView==_pages[i]
  F:\zotero\zotero-client\reader\src\pdf\pdf-view.js */
  const [left, bottom, right, top] = viewBox;
  const rect: number[] = [];
  rect[0] = Math.max(Math.min(rect1[0], rect2[0]), left);
  rect[1] = Math.max(Math.min(rect1[1], rect2[1]), bottom);
  rect[2] = Math.min(Math.max(rect1[2], rect2[2]), right);
  rect[3] = Math.min(Math.max(rect1[3], rect2[3]), top);
  //rect.push(r0, rect1, rect2, rect3);

  return [Math.max(Math.min(rect1[0], rect2[0]), left),
  Math.max(Math.min(rect1[1], rect2[1]), bottom),
  Math.min(Math.max(rect1[2], rect2[2]), right),
  Math.min(Math.max(rect1[3], rect2[3]), top)];
}


export function applyTransform(p: number[], m: number[]) {
  const xt = p[0] * m[0] + p[1] * m[2] + m[4];
  const yt = p[0] * m[1] + p[1] * m[3] + m[5];
  return [xt, yt];
}

export const invertKeyValues = (obj: any) =>
  Object.keys(obj).reduce((acc: any, key: string) => {
    acc[obj[key]] = key;
    return acc;
  }, {});

export function utf8Encode(string: string) {
  string = string.replace(/\r\n/g, "\n");
  let utftext = "";

  for (let n = 0; n < string.length; n++) {
    const c = string.charCodeAt(n);

    if (c < 128) {
      utftext += String.fromCharCode(c);
    } else if (c > 127 && c < 2048) {
      utftext += String.fromCharCode((c >> 6) | 192);
      utftext += String.fromCharCode((c & 63) | 128);
    } else {
      utftext += String.fromCharCode((c >> 12) | 224);
      utftext += String.fromCharCode(((c >> 6) & 63) | 128);
      utftext += String.fromCharCode((c & 63) | 128);
    }
  }

  return utftext;
}
export function showThrowInfo(fltItem: string) {
  const info = getString(fltItem);
  showInfo(info);
  throw info;
}

export function timer() {
  const time1 = new Date().getTime();
  return () => {
    const time2 = new Date().getTime();
    return time2 - time1;
  };
}

export function requireModule(moduleName: string) {
  let require = ztoolkit.getGlobal("window").require;
  if (typeof require == "undefined") {
    require = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
      .getService(Components.interfaces.mozIJSSubScriptLoader)
      .loadSubScript("resource://zotero/require.js");
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
  let str = "";
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
 * - 时间戳添加在文件名末尾
 * @param path
 * @returns
 */
export async function ensureNonePath(path: string, win?: Window) {
  if (!(await IOUtils.exists(path))) return path;
  const cf = confirmWin(path + "\n文件已存在，是否为文件名添加时间戳？", "win");
  if (!cf) {
    showInfo(getString("info-userCancle"));
    throw new Error(getString("info-userCancle") + "为文件名添加时间戳？");
  }

  const timeStamp = "_" + Date.now();
  const lastIndexOfDot = path.lastIndexOf(".");

  if (
    lastIndexOfDot == -1 ||
    path.includes("\\", lastIndexOfDot) ||
    path.includes("/", lastIndexOfDot)
  )
    return path + timeStamp;
  return (
    path.substring(0, lastIndexOfDot) +
    timeStamp +
    path.substring(lastIndexOfDot)
  );
}
export function confirmWin(tip: string, win: "win" | "window" = "window") {
  const winPref = addon.data.prefs?.window;
  const winToShow = win ? (winPref ? winPref : window) : window;
  winToShow.focus();
  return winToShow.confirm(tip);
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
  const diffKeys = allKeys.filter(
    (e) => !keys1.includes(e) || !keys2.includes(e),
  );
  const sameKeys = allKeys.filter((e) => !diffKeys.includes(e));
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
export const objOrder = (
  obj: { [key: string]: string | number; },
  isPad?: boolean,
) => {
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
  const valuesIsNumber =
    values.filter((e) => !isNaN(Number(e))).length == values.length;
  const keysIsNumber =
    keys.filter((e) => !isNaN(Number(e))).length == keys.length;
  const vv: any = {};
  const kk: any = {};
  if (isPad !== false) {
    const reg = [];
    reg.push(/^(\d+)$/m); //纯数字
    reg.push(/^(\d+).*?[^\d]+$/m); //首尾是数字
    reg.push(/^[^\d]+.*?(\d+)$/m); //结尾连续数字
    reg.push(/^[^\d]+.*?(\d+).*?[^\d]+$/m); //首尾非数字
    if (!keysIsNumber) {
      for (const reg0 of reg) {
        //提取reg匹配的内容
        //key一定是字符串
        let numbers: any[] = [];
        numbers = keys
          .map((k) => k.match(reg0))
          .filter((e) => e)
          .map((e) => e![1]);
        if (!numbers.length) {
          continue;
        }
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
            const s2 = s1.padStart(numLength, "0");
            let temp = k;
            //查看临时对象是否有k对应的值，如果有则给替换后的k赋原值，以便于还原
            if (kk[k]) {
              temp = kk[k];
            }
            k = k.replace(s1, s2); //keys的元素被替换
            keys[i] = k;
            kk[k] = temp; //替换后的keys元素对应的值
          }
        });
      }
    }
    if (!valuesIsNumber) {
      for (const reg0 of reg) {
        //提取reg匹配的内容
        let numbers: any = [];
        values.map((k) => {
          k = k.toString();
          const contition = k.match(reg0);
          if (contition == null) {
            return false;
          } else {
            numbers.push(contition[1]);
            return;
          }
        });
        if (!numbers.length) {
          continue;
        }
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
            const s2 = s1.padStart(numLength, "0");
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
    keys.sort().filter((k) => {
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
    keys.reverse().filter((k) => {
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
    keys
      .sort((a, b) => Number(a) - Number(b))
      .filter((k) => {
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
    keys.reverse().filter((k) => {
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
    values.sort().filter((e) => {
      Object.keys(obj).filter((k) => {
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
    values.reverse().filter((e) => {
      Object.keys(obj).filter((k) => {
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
    values
      .sort((a, b) => Number(a) - Number(b))
      .filter((e) => {
        Object.keys(obj).filter((k) => {
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
    values.reverse().filter((e) => {
      Object.keys(obj).filter((k) => {
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
      if (Object.prototype.hasOwnProperty.call(value, key)) {
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
    if (
      (cache1.has(obj1) && !cache2.has(obj2)) ||
      (!cache1.has(obj1) && cache2.has(obj2))
    ) {
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
        }
      }
    }
    return false;
  }
  const result = _differObject(obj1, obj2);
  return result;
}
function compareType(a: any, b: any) {
  return (
    Object.prototype.toString.call(a) === Object.prototype.toString.call(b)
  );
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
 * @param array1
 * @param array2
 * @returns
 */
function isDiffer(array1: any[], array2: any[]) {
  if (array1.length != array2.length) return true;
  if (minus(array1, array2).length) return true;
  let allKeys = array1.concat(array2);
  allKeys = [...new Set(allKeys)];
  const diffKeys = allKeys.filter(
    (e: any) => !array1.includes(e) || !array2.includes(e),
  );
  if (diffKeys.length) return diffKeys;
  return false;
}

/**
 * 对象数组，不同返回 true
 * @param arr1
 * @param arr2
 * @returns
 */
export function objArrDiffer(arr1: any[], arr2: any[]) {
  for (let i = 0; i < arr1.length; i++) {
    if (differObject(arr1[i], arr2[i])) {
      return true;
    }
  }
  return false;
}

/**
 * 交集
 * @param a
 * @param b
 * @returns
 */
function intersect(a: any[], b: any[]) {
  const sb = new Set(b);
  return a.filter((x) => sb.has(x));
}

/**
 * 差集
 * @param a
 * @param b
 * @returns
 */
function minus(a: any[], b: any[]) {
  const sb = new Set(b);
  return a.filter((x) => !sb.has(x));
}

/**
 * 补集
 * @param a
 * @param b
 * @returns
 */
function complement(a: any[], b: any[]) {
  const sa = new Set(a);
  const sb = new Set(b);
  return [...a.filter((x) => !sb.has(x)), ...b.filter((x) => !sa.has(x))];
}
/**
 * 并集
 * @param a
 * @param b
 * @returns
 */
function union(a: any[], b: any[]) {
  return Array.from(new Set([...a, ...b]));
}

export const arrayUtils = {
  intersect,
  minus,
  complement,
  union,
  isDiffer,
};

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
    if (
      (areObjects && !deepEqual(val1, val2)) ||
      (!areObjects && val1 !== val2)
    ) {
      return false;
    }
  }

  return true;
}

function isObject(object: any) {
  return object != null && typeof object === "object";
}

/**
 * 递归获取文件路径
 * @param dirPath
 * @param parents
 * @param files
 * @returns
 */
export async function collectFilesRecursive(
  dirPath: string,
  files: any[] = [],
) {
  const onEntry = async ({
    isDir,
    _isSymlink,
    name,
    path,
  }: {
    isDir: boolean;
    _isSymlink: boolean;
    name: string;
    path: string;
  }) => {
    if (isDir) {
      //parents.push(name)
      await collectFilesRecursive(path, files);
    }
    // TODO: Also check for hidden file attribute on windows?
    else if (!name.startsWith(".")) {
      //@ts-ignore has
      files.push({ path, name });
    }
  };
  await Zotero.File.iterateDirectory(dirPath, onEntry);
  ztoolkit.log(files);
  return files;
}

/**
 * 获取文件夹中的文件名或路径
 * @param dir
 * @param option
 * @returns
 */

/**
 *
 * @param dir
 * @param pathOrName 默认 "path"
 * @param subDirectory 默认 false
 * @param extension 默认 false
 * @returns
 */
export async function getFiles(
  dir: string,
  pathOrName: "path" | "name" = "path",
  subDirectory: boolean = false,
  extension: boolean = false,
) {
  const filesName: string[] = [];
  const filesPath: string[] = [];
  async function onOntry(entry: any) {
    if (entry.isDir) {
      if (subDirectory) {
        await Zotero.File.iterateDirectory(entry.path, onOntry);
      }
    } else {
      if (!entry.name) return;
      filesPath.push(entry.path);

      if (extension) {
        filesName.push(entry.name);
      } else {
        const nameNoExt = fileNameNoExt(entry.name);
        nameNoExt && filesName.push(nameNoExt);
      }
    }
  }
  await Zotero.File.iterateDirectory(dir, onOntry);
  if (pathOrName == "path") {
    return filesPath;
  } else {
    return filesName;
  }
}
export async function testIO() {
  const path = await chooseDirOrFilePath("dir");
  const childs = await IOUtils.getChildren(path, { ignoreAbsent: true });
  ztoolkit.log(childs);
}

/**
 * 文件路径格式转换 win2Unix
 * @param filePath
 * @returns
 */
export function path2UnixFormat(filePath: string) {
  return filePath
    .toLocaleLowerCase()
    .replace(/^([\w]):/, "/$1")
    .replace(/[\\]/g, "/");
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
    if (!Array.isArray(values[0])) return [arrToObj(keys, values)];
    return values.map((value) => arrToObj(keys, value)) as any[];
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

export async function readImage(path: string) {
  if (!(await IOUtils.exists(path))) {
    return;
  }
  const buf = await IOUtils.read(path);

  const imgWidthHeight = ReadPNG(buf);
  const blob = new Blob([buf]);
  const temp = PathUtils.filename(path).split(".");
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
  //前后有引号（', "）
  if (fileNameOrPath.startsWith("'") || fileNameOrPath.startsWith('"')) {
    fileNameOrPath = fileNameOrPath.replace(/["']/g, "");
  }
  // 兼容非完整目录
  try {
    return PathUtils.filename(fileNameOrPath).split(".").shift();
  } catch (e: any) {
    return fileNameOrPath.split(".").shift();
  }
}

export function getExt(fileNameOrPath: string) {
  if (fileNameOrPath.lastIndexOf(".") != -1)
    return fileNameOrPath.substring(fileNameOrPath.lastIndexOf(".") + 1);
}

export function getDir(fileNameOrPath: string) {
  return PathUtils.parent(fileNameOrPath);
}

export async function saveImage(dataURL: string, outputPath: string) {
  const temp = base64ToBytes(dataURL);
  if (!temp) return;
  const u8arr = temp.u8arr;
  const mime = temp.mime;
  //事先建好目录可以保存，图片大小适中
  const dir = outputPath.replace(/[^/\\]+$/m, "");
  if (!(await IOUtils.exists(dir))) {
    await IOUtils.makeDirectory(dir);
  }

  await IOUtils.write(outputPath, u8arr);

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

/**
 * 
 * @param infos 
 * @param option 
 * @param header 
 * @param optionsCreatLine 
 * @param log 
 * @returns 
 */
export function showInfo(
  infos?: string | string[],
  option?: OptionsPopupWin,
  header?: string,
  optionsCreatLine?: OptionsPopupWinCreateLine,
  log?: boolean
) {

  const noop = () => { };
  !header ? (header = config.addonName) : noop;
  // 默认 options = {closeOnClick: true,closeTime: 5000,}
  const popupWin = new ztoolkit.ProgressWindow(header, option);
  if (!infos && (!optionsCreatLine || !optionsCreatLine.text)) {
    throw "info and optionsCreatLine.text can't all empty";
  }
  if (!optionsCreatLine) optionsCreatLine = {};
  if (!optionsCreatLine.type) optionsCreatLine.type = "default";
  if (infos) {
    if (!Array.isArray(infos)) infos = [infos];
    for (const info of infos) {
      if (log) ztoolkit.log(info);
      optionsCreatLine.text = info;
      popupWin.createLine(optionsCreatLine);
    }
  } else {
    popupWin.createLine(optionsCreatLine);
  }
  popupWin.show();
  addon.mountPoint["popupWins"]
    ? addon.mountPoint["popupWins"].push(popupWin)
    : (addon.mountPoint["popupWins"] = [popupWin]);
  return popupWin;
}



export async function saveJsonToDisk(
  obj: any,
  filename: string,
  dir?: string,
  ext?: string,
) {
  //const objJson = JSON.stringify(obj);
  const tempObj = getPathDir(filename, dir, ext);
  const path = tempObj.path;
  dir = tempObj.dir;
  if (!(await IOUtils.exists(dir))) {
    await IOUtils.makeDirectory(dir);
  }
  await IOUtils.writeJSON(path, obj);
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
  dir = dir || addonDatabaseDir;
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
  dir = PathUtils.normalize(dir);
  const path = PathUtils.join(dir, filename + ext);
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
    if (!(await IOUtils.exists(dir))) {
      ztoolkit.log(`${dir} does not exist`);
      return files;
    }
    await Zotero.File.iterateDirectory(dir, onEntry);
    files.sort((a, b) => {
      return b.lastModified - a.lastModified;
    });
  } catch (e: any) {
    Zotero.logError(e);
  }
  for (let i = 0; i < files.length; i++) {
    const info = await OS.File.stat(files[i].path);

    files[i].size = info.size;
    files[i].lastModified = info.lastModificationDate;
  }
  files.push({
    name: "dirs",
    dirs: dirs,
  });
  files = ext ? files.filter((e) => (e.name as string).endsWith(ext)) : files;
  ztoolkit.log(files);
  return files;
}

export async function resourceFilesRecursive(
  url: string = `chrome://${config.addonRef}/content/schema/`,
  files: any[] = [],
  ext?: string,
) {
  const resFetch = await fetch(url);
  const req = await resFetch.text();
  //build后出错，zotero.http出错，channel isFile=false 而 dev 下 isFile=true ？？
  //const req = await Zotero.File.getResourceAsync(url);
  const filesInfo = req.split("\n");
  for (let str of filesInfo) {
    str = str.trim();
    const reg1 = /\/\/$/m;
    let urlSub = url + str.split(" ")[1] + "/";
    urlSub = urlSub.replace(reg1, "/");
    if (str.endsWith("DIRECTORY")) {
      await resourceFilesRecursive(urlSub, files, ext);
    } else if (str.endsWith("FILE")) {
      files.push({
        name: str.split(" ")[1],
        path: url,
        size: str.split(" ")[2],
      });
    }
  }

  files = ext ? files.filter((e) => (e.name as string).endsWith(ext)) : files;
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
  }, [] as any[]);
}

const arrs = [
  "DROP INDEX IF EXISTS schema",
  "CREATE TABLE account(serialNumber INT NOT NULL, appID TEXT NOT NULL, secretKey TEXT NOT NULL, UNIQUE(serialNumber, appID), FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "CREATE TABLE charConsum(serialNumber INT NOT NULL PRIMARY KEY, charConsum INT NOT NULL, dateMarker TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "CREATE TABLE accessToken(serialNumber INT NOT NULL, token TEXT NOT NULL UNIQUE, UNIQUE(serialNumber, token), FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "CREATE TABLE alive(serialNumber INT NOT NULL PRIMARY KEY, usable INT NOT NULL, FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "CREATE TABLE totalCharConsum(serialNumber INT PRIMARY KEY, totalCharConsum INT NOT NULL DEFAULT 0, dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "DROP TRIGGER IF EXISTS translation_targetTextID_targetText_targetTextID",
  "CREATE TABLE account(serialNumber INT NOT NULL, appID TEXT NOT NULL, secretKey TEXT NOT NULL, charConsum INT NOT NULL, dateMarker TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, usable INT NOT NULL, UNIQUE(serialNumber, appID), FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "CREATE TABLE accessToken(serialNumber INT NOT NULL, token TEXT NOT NULL UNIQUE, usable INT NOT NULL, UNIQUE(serialNumber, token), FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
  "CREATE TABLE totalCharConsum(serialNumber INT NOT NULL UNIQUE, totalCharConsum INT NOT NULL, dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE)",
];

/**
 *
 * @param args
 */
export function batchListen(
  ...args: [element: Node, eventType: string[], callBack: Func[]][]
) {
  for (const arg of args) {
    if (!arg[2]) throw "At least give one callback";
    if (Array.isArray(arg[2]) && !arg[2].length)
      throw "At least give one callback";
    let func;
    if (typeof arg[2] == "function") func = arg[2];
    for (let i = 0; i < arg[1].length; i++) {
      const event = arg[1][i];
      func = arg[2][i] ? arg[2][i] : func;
      arg[0].addEventListener(event, func!);
    }
  }
}

export function doTryCatch(func: Func) {
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
      } catch (e) {
        ztoolkit.log(e);
        showInfo("Execute failed: " + args[0]);
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
    showInfo(
      "charcode: " +
      charcode +
      " || " +
      "'" +
      String.fromCharCode(charcode) +
      "'",
    );
    return charcode;
  } else {
    //在中文输入法下 keyCode == 229 || keyCode == 197(Opera)
    showInfo(
      "keyCode: " +
      event.keyCode +
      " || " +
      "'" +
      String.fromCharCode(event.keyCode) +
      "'",
    );
    return event.keyCode;
  }
};

/**
 * 自动打开选中文件的上级目录，等待再次选择
 */
export async function chooseFiles(dir?: string) {
  const TIP =
    "Please select Files. Click Cancle will return files already selected.";
  const temp: string[] = [];
  while (TIP) {
    let defaultDir = temp.length
      ? PathUtils.parent(temp.slice(-1)[0])
      : undefined;
    if (!defaultDir) defaultDir = dir ? dir : addonDatabaseDir;
    const paths = await chooseDirOrFilePath("files", defaultDir, TIP);
    if (!paths || !paths.length) break;
    typeof paths == "string" ? temp.push(paths) : temp.push(...paths); //undefine 无法 ... 解构
    const confirm = window.confirm(
      "是否继续选择文件？\n点击确定继续选择文件。\n点击取消结束选择",
    );
    if (!confirm) break;
  }
  return temp;
}

export async function chooseDirOrFilePath(
  filesOrDir: "files",
  defaultPath?: string,
  windowTip?: string,
): Promise<string[]>;
export function chooseDirOrFilePath(
  filesOrDir: "file" | "dir",
  defaultPath?: string,
  windowTip?: string,
): Promise<string>;

/**
 * 默认目录
 * @param isDir 默认目录
 * @returns
 */
export async function chooseDirOrFilePath(
  filesOrDir: "files" | "file" | "dir" = "dir",
  defaultPath?: string,
  windowTip?: string,
) {
  //FilePicker.prototype.modeOpen = 0;
  //FilePicker.prototype.modeSave = 1;
  //FilePicker.prototype.modeGetFolder = 2;
  //FilePicker.prototype.modeOpenMultiple = 3;
  //const FilePicker = window.require("zotero/modules/filePicker").default;
  const { FilePicker } = ChromeUtils.importESModule(
    "chrome://zotero/content/modules/filePicker.mjs",
  );
  const fp = new FilePicker();
  windowTip = windowTip
    ? windowTip
    : filesOrDir == "dir"
      ? getString("info-SelectDirectory")
      : "Select Directory";
  if (filesOrDir == "dir") {
    if (Zotero.isMac) {
      fp.init(window, windowTip, fp.modeOpen);
      fp.appendFilter("Mac OS X Application Bundle", "*.app");
    } else {
      fp.init(window, windowTip, fp.modeGetFolder);
    }
  } else if (filesOrDir == "files") {
    fp.init(window, windowTip, fp.modeOpenMultiple);
    fp.appendFilters(fp.filterAll);
  } else {
    fp.init(window, windowTip, fp.modeOpen);
    fp.appendFilters(fp.filterAll);
  }

  fp.displayDirectory = defaultPath || getDefaultPath();
  const rv = await fp.show();
  if (rv !== fp.returnOK && rv !== fp.returnReplace) {
    if (rv == fp.returnCancel) showInfo(getString("info-userCancle"));
    return;
  }
  const message =
    filesOrDir == "dir"
      ? "Directory " + `is ${fp.file}`
      : filesOrDir == "files"
        ? "Files " + `are ${fp.files}`
        : "File " + `is ${fp.file}`;

  Zotero.debug(message);
  if (filesOrDir == "files") return fp.files as string[];
  return fp.file as string;
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

export async function readJsonFromDisk(
  filename: string,
  dir?: string,
  ext?: string,
) {
  const path = getPathDir(filename, dir, ext).path;
  if (!(await IOUtils.exists(path))) {
    return;
  }
  const buf = await IOUtils.read(path);
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

export async function deleteCacheOrFile(filename: string,
  dir?: string,
  ext?: string,) {
  const path = getPathDir(filename, dir, ext).path;
  if (await IOUtils.exists(path)) {
    IOUtils.remove(path);
    return true;
  }

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

/**
 *
 * @param type 默认"active"
 * @returns
 */
export function getWindow(
  type: "pref" | "zoteroPane" | "active" | "recent" = "zoteroPane",
) {
  let winSelected;

  switch (type) {
    case "pref":
      winSelected = addon.data.prefs?.window;
      break;
    case "zoteroPane":
      winSelected = window;
      break;
    case "active":
      winSelected = Services.ww.activeWindow;
      break;
    case "recent":
      winSelected = Services.wm.getMostRecentWindow("navigator:browser");
      break;
  }

  if (!winSelected) {
    winSelected = Services.appShell.hiddenDOMWindow;
  }
  if (!winSelected) {
    ztoolkit.log("Parent window not available");
  }
  return winSelected as Window;
}
