import { KeyModifier } from "zotero-plugin-toolkit/dist/managers/keyboard";
import { arrsToObjs, showInfo } from "./tools";
import { 百度翻译, 腾讯翻译 } from "../modules/ui/testOpen";
import { getString } from "./locale";
import { config } from "../../package.json";
import { openAddonPrefPane } from "../modules/preferenceScript";
import { judgeAsync } from "../modules/ui/uiTools";
import { fullTextTranslate } from "../modules/translate/fullTextTranslate";
import { getSettingValue, setSettingValue } from "../modules/addonSetting";
import { ColumnOptions } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { getRowString, tableFactory } from "../modules/ui/tableSecretKeys";

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



  const shortcut = doc.querySelector("#input-shortcut") as HTMLInputElement;
  if (!shortcut) return;

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


  const FuncShortcutMap = addon.mountPoint.FuncShortcutMap;
  const shortcutStr = FuncShortcutMap.get(openAddonPrefPane).shortcutStr as string;
  if (shortcutStr) {
    shortcut.placeholder = shortcutStr.split("+").join(" + ");
  }
  shortcut.addEventListener("focus", (e) => {
    win.addEventListener("keydown", recordKeyPress);
    win.addEventListener("click", shortcutBlur);
  });
  async function recordKeyPress(e: KeyboardEvent) {
    if (e.code && !e.repeat) rawKeyCache.push(e.code);
    if (rawKeyCache.length) {
      shortcut.value = (await rawConvert(rawKeyCache)).join("+");
    }
  }


  function shortcutBlur(e: Event) {
    if (e.target && e.target != shortcut) {
      shortcut.blur();
    }
  }


  shortcut.addEventListener("blur", async () => {
    win.removeEventListener("keydown", recordKeyPress);
    win.removeEventListener("click", shortcutBlur);
    shortcut.value = (await rawConvert(rawKeyCache)).join("+");
    rawKeyCache.length = 0;
    if (shortcut.value && shortcut.value != "") {
      setShortcut([[openAddonPrefPane, shortcut.value.toLocaleLowerCase(),]]);
    }
  });

  await shortcutTable();
}



async function rawConvert(rawKeyCache: string[]) {
  let distinguishLeftRight = await getSettingValue("distinguishLeftRight", "shortcut");
  if (distinguishLeftRight === false) distinguishLeftRight = true;
  distinguishLeftRight = Boolean(distinguishLeftRight);

  const strConverted: string[] = [];
  const codeMapCurrent = distinguishLeftRight ? codeMap : codeMapNoLR;
  rawKeyCache.forEach(raw => {
    let str: string = codeMapCurrent[raw];
    if (!str && raw.startsWith('Key')) {
      str = raw.replace('Key', '');
    }
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
    addon.mountPoint["FuncShortcutMap"] = new Map();
  }
  const FuncShortcutMap = addon.mountPoint.FuncShortcutMap;
  argsArr.forEach((args: any[]) => {
    const func = args.shift();
    const shortcutStr = args.shift();
    const funcAgrs = args;

    FuncShortcutMap.set(func, { shortcutStr: shortcutStr, funcAgrs: funcAgrs });
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
  const newArr = commandFuncMap.map(arr => [arr[0]]) as string[][];
  const id = "shortcutTable";
  const containerId = `table-shortcut`;
  async function getRows() {
    const commandShortcutJSON = await getSettingValue("commandShortcut", "shortcut");
    if (commandShortcutJSON) {
      const commandShortcut = JSON.parse(commandShortcutJSON);//[{command:command,shortcut:shortcut}]
      return commandShortcut;
    }
    const rows: any[] = arrsToObjs(["command", "shortcut"])(newArr, true) || [];
    if (rows.length) return rows;
    return [{ command: 'command', shortcut: 'shortcut' }];
  }
  const rows: any[] = await getRows();

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
    getRowData: handleRowData,//(index: number) => rows[index],
    getRowString: handleGetRowString,
  };

  const options: TableFactoryOptions = {
    win: addon.data.prefs!.window,
    containerId: containerId,
    props: props,
  };

  const tableHelper = await tableFactory(options);
  const tableTreeInstance = tableHelper.treeInstance as VTable; //@ts-ignore has
  //tableTreeInstance._jsWindow.innerElem.style.width = "1400px";
  tableTreeInstance.scrollToRow(rows.length - 1);
  tableTreeInstance._topDiv?.scrollIntoView(false);

  function handleRowData(index: number) {
    const row = { ...rows[index] };
    row.command = getString('info-' + rows[index].command);
    return row;

  }

  function handleGetRowString(index: number) {
    return getRowString(rows, index, tableTreeInstance);
  }

  function handleKeyDown(event: KeyboardEvent) {

  }

}