import { arrsToObjs, batchListen, getWindow, judgeAsync, showInfo } from "./tools";
import { 百度翻译, 腾讯翻译 } from "../modules/ui/testOpen";
import { getString } from "./locale";
import { config } from "../../package.json";
import { openAddonPrefPane } from "../modules/preferenceScript";
import { fullTextTranslate } from "../modules/translate/fullTextTranslate";
import { getSettingValue, setSettingValue } from "../modules/addonSetting";
import { ColumnOptions } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { getRowString } from "../modules/ui/tableSecretKeys";
import { tableFactory } from "../modules/ui/tableFactory";
import { outside } from "../modules/ui/uiTools";
import { DEFAULT_VALUE, EmptyValue, FONT_SIZES, Nonempty_Keys } from "./constant";

//注册快捷键选项面板
export function registerPrefsShortcut() {
  ztoolkit.PreferencePane.register({
    pluginID: config.addonID,
    src: rootURI + "chrome/content/shortcut.xhtml",
    label: getString("info-shortcut"),
    defaultXUL: true,
  });
  registerShortcutsCache();
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
  // const argsArr = [
  //   // 默认快捷键 测试用
  //   // 函数，快捷键，参数 n 个
  //   [fullTextTranslate.translateFT, "lalt+n", "note"],
  //   [百度翻译, "b+d+f+y",],
  //   [腾讯翻译, "t+x+f+y",],
  //   [腾讯翻译, "lctrl+t+x+f+y",],
  //   [increaseFontSize, "b+d",],
  //   [decreaseFontSize, "b+x",],
  //   [openAddonPrefPane, "lctrl+s+z",],
  // ];


  // const shortcutCommandsMap = [
  //   //快捷键，命令，条件(需完善)
  //   // [["lalt+n", `${CONDITION_1}`], "translateNote",],
  //   ["lalt+n", "translateNote",],
  //   ["b+d+f+y", "baiduTranslate",],
  //   ["t+x+f+y", "tencentTranslate",],
  //   ["b+d", "increaseFontSize",],
  //   ["b+x", "decreaseFontSize",],
  //   ["lctrl+s+z", "settingPane",],
  // ];



  const commandDefineArr = [
    // 命令，快捷键，函数,参数 n 个
    ["translateNote", "lalt+n", fullTextTranslate.translateFT, "note"],
    ["baiduTranslate", "b+d+f+y", 百度翻译,],
    ["tencentTranslate", "t+x+f+y", 腾讯翻译,],
    ["tencentTranslateCtrl", "lctrl+t+x+f+y", 腾讯翻译,],
    ["increaseFontSize", "b+d", increaseFontSize,],
    ["decreaseFontSize", "b+x", decreaseFontSize,],
    ["settingPane", "lctrl+s+z", openAddonPrefPane,],
  ];


  //setShortcut(argsArr);
  defineCommand(commandDefineArr);
  // setShortcutCommand(shortcutCommandsMap);

}

/**
 * command 命令字符串
 * shortcut  “+” 连接的快捷键字符串，
 * @param argsArr 
 */
export function defineCommand(argsArr: any[][]) {
  if (!addon.mountPoint.commandDefine) {
    addon.mountPoint.commandDefine = new Map();
  }
  const commandDefine: Map<any, any> = addon.mountPoint.commandDefine;

  if (!addon.mountPoint.shortcutCommand) {
    addon.mountPoint.shortcutCommand = new Map();
  }
  const shortcutCommand: Map<any, any> = addon.mountPoint.shortcutCommand;

  argsArr.forEach((args: any[]) => {
    const command = args.shift();
    const shortcutStr = args.shift();
    const func = args.shift();
    const funcAgrs = args;
    if (commandDefine.has(command)) commandDefine.delete(command);
    commandDefine.set(command, { func: func, shortcutStr: shortcutStr, funcAgrs: funcAgrs });
    if (shortcutCommand.has(shortcutStr)) shortcutCommand.delete(shortcutStr);
    shortcutCommand.set(shortcutStr, command);
  });
}

