import { KeyModifier } from "zotero-plugin-toolkit/dist/managers/keyboard";
import { arrsToObjs, batchListen, judgeAsync, showInfo } from "./tools";
import { 百度翻译, 腾讯翻译 } from "../modules/ui/testOpen";
import { getString } from "./locale";
import { config } from "../../package.json";
import { openAddonPrefPane } from "../modules/preferenceScript";
import { fullTextTranslate } from "../modules/translate/fullTextTranslate";
import { getSettingValue, setSettingValue } from "../modules/addonSetting";
import { ColumnOptions } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { getRowString } from "../modules/ui/tableSecretKeys";
import { rowToEdit, stopEvent, tableFactory } from "../modules/ui/tableFactory";
import { getDB } from "../modules/database/database";
import { outside } from "../modules/ui/uiTools";

export function registerPrefsShortcut() {
  ztoolkit.PreferencePane.register({
    pluginID: config.addonID,
    src: rootURI + "chrome/content/shortcut.xhtml",
    label: getString("info-shortcut"),
    defaultXUL: true,
  });
  registerShortcutsCache();
}


const codeMap: any = {//KeyModifier, code值 为键
  ControlLeft: "LCtrl",
  ControlRight: "RCtrl",
  ShiftLeft: "LShift",
  ShiftRight: "RShift",
  AltLeft: "LAlt",
  AltRight: "RAlt",
  OSLeft: "LOS",
  OSRight: "ROS",
};
const codeMapNoLR: any = {//KeyModifier, code值 为键
  ControlLeft: "Ctrl",
  ControlRight: "Ctrl",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  AltLeft: "Alt",
  AltRight: "Alt",
  OSLeft: "OS",
  OSRight: "OS",
};



export async function onShortcutPan() {
  const rawKeyCache: string[] = [];
  const doc = addon.data.prefs?.window?.document;
  if (!doc) {
    return;
  }
  const win = addon.data.prefs!.window;
  if (!win) return;
  const distinguish = doc.querySelector("#distinguishLeftRight") as XUL.Checkbox;
  distinguish.addEventListener("command", async () => {
    await setSettingValue("distinguishLeftRight", Number(distinguish.checked), "shortcut");
  });



  const shortcutElem = doc.querySelector("#input-shortcut") as HTMLInputElement;
  if (!shortcutElem) return;

  function shortcutShow(FuncShortcutMap: any, commandFuncMap: any, commandName: string) {
    for (const [key, value] of FuncShortcutMap) {
      const funcName = key.name;
      if (key == commandFuncMap[commandName]) {
        let shortcutStr = value.shortcutStr as string;
        shortcutStr = shortcutStr.split("+").join(" + ");
        return shortcutStr;
      }
    }

  }


  const FuncShortcutMap: Map<any, any> = addon.mountPoint.FuncShortcutMap;
  const shortcutStr = FuncShortcutMap.get(openAddonPrefPane).shortcutStr as string;
  if (shortcutStr) {
    shortcutElem.placeholder = shortcutStr.split("+").join(" + ");//添加空格
  }
  shortcutElem.addEventListener("focus", (e) => {
    win.addEventListener("keydown", recordKeyPress);
    win.addEventListener("click", shortcutBlur);
  });
  async function recordKeyPress(e: KeyboardEvent) {
    if (e.code && !e.repeat) rawKeyCache.push(e.code);//忽略重复按键
    if (rawKeyCache.length) {
      shortcutElem.value = (await rawConvert(rawKeyCache)).join("+");
    }
  }


  function shortcutBlur(e: Event) {
    if (e.target && e.target == shortcutElem) return;
    shortcutElem.blur();
  }


  shortcutElem.addEventListener("blur", async () => {
    win.removeEventListener("keydown", recordKeyPress);
    win.removeEventListener("click", shortcutBlur);
    shortcutElem.value = (await rawConvert(rawKeyCache)).join("+");
    rawKeyCache.length = 0;
    if (shortcutElem.value && shortcutElem.value != "") {
      setShortcut([[openAddonPrefPane, shortcutElem.value.toLocaleLowerCase(),]]);
    }
  });

  await shortcutTable();
  /*  const length = tableTreeInstance.props.getRowCount();
   for (let i = length - 1; i > 0; i--) {
     tableTreeInstance.scrollToRow(i);
   } */
}




