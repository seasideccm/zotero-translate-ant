import { KeyModifier } from "zotero-plugin-toolkit/dist/managers/keyboard";
import { showInfo } from "./tools";
import { 百度翻译, 腾讯翻译 } from "../modules/ui/testOpen";
import { getString } from "./locale";
import { config } from "../../package.json";
import { openAddonPrefPane } from "../modules/preferenceScript";
import { getElementValue } from "../modules/ui/uiTools";



export function registerPrefsShortcut() {
  ztoolkit.PreferencePane.register({
    pluginID: config.addonID,
    src: rootURI + "chrome/content/shortcut.xhtml",
    label: getString("info-shortcut"),
    defaultXUL: true,
  });
  registerShortcutsCache();
}

export function onShortcutPan() {
  const doc = addon.data.prefs?.window?.document;
  if (!doc) {
    return;
  }
  const win = addon.data.prefs!.window;
  win.addEventListener("keydown", (e) => {
    //失败监测不到
    showInfo("keydown");
  });
  win.addEventListener("keyup", (e) => {
    //失败监测不到
    showInfo("keyup");
  });

  const ele = doc.querySelector("#input-shortcut") as HTMLInputElement;
  ele?.addEventListener('blur', () => {
    if (ele.value && ele.value != '') {
      const shortcutStr = ele.value.split('').join(" ");
      customShortcut(shortcutStr, "setting");
    }
  });



}






export function registerShortcutsCache() {
  type KeyboardEventType = "keydown" | "keyup";
  const logDebounced = Zotero.Utilities.debounce(showInfo, 1000);

  function cacheShortcuts(
    ev: KeyboardEvent,
    keyOptions: {
      keyboard?: KeyModifier;
      type: KeyboardEventType;
    },
  ) {
    let cachedShortcuts = addon.mountPoint.cachedShortcuts;
    if (!keyOptions || keyOptions.type != "keyup") return;
    if (!cachedShortcuts) {
      cachedShortcuts = addon.mountPoint.cachedShortcuts = [];
    }
    if (!keyOptions.keyboard) return;
    cachedShortcuts.push(
      keyOptions.keyboard.getLocalized().replace(/,/g, "+").toLocaleLowerCase(),
    );
    const shortcutStr = cachedShortcuts.join(" ");
    dispatchDebounced(shortcutStr);
    logDebounced(shortcutStr);
  }
  registerFn();
  setShortcut();
  ztoolkit.Keyboard.register(cacheShortcuts);

}
const dispatchDebounced = Zotero.Utilities.debounce(dispatchShortcuts, 1000);
function dispatchShortcuts(shortcutStr: string) {
  const cachedShortcuts = addon.mountPoint.cachedShortcuts;
  // 清空快捷键缓存
  cachedShortcuts ? (cachedShortcuts.length = 0) : () => { };
  //获取 Map 对象中键的值（函数），然后直接运行

  //
  //获取map中快捷键字符串对应的值（代表函数的字符串）
  let fnName = addon.mountPoint.shortcutFnMap?.get(shortcutStr);
  if (!fnName) return;
  if (typeof fnName == "function") fnName();

  if (typeof fnName == "string") {
    const strArr = fnName.split(".");
    fnName = strArr[0];
    const args = strArr[1]?.split(",");
    if (!args) {
      addon.mountPoint.fn[fnName]();
    } else {
      addon.mountPoint.fn[fnName](...args);
    }
  }
}

export function setShortcut() {

  const argsArr = [
    ["b d f y", 百度翻译],
    ["t x f y", 腾讯翻译],
    ["ctrl+t x f y", "txfy"],
    ["b d", "increaseFontSize"],
    ["b x", "decreaseFontSize"],
    ["a s", "setting"],

  ];

  argsArr.forEach((args: any[]) => {
    customShortcut(args[0], args[1]);
  });


  /*   customShortcut("b d f y", 百度翻译);
    customShortcut("t x f y", 腾讯翻译);
    customShortcut("ctrl+t x f y", "txfy");
    customShortcut("b d", "increaseFontSize");
    customShortcut("b x", "decreaseFontSize"); */
}

// eslint-disable-next-line @typescript-eslint/ban-types
function customShortcut(shortcutStr: string, fnOrString: Function | string) {
  let shortcutFnMap = addon.mountPoint.shortcutFnMap;
  if (!shortcutFnMap)
    shortcutFnMap = addon.mountPoint.shortcutFnMap = new Map();
  shortcutFnMap.set(shortcutStr, fnOrString);
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

export function registerFn() {
  addon.mountPoint.fn = { txfy: 腾讯翻译 };
  addon.mountPoint.fn.increaseFontSize = increaseFontSize;
  addon.mountPoint.fn.decreaseFontSize = decreaseFontSize;
  addon.mountPoint.fn.setting = openAddonPrefPane;
}