//export function setShortcutCommand(argsArr: any[][]) {
//  if (!addon.mountPoint.shortcutCommand) {
//    addon.mountPoint.shortcutCommand = new Map();
//  }
//  const shortcutCommand: Map<any, any> = addon.mountPoint.shortcutCommand;
//  argsArr.forEach((args: any[]) => {
//    let shortcut_condition = args.shift();
//    if (Array.isArray(shortcut_condition)) {
//      shortcut_condition = shortcut_condition.join("+");
//    }
//    const command = args.shift();
//    shortcutCommand.set(shortcut_condition, command);
//  });
//}

//export function setShortcut(argsArr: any[][]) {
//  if (!addon.mountPoint.FuncShortcutMap) {
//    addon.mountPoint.FuncShortcutMap = new Map();
//  }
//  const FuncShortcutMap: Map<any, any> = addon.mountPoint.FuncShortcutMap;
//  argsArr.forEach((args: any[]) => {
//    FuncShortcutMap.set(args.shift(), { shortcutStr: args.shift(), funcAgrs: args });
//  });
//}



const keyCodeMap: any = {//KeyModifier, code值 为键
  ControlLeft: "LCtrl",
  ControlRight: "RCtrl",
  ShiftLeft: "LShift",
  ShiftRight: "RShift",
  AltLeft: "LAlt",
  AltRight: "RAlt",
  OSLeft: "LOS",
  OSRight: "ROS",
};
const keyCodeMapNoLR: any = {//KeyModifier, code值 为键
  ControlLeft: "Ctrl",
  ControlRight: "Ctrl",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  AltLeft: "Alt",
  AltRight: "Alt",
  OSLeft: "OS",
  OSRight: "OS",
};



export async function onShortcutPan(_window: Window) {
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
    };
  } else {
    addon.data.prefs.window = _window;
  }
  const doc = _window.document;
  const win = _window;

  const rawKeyCache: string[] = [];
  // 修饰键是否区分左右
  const distinguish = doc.querySelector("#distinguishLeftRight") as XUL.Checkbox;
  distinguish.addEventListener("command", async () => {
    await setSettingValue("distinguishLeftRight", Number(distinguish.checked), "shortcut");
  });
  const shortcutElem = doc.querySelector("#input-shortcut")! as HTMLInputElement;


  function keydownAction(this: any, e: any) {
    const selection = win.getSelection();
    if (!selection || !selection.anchorNode) return;
    const anchorNode = selection.anchorNode;
    const str = selection.anchorNode.textContent;
    if (["Backspace", "Delete", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation;
      let offset = ["ArrowLeft", "Backspace"].includes(e.code) ? -1 : 1;
      offset += selection.anchorOffset;
      if (offset > anchorNode!.textContent!.length) offset = anchorNode!.textContent!.length;
      if (offset < 0) offset = 0;
      switch (e.code) {
        case "ArrowLeft":
        case "ArrowRight":
          selection.setPosition(selection.anchorNode, offset);
          break;
        case "Backspace":
        case "Delete":
          if (!str) return;
          anchorNode.textContent = str.substring(0, offset) + str.substring(offset + 1);
          selection.setPosition(selection.anchorNode, offset);
          break;
      }
    }
  }

  //  function shortcutShow(FuncShortcutMap: any, commandFuncMap: any, commandName: string) {
  //    for (const [key, value] of FuncShortcutMap) {
  //      const funcName = key.name;
  //      if (key == commandFuncMap[commandName]) {
  //        let shortcutStr = value.shortcutStr as string;
  //        shortcutStr = shortcutStr.split("+").join(" + ");
  //        return shortcutStr;
  //      }
  //    }
  //  }


  // const FuncShortcutMap: Map<any, any> = addon.mountPoint.FuncShortcutMap;
  const commandDefine: Map<any, any> = addon.mountPoint.commandDefine;
  const shortcutStr = commandDefine.get("settingPane").shortcutStr as string;
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
      defineCommand([["settingPane", shortcutElem.value.toLocaleLowerCase(), openAddonPrefPane]]);
    }
  });

  await shortcutTable();

}