/**
 * 按键代码转为常用字符串格式
 * @param {string[]} rawKeyCache:string[]
 * @returns {string[]}
 */
async function rawConvert(rawKeyCache: string[]): Promise<string[]> {
  let distinguishLeftRight = await getSettingValue("distinguishLeftRight", "shortcut");
  if (distinguishLeftRight === false) distinguishLeftRight = true;//面板元素获取不到值则为 false，可能初始未设置，默认设为 true
  distinguishLeftRight = Boolean(distinguishLeftRight);

  const strConverted: string[] = [];
  const codeMapCurrent = distinguishLeftRight ? codeMap : codeMapNoLR;
  rawKeyCache.forEach(raw => {
    let str: string = codeMapCurrent[raw];
    if (!str && raw.startsWith('Key')) {
      str = raw.replace('Key', '');
    }
    //codeMapCurrent 没有 raw，也不是 KeyX
    if (!str) str = raw;
    strConverted.push(str);
  });
  return strConverted;
}



export function registerShortcutsCache() {
  const rawKeyCache: string[] = [];
  window.addEventListener("keydown", recordKeyPress2);
  function recordKeyPress2(e: KeyboardEvent) {
    if (e.code && !e.repeat) rawKeyCache.push(e.code);
  }

  window.addEventListener("keyup", () => {//发送快捷键，防抖
    if (!rawKeyCache.length) return;
    dispatchDebounced(rawKeyCache);

  });
  const argsArr = [
    // 默认快捷键 测试用
    // 函数，快捷键，参数 n 个
    [fullTextTranslate.translateFT, "lalt+n", "note"],
    [百度翻译, "b+d+f+y",],
    [腾讯翻译, "t+x+f+y",],
    [腾讯翻译, "lctrl+t+x+f+y",],
    [increaseFontSize, "b+d",],
    [decreaseFontSize, "b+x",],
    [openAddonPrefPane, "lctrl+s+z",],
  ];
  if (argsArr.length) {
    setShortcut(argsArr);
  }
}




const dispatchDebounced = Zotero.Utilities.debounce(dispatchShortcuts, 1000);


async function dispatchShortcuts(rawKeyCache: string[]) {
  const shortcutStr = (await rawConvert(rawKeyCache)).join("+").toLocaleLowerCase();
  const FuncShortcutMap = addon.mountPoint.FuncShortcutMap;
  if (!FuncShortcutMap) return;
  for (const [key, value] of FuncShortcutMap) {
    if (value.shortcutStr == shortcutStr) {
      const func = key;
      const funcAgrs = value.funcAgrs;
      if (judgeAsync(func)) {// 判断是否为异步函数
        await func(...funcAgrs);
      } else {
        func(...funcAgrs);
      }
      break;
    }
  }
  rawKeyCache.length = 0;
}

export function setShortcut(argsArr: any[][]) {
  if (!addon.mountPoint.FuncShortcutMap) {
    addon.mountPoint.FuncShortcutMap = new Map();
  }
  const FuncShortcutMap: Map<any, any> = addon.mountPoint.FuncShortcutMap;
  argsArr.forEach((args: any[]) => {
    FuncShortcutMap.set(args.shift(), { shortcutStr: args.shift(), funcAgrs: args });
  });

}


const FONT_SIZES = [
  "0.77", // 10
  "0.85", // 11
  "0.92", // 12
  "1.00", // 13px
  "1.08", // 14
  "1.15", // 15
  "1.23", // 16
  "1.38", // 18
  "1.54", // 20
  "1.85", // 24
];
function increaseFontSize() {
  const fontSize: any = Zotero.Prefs.get("fontSize");
  let lastSize = fontSize;
  // Get the font size above the current one
  for (let i = 0; i < FONT_SIZES.length; i++) {
    if (FONT_SIZES[i] > fontSize) {
      lastSize = FONT_SIZES[i];
      break;
    }
  }
  Zotero.Prefs.set("fontSize", lastSize);
}