async function shortcutTable() {

  const commandShortcutMap = [
    ["translateNote", "lalt+n",],
    ["baiduTranslate", "b+d+f+y",],
    ["tencentTranslate", "t+x+f+y",],
    ["increaseFontSize", "b+d",],
    ["decreaseFontSize", "b+x",],
    ["settingPane", "lctrl+s+z",],
  ];

  const id = "shortcutTable";
  const containerId = `table-shortcut`;
  const showRawValueMap = new Map();
  const rows = await getRows();
  const columnKeys = ["dataKey", "label", "staticWidth", "fixedWidth", "flex", "width",];
  const columnValuesArr = [
    ["command", getString("head-command"), false, false, true, 60],
    ["shortcut", getString("head-shortcut"), false, false, true, 400],
  ];
  const columnsProp = arrsToObjs(columnKeys)(columnValuesArr) as ColumnOptions[];
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
    onKeyDown: handleKeyDown,

  };
  const win = addon.data.prefs!.window;
  const options: TableFactoryOptions = {
    win: win,
    containerId: containerId,
    props: props,
    rowsData: rows,
  };

  const tableHelper = await tableFactory(options);
  const treeInstance = tableHelper.treeInstance as VirtualizedTable;
  const mount = treeInstance.mount;
  mount.EmptyValue = EmptyValue;
  mount.Nonempty_Keys = Nonempty_Keys;
  mount.DEFAULT_VALUE = DEFAULT_VALUE;
  if (showRawValueMap.size) {
    treeInstance.mount.showRawValueMap = showRawValueMap;
  }

  /*   batchListen([[treeInstance._topDiv.children[1], treeInstance._topDiv, treeInstance._topDiv.parentElement!], ["focusin", "focusout"], showEvent]);
    function showEvent(this: HTMLElement, e: Event) {
      ztoolkit.log(e.type + "  " + this.id);f
      ztoolkit.log(e);
    }
   */
  treeInstance.handleValue = handleValue;
  function handleValue(key: string, value: string) {
    if (key == "shortcut" && value) {
      value = value.toLocaleLowerCase().split(" ").join("+");
    }
    return value;
  }

  function handleKeyDown() {
    if (treeInstance.mount.editingElement) return false;//处于编辑状态时editingElement不为空
    return true;
  }

  treeInstance._topDiv.addEventListener("blur", async (e) => {
    ztoolkit.log(treeInstance._topDiv.id + " saveShortcutData", e.type, e,);
    await saveShortcutData();
  });


  const doc = win!.document;
  const styleTag = doc.createElement("style");
  styleTag.innerHTML = `span.cell.shortcut {
    text-transform: uppercase; text-align: center;
  }`;
  const winElement = doc.getElementById("zotero-prefs")!;
  winElement.appendChild(styleTag);
  win.addEventListener("click", clickTableOutsideCommit);
  setTimeout(() => {
    (tableHelper.treeInstance as any)._jsWindow.render();//延迟渲染防止显示不全
  }, 1000);


  async function getRows() {
    //从数据库获取 JSON 
    const commandShortcutJSON = await getSettingValue("commandShortcut", "shortcut");
    if (commandShortcutJSON) {
      const commandShortcut: ShortcutData[] = JSON.parse(commandShortcutJSON);//[{command:command,shortcut:shortcut}]
      if (commandShortcut[0].shortcut.length) {
        return commandShortcut;
      }
    }
    //从数组生成数据
    const rows: ShortcutData[] = arrsToObjs(["command", "shortcut"])(commandShortcutMap, true) || [];
    if (rows.length) return rows;
    //否则返回默认占位符
    const placeholderRow: ShortcutData[] = [{ command: 'command', shortcut: 'shortcut' }];
    return placeholderRow;
  }

  async function clickTableOutsideCommit(e: MouseEvent) {
    if (!outside(e, treeInstance._topDiv!)) return;
    await treeInstance.mount.saveDate(saveShortcutData);
  }


  function handleRowData(index: number) {
    const row = { ...rows[index] };//解构赋值，如果影响原始数据，改为deepclone
    const rawValue = rows[index].command;
    let showValue = rawValue;
    if (showValue.length) {
      showValue = getString('info-' + showValue);//单元格显示的内容，多语言支持
    }
    if (showValue.startsWith(`${config.addonRef}-`)) {
      ztoolkit.log(`command 字段的值 ${rows[index].command} 没有对应的 FTL 条目`);
      showValue = rows[index].command;
    }
    if (showValue != rawValue) {
      showRawValueMap.set(showValue, rawValue);
    }
    row.command = showValue;
    let shortcutStr = row.shortcut;
    //防止 undefined
    if (shortcutStr == void 0) {
      shortcutStr = '';// !''== true
      rows[index].shortcut = '';
    }
    shortcutStr = shortcutStr.split("+").join(" ");
    row.shortcut = shortcutStr;
    return row;

  }

  function handleGetRowString(index: number) {
    return getRowString(rows, index, treeInstance);
  }



  function handleSelectionChange(selection: TreeSelection) {
    if (treeInstance.mount.dataChangedCache) {
      treeInstance.mount.saveDate(saveShortcutData);
    }
    const selectedRow = selection.focused;
    ztoolkit.log("selectedRow: " + selectedRow);
    treeInstance.mount.getFocusedElement("selectionChange");
    treeInstance.mount.editingElement && treeInstance.mount.editingElement.blur();

  }



  function handleFocus(e: any) {
    const t = e.target as HTMLElement;
    const info = t.id ? t.id : t.classList.toString();
    ztoolkit.log("react 事件: " + info);
    ztoolkit.log("e._reactName: " + e._reactName || '');
    ztoolkit.log(e);
    treeInstance.mount.startEditing(1);
    return false;
  }

  async function saveShortcutData() {
    const rowsData = treeInstance.mount.rowsData as ShortcutData[];
    if (!rowsData || rowsData.length === 0) return;
    for (const data of rowsData) {
      const undefinedValues = Object.values(data).filter(e => e == void 0);// 
      if (undefinedValues.length) {
        ztoolkit.log(`shortcut can not be Empty`);
        return;
      }
    }
    //const commandShortcutArr = rowsData?.map((row) => ([row.command, row.shortcut]));
    const json = JSON.stringify(rowsData);
    await setSettingValue("commandShortcut", json, "shortcut");
  }
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
  const keyCodeMapCurrent = distinguishLeftRight ? keyCodeMap : keyCodeMapNoLR;
  rawKeyCache.forEach(raw => {
    let str: string = keyCodeMapCurrent[raw];
    if (str == void 0 && raw.startsWith('Key')) { //KeyX
      str = raw.replace('Key', '');// 重新赋值后不为 void 0
    }
    //keyCodeMapCurrent 没有 raw，也不是 KeyX
    if (str == void 0) str = raw;
    strConverted.push(str);
  });
  return strConverted;
}

const dispatchDebounced = Zotero.Utilities.debounce(dispatchShortcuts, 1000);


async function dispatchShortcuts(rawKeyCache: string[]) {
  const shortcutStr = (await rawConvert(rawKeyCache)).join("+").toLocaleLowerCase();
  rawKeyCache.length = 0;
  const shortcutCommand = addon.mountPoint.shortcutCommand?.get(shortcutStr);
  if (!shortcutCommand) return;
  const temp = addon.mountPoint.commandDefine?.get(shortcutCommand);
  if (!temp) return;
  const func2 = temp.func;//函数
  if (!func2) return;
  const funcAgrs2 = temp.funcAgrs;// 参数
  if (judgeAsync(func2)) {// 判断是否为异步函数
    await func2(...funcAgrs2);
  } else {
    func2(...funcAgrs2);
  }


}

function getShortcutConditon() {
  const win = getWindow("active");
  if (win) return win.location.href;
}




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

declare type ShortcutData = {
  command: string;
  shortcut: string;
};



export class CommandCenter {

  //  static items = CommandCenter.getSelectedItems('regular');
  /******************************************/
  // Functions for GUI keyboard shortcuts
  /******************************************/
  static editItemInfoGUI() {
    const items = CommandCenter.getSelectedItems('regular');
    if (!CommandCenter.checkItemNumber(items, 'regularSingle')) {
      return false;
    }
    // Focus first entry textbox of info pane
    const elem = document.getElementById('zotero-editpane-item-box')! as any;
    elem.focusField("title");
    return true;
  }

  static addNoteGUI() {
    const items = CommandCenter.getSelectedItems('regular');
    if (!CommandCenter.checkItemNumber(items, 'regularSingle')) {
      return false;
    }
    CommandCenter.getPane("notes").click();
    ZoteroPane_Local.newNote(false, items[0].key);
    return true;
  }

  static getPane(paneName: PaneName) {
    const selector = `toolbarbutton[data-pane="${paneName}"][aria-selected="false"]`;
    const pane = document.querySelector(selector) as HTMLElement | XUL.Element;
    if (!pane) throw paneName + " pane not found";
    return pane;
  }
  static getElement(selector: string) {
    const addButton = document.querySelector(selector) as HTMLElement | XUL.Element;
    if (!addButton) throw "add tag button not found";
    return addButton;
  }

  static addTagGUI() {
    const items = CommandCenter.getSelectedItems('regular');
    if (!CommandCenter.checkItemNumber(items, 'regularSingle')) {
      return false;
    }
    // Select tag tab of item pane
    CommandCenter.getPane("tags").click();
    // Focus new tag entry textbox
    const addButtonSelector = "#zotero-editpane-tags toolbarbutton.add";
    CommandCenter.getElement(addButtonSelector).click();
    return true;
  }


  static addRelatedGUI() {
    const items = CommandCenter.getSelectedItems('regular');
    if (!CommandCenter.checkItemNumber(items, 'regularSingle')) {
      return false;
    }

    // Select related tab of item pane
    CommandCenter.getPane("related").click();

    // Open add related window
    const addButtonSelector = "#zotero-editpane-related  toolbarbutton.add";
    CommandCenter.getElement(addButtonSelector).click();
    return true;
  }

  static showItemPane() {
    const itemPane = document.getElementById('zotero-item-pane');
    if (!itemPane) return;
    if (itemPane.getAttribute('collapsed') == 'true') {
      itemPane.setAttribute('collapsed', 'false');
      document.getElementById('zotero-items-splitter')?.removeAttribute('state');
    }
  }

  static updatePaneVisibility(paneName: string, command: string, keepSplitter: boolean = false) {
    const pane = document.getElementById(paneName + '-pane');
    if (!pane) throw paneName + " pane not found";
    // It is zotero-item-pane but zotero-items-splitter
    let splitterStr;
    if (paneName == 'zotero-item') {
      splitterStr = 's-splitter';
    } else {
      splitterStr = '-splitter';
    }
    const splitter = document.getElementById(paneName +
      splitterStr);
    if (!splitter) throw paneName + " splitter not found";

    switch (command) {
      case 'toggle':
        //@ts-ignore xxx
        if (pane.collapsed) {
          CommandCenter.updatePaneVisibility(paneName, 'show', keepSplitter);
        } else {
          CommandCenter.updatePaneVisibility(paneName, 'hide', keepSplitter);
        }
        break;
      case 'show':
        //@ts-ignore xxx
        pane.collapsed = false;
        if (!keepSplitter) {
          splitter.removeAttribute('state');
        }
        break;
      case 'hide':
        //@ts-ignore xxx
        pane.collapsed = true;
        splitter.setAttribute('state', 'collapsed');
        break;
    }
  }






  /******************************************/
  // Zotero item selection and sorting
  /******************************************/

  // Get all selected attachment items and all of the child attachments of
  // all selected regular items.
  // To get just the selected attachment items, use
  // Zutilo.siftItems(inputArray, 'attachment') instead.
  static getSelectedAttachments(mode?: number) {

    const items = CommandCenter.getSelectedItems();
    if (!items) {
      return [];
    }

    // Add child attachments of all selected regular items to
    // attachmentItems
    let item;
    let attachmentItems: Zotero.Item[] = [];
    while (items.length > 0) {
      item = items.shift();
      if (!item) break;

      if (item.isRegularItem()) {
        attachmentItems =
          attachmentItems.concat(Zotero.Items.
            get(item.getAttachments(false)));
      } else if (item.isAttachment()) {
        attachmentItems.push(item);
      }
    }

    if (mode !== undefined) {
      attachmentItems = attachmentItems.filter(
        (item) => item.attachmentLinkMode == mode
      );
    }

    // Return attachments after removing duplicate items (when parent and
    // child are selected)
    return CommandCenter.removeDuplicateItems(attachmentItems);
  }

  // Return array with the selected item objects.  If itemType is passed,
  // return only items of that type (or types if itemType is an array)
  static getSelectedItems(itemType?: string[] | string) {

    const items = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!items.length) {
      Services.prompt.alert(
        null,
        getString('zutilo-checkItems-errorTitle'),
        getString('info-selectedItemeZero')
      );
      throw getString('info-selectedItemeZero');
    }

    if (itemType) {
      if (!Array.isArray(itemType)) {
        itemType = [itemType];
      }
      const siftedItems = CommandCenter.siftItems(items, itemType);
      const itemsFilted = siftedItems.matched.filter(e => e) as Zotero.Item[];
      return itemsFilted;
    } else {
      return items;
    }
  }

  static checkItemType(itemObj: Zotero.Item, itemTypeArray: string[]) {
    let matchBool = false;

    for (let idx = 0; idx < itemTypeArray.length; idx++) {
      switch (itemTypeArray[idx]) {
        case 'attachment':
          matchBool = itemObj.isAttachment();
          break;
        case 'note':
          matchBool = itemObj.isNote();
          break;
        case 'regular':
          matchBool = itemObj.isRegularItem();
          break;
        default:
          matchBool = Zotero.ItemTypes.getName(itemObj.itemTypeID) ==
            itemTypeArray[idx];
      }

      if (matchBool) {
        break;
      }
    }

    return matchBool;
  }

  // Remove duplicate Zotero item objects from itemArray
  static removeDuplicateItems(itemArray: Zotero.Item[]) {
    // Get array of itemID's
    const itemIDArray = [];
    for (let index = 0; index < itemArray.length; index++) {
      itemIDArray[index] = itemArray[index].id;
    }

    // Create array of unique itemID's
    const tempObject: any = {};
    const uniqueIDs = [];
    for (let index = 0; index < itemIDArray.length; index++) {
      tempObject[itemIDArray[index]] = itemIDArray[index];
    }
    for (const index in tempObject) {
      uniqueIDs.push(tempObject[index]);
    }
    return Zotero.Items.get(uniqueIDs);
  }

  // Separate itemArray into an array of items with type itemType and an
  // array with those with different item types
  static siftItems(itemArray: Zotero.Item[], itemTypeArray: string[]) {
    const matchedItems = [];
    const unmatchedItems = [];
    while (itemArray.length > 0) {
      if (CommandCenter.checkItemType(itemArray[0], itemTypeArray)) {
        matchedItems.push(itemArray.shift());
      } else {
        unmatchedItems.push(itemArray.shift());
      }
    }

    return {
      matched: matchedItems,
      unmatched: unmatchedItems
    };
  }



  // Check number of items in itemArray and show error message if it does not
  // match checkType. Note that checkType sets the number to be checked and
  // the error message to display. The actual item types are not checked.
  static checkItemNumber(itemArray: Zotero.Item[], checkType: string) {
    let checkBool = true;
    const errorTitle = getString('zutilo-checkItems-errorTitle');
    if (!itemArray) {
      Services.prompt.alert(
        null,
        errorTitle,
        getString('zutilo-checkItems-' + checkType)
      );
      checkBool = false;
    }
    switch (checkType) {
      case 'regular1':
      case 'regularOrNote1':
      case 'regularNoteAttachment1':
        if (!itemArray.length) {
          Services.prompt.alert(
            null,
            errorTitle,
            getString('zutilo-checkItems-' + checkType)
          );
          checkBool = false;
        }
        break;
      case 'regularSingle':
        if ((!itemArray.length) || (itemArray.length > 1)) {
          Services.prompt.alert(
            null,
            errorTitle,
            getString('zutilo-checkItems-regularSingle')
          );
          checkBool = false;
        }
        break;
      case 'regular2':
      case 'regularOrNote2':
      case 'regularNoteAttachment2':
        if ((!itemArray.length) || (itemArray.length < 2)) {
          Services.prompt.alert(
            null,
            errorTitle,
            getString('zutilo-checkItems.' + checkType)
          );
          checkBool = false;
        }
        break;
      case 'attachment1':
        if (!itemArray.length) {
          Services.prompt.alert(
            null,
            errorTitle,
            getString('zutilo-checkItems-attachment1')
          );
          checkBool = false;
        }
        break;
    }

    return checkBool;
  }
}

declare type PaneName = "info" | "abstract" | "attachments" | "notes" | "libraries-collections" | "tags" | "related";