function decreaseFontSize() {
  const fontSize: any = Zotero.Prefs.get("fontSize");
  let lastSize = fontSize;
  // Get the highest font size below the current one
  for (let i = FONT_SIZES.length - 1; i >= 0; i--) {
    if (fontSize > FONT_SIZES[i]) {
      lastSize = FONT_SIZES[i];
      break;
    }
  }
  Zotero.Prefs.set("fontSize", lastSize);
}


async function shortcutTable() {

  const commandFuncMap = [
    ["translateNote", fullTextTranslate.translateFT,],
    ["baiduTranslate", 百度翻译,],
    ["tencentTranslate", 腾讯翻译,],
    ["increaseFontSize", increaseFontSize,],
    ["decreaseFontSize", decreaseFontSize,],
    ["settingPane", openAddonPrefPane,],
  ];
  const newArr = commandFuncMap.map(arr => [arr[0]]) as string[][];//仅有命令名称，快捷键留空
  const id = "shortcutTable";
  const containerId = `table-shortcut`;

  async function getRows() {
    //从数据库获取 JSON 
    const commandShortcutJSON = await getSettingValue("commandShortcut", "shortcut");
    if (commandShortcutJSON) {
      const commandShortcut: Shortcut[] = JSON.parse(commandShortcutJSON);//[{command:command,shortcut:shortcut}]
      return commandShortcut;
    }
    //从数组生成数据
    const rows: Shortcut[] = arrsToObjs(["command", "shortcut"])(newArr, true) || [];
    if (rows.length) return rows;
    //默认占位符
    const placeholderRow: Shortcut[] = [{ command: 'command', shortcut: 'shortcut' }];
    return placeholderRow;
  }
  const rows = await getRows();

  //props
  const columnsProp = arrsToObjs([
    "dataKey",
    "label",
    "staticWidth",
    "fixedWidth",
    "flex",
    "width",
  ])(
    [
      ["command", getString("head-command"), false, false, true, 60],
      ["shortcut", getString("head-shortcut"), false, false, true, 400],

    ]
  ) as ColumnOptions[];
  const props: VirtualizedTableProps = {
    id: id,
    columns: columnsProp,
    staticColumns: false,
    showHeader: true,
    multiSelect: true,
    getRowCount: () => rows.length,
    getRowData: handleRowData,
    getRowString: handleGetRowString,
    onFocus: handleFocus,
    onSelectionChange: handleSelectionChange,

  };
  const win = addon.data.prefs!.window;
  const options: TableFactoryOptions = {
    win: win,
    containerId: containerId,
    props: props,
  };

  const tableHelper = await tableFactory(options);
  const tableTreeInstance = tableHelper.treeInstance as VirtualizedTable;
  tableTreeInstance.rows = rows;
  tableTreeInstance._topDiv.addEventListener("blur", async () => {
    await saveShortcutData();
  });
  win.addEventListener("click", clickTableOutsideCommit);
  async function clickTableOutsideCommit(e: MouseEvent) {
    if (!outside(e, tableTreeInstance._topDiv!)) return;
    await tableTreeInstance.saveDate(saveShortcutData);
  }


  function handleRowData(index: number) {
    const row = { ...rows[index] };//解构赋值，如果影响原始数据，改为deepclone
    row.command = getString('info-' + rows[index].command);//单元格显示的内容，多语言支持
    return row;

  }

  function handleGetRowString(index: number) {
    return getRowString(rows, index, tableTreeInstance);
  }



  function handleSelectionChange(selection: TreeSelection) {
    if (tableTreeInstance.dataChangedCache) {
      tableTreeInstance.saveDate(saveShortcutData);
    }

  }



  function handleFocus(e: Event) {
    rowToEdit(tableTreeInstance);
    return false;

  }

  async function saveShortcutData() {
    const rowDatas = tableTreeInstance.rows as Shortcut[];
    if (!rowDatas || rowDatas.length === 0) return;
    const commandShortcutArr = rowDatas?.map((row) => ([row.command, row.shortcut]));
    const json = JSON.stringify(commandShortcutArr);
    await setSettingValue("commandShortcut", json, "shortcut");
  }
}

declare type Shortcut = {
  command: string;
  shortcut: string;
};