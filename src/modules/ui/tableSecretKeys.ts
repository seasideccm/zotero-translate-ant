
import {
  arrToObj,
  arrsToObjs,
  batchListen,
  chooseDirOrFilePath,
  deepClone,
  differObject,
  objArrDiffer,
  showInfo,
} from "../../utils/tools";
import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { ContextMenu } from "./contextMenu";
import {
  TranslateService,
  TranslateServiceAccount,
} from "../translate/translateService";
import { getDom, getElementValue, outside } from "./uiTools";
import {
  ServiceMap,
  deleteAccount,
  getNextServiceSNSync,
  getSerialNumberSync,
  getServiceAccountSync,
  getServices,
  getServicesFromDB,
} from "../translate/translateServices";
import { DEFAULT_VALUE, EmptyValue } from "../../utils/constant";
import { Cry, decryptByAESKey, encryptByAESKey, encryptState } from "../crypto";
import { getPref } from "../../utils/prefs";
import { getSettingValue, setSettingValue } from "../addonSetting";

import { stopEvent, tableFactory } from "./tableFactory";
import { ColumnOptions } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";

const dataVerify: any = {
  baidu: baiduVerify,
  baidufield: baiduVerify,
  caiyun: caiyunVerify,
  tencent: tencentVerify,
  niutranspro: niutransproVerify,
  microsoft: microsoftVerify,
  youdaozhiyun: youdaozhiyunVerify,
  deeplfree: deeplVerify,
  deeplpro: deeplVerify,
  aliyun: aliyunVerify,
  gemini: geminiVerify,
  azuregpt: azuregptVerify,
  chatgpt: chatgptVerify,
};
export const columnPropKeys = [
  "dataKey",
  "label",
  "staticWidth",
  "fixedWidth",
  "flex",
];

export async function replaceSecretKeysTable() {
  const win = addon.data.prefs?.window;
  if (!win) return;
  const id = `${config.addonRef}-` + "secretKeysTable";
  const containerId = `${config.addonRef}-table-container`;

  const serviceID = getElementValue("serviceID") as keyof TranslateService;

  const res = await updateTable("secretKeysTable", serviceID);
  if (res) return;

  //数据 rows 表格创建后挂载至 treeInstance 表格实例上
  const rows: any[] = (await secretKeysRows(serviceID)) || [];
  if (!rows || rows.length == 0) return;
  //props
  const columnPropValues = makeColumnPropValues(rows[0]);
  const columnsProp: ColumnOptions[] = arrsToObjs(columnPropKeys)(
    columnPropValues,
  );

  const props: VirtualizedTableProps = {
    id: id,
    columns: columnsProp,
    staticColumns: false,
    showHeader: true,
    multiSelect: true,
    getRowCount: () => rows.length,
    getRowData: handleGetRowData, //(index: number) => rows[index],
    getRowString: handleGetRowString,
    onKeyDown: handleKeyDown,
    onSelectionChange: handleSelectionChange,
    //@ts-ignore has
    onActivate: handleActivate,
    onItemContextMenu: handleItemContextMenu,
    onDrop: handleDrop,
    onDragOver: handleDragOver,
    onFocus: handleFocus,
  };

  const options: TableFactoryOptions = {
    win: win,
    containerId: containerId,
    props: props,
    rowsData: rows,
  };

  const tableHelper = await tableFactory(options);
  const treeInstance = tableHelper.treeInstance as unknown as VirtualizedTable;
  treeInstance.scrollToRow(rows.length - 1);
  treeInstance._topDiv?.scrollIntoView(false);


  //绑定事件，增删改查
  getDom("addRecord")!.addEventListener("command", addRecord);
  getDom("addRecordBulk")!.addEventListener("command", addRecordBulk);
  getDom("updateCryptoKey")!.addEventListener("command", Cry.updateCryptoKey);
  getDom("addOldCryKey")!.addEventListener("command", addOldCryKey);
  //win.addEventListener("beforeunload", saveAccounts);
  win.addEventListener("click", clickTableOutsideCommit);
  adjustWidth(rows);

  function handleGetRowString(index: number) {
    return getRowString(rows, index, treeInstance);
  }

  function handleGetRowData(index: number) {
    // 如果加密开启，secretKey、token 字段显示为 ******
    const row: any = deepClone(rows[index]);
    if (!row) return;
    const enableEncrypt = (getDom("setEnableEncrypt") as XUL.Checkbox).checked;
    if (!enableEncrypt) return row;
    for (const key of Object.keys(row)) {
      if (!["secretKey", "token"].includes(key)) continue;
      if (
        row[key as keyof typeof row] ==
        DEFAULT_VALUE[key as keyof typeof DEFAULT_VALUE]
      )
        continue;
      row[key as keyof typeof row] = "******";
    }
    return row;
  }
  function adjustWidth(rows: any[], byDisplay: boolean = true) {
    //@ts-ignore xxx
    const visibleKeys = treeInstance
      ._getVisibleColumns()
      .map((e: any) => e.dataKey);
    const onResizeData: any = {};
    const totalWidth = treeInstance._topDiv?.clientWidth;
    if (byDisplay) {
      const rowsDisplay: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        if (treeInstance.props.getRowData) {
          const row = treeInstance.props.getRowData(i);
          rowsDisplay.push(row);
        }
      }
      if (rowsDisplay.length) rows = rowsDisplay;
    }

    //表格宽度
    if (!totalWidth) return;

    const colums: any[][] = rowsToColums(rows, visibleKeys) || [[]];
    const longestCells = strMax(colums);
    const keys = visibleKeys || Object.keys(rows[0]); //可指定keys
    const keyWidth: { [key: string]: number; } = {};
    for (let i = 0; i < keys.length; i++) {
      const cellText = longestCells[i];
      const key = keys[i];
      const width = caculateCellWidth(key, cellText, i);
      keyWidth[key] = width || 0;
    }
    const sum = Object.values(keyWidth).reduce((prev, curr) => {
      return prev + curr;
    }, 0);
    if (!sum) return;

    if (sum >= totalWidth) {
      //只关注可见列，除了最宽列，均最佳显示
      let sumTemp = sum; //根据列的内容（筛选出每列字符数最多的值）排序
      const values = Object.values(keyWidth).sort();
      let keys = Object.keys(keyWidth);
      let lengthMax: number;
      while (sumTemp >= totalWidth) {
        lengthMax = values.pop() || 0;
        const keyMax = keys.find((key) => keyWidth[key] == lengthMax);
        keys = keys.filter((key) => key != keyMax);
        sumTemp = values.reduce((prev, curr) => {
          return prev + curr;
        }, 0);
      }
      for (const key of keys) {
        onResizeData[key] = keyWidth[key] || 0;
      }
    } else {
      const diff = totalWidth - sum;
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        onResizeData[key] =
          keyWidth[key] + Math.round(diff * (keyWidth[key] / sum));
      }
    } //@ts-ignore has
    treeInstance._columns.onResize(onResizeData); //@ts-ignore has
    treeInstance.rerender();
    return onResizeData;
  }

  function caculateCellWidth(key: string, cellText: string, index: number = 0) {
    //@ts-ignore has
    treeInstance.rerender();
    const container = treeInstance._topDiv?.children[1].children[0]
      .children[0] as HTMLDivElement;
    if (!container) return;
    const span = container.children.item(index);
    if (!span || span?.classList[1] !== key) {
      showInfo("行元素有错误");
      return;
    }
    const selector = `span.${key}.clone`;
    let spanClone = container.querySelector(selector) as HTMLSpanElement;
    if (!spanClone) {
      spanClone = span.cloneNode(true) as HTMLSpanElement;
      spanClone.classList.add("clone");
      container.appendChild(spanClone);
      spanClone.style.position = "fixed";
      spanClone.style.top = "-1000px";
    }
    if (!spanClone) return;
    spanClone.textContent = cellText;
    const clientWidth = spanClone.clientWidth;
    return spanClone.scrollWidth;
  }

  function strMax(colums: any[][]) {
    const longestCells = [];
    for (const column of colums) {
      let tempLength = 0;
      let strMax = "";
      for (const str of column) {
        const length = String(str).length;
        if (length > tempLength) {
          tempLength = length;
          strMax = str;
        }
      }
      longestCells.push(strMax);
    }
    return longestCells;
  }
  /**
   * 每列值为一组，依据key的顺序成组
   * @param rows
   * @param visibleKeys
   * @returns
   */
  function rowsToColums(rows: any[], visibleKeys?: string[]) {
    visibleKeys ? visibleKeys : Object.keys(rows[0]);
    if (!visibleKeys || visibleKeys.length == 0) return;
    const colums: any[] = [];
    visibleKeys.filter((key, index) => {
      colums.push([]);
    });
    for (const row of rows) {
      visibleKeys.filter((key, index) => {
        colums[index].push(row[key]);
      });
    }
    return colums as any[][];
  }

  function handleFocus(e: any) {
    //@ts-ignore has
    if (treeInstance && treeInstance.prevFocusCell) {
      //@ts-ignore has
      treeInstance.prevFocusCell.focus();
      if (e && e.stopPropagation) {
        e.stopPropagation();
      } else {
        //@ts-ignore has
        if (window.event) window.event.cancelBubble = true;
      }
      if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    return false;
  }

  function handleDragOver(e: DragEvent) {
    if (!e.dataTransfer) return false;
    e.preventDefault();
    e.stopPropagation(); //@ts-ignore has
    if (e.dataTransfer.types.contains("application/x-moz-file")) {
      //
      if (!Zotero.isMac) {
        if (e.shiftKey) {
          if (e.ctrlKey) {
            e.dataTransfer.dropEffect = "link";
          } else {
            e.dataTransfer.dropEffect = "move";
          }
        } else {
          e.dataTransfer.dropEffect = "copy";
        }
      }
    }
    return false;
  }
  function verigyServiceID(text: string) {
    if (!text) return;
    const serviceID = getElementValue("serviceID") as string;
    // eslint-disable-next-line no-useless-escape
    const reg = new RegExp(`^[^\S\r\n]*${serviceID}[^\S\r\n]*$[\r\n]+`, "m");
    const match = text.match(reg);
    const info =
      "翻译引擎不匹配，请确保文件第一行翻译引擎名字和账号对应的翻译引擎一致";
    if (!match) {
      showInfo(info);
      return;
    }
    const serviceIDFromFile = match[0].trim();

    if (serviceID != serviceIDFromFile) {
      showInfo(info);
      //throw new Error("翻译引擎不匹配，请确保文件第一行翻译引擎名字和账号对应的翻译引擎一致")
    }
    return text.replace(match[0], "");
  }
  function handleDrop(e: DragEvent) {
    readTextFilesDroped(e).then(async (text) => {
      if (!text) return false;
      await batchAddAccount(text);
      //tableHelper.render();
    });
    return false;
  }

  async function handleSelectionChange(
    selection: TreeSelection,
    shouldDebounce: boolean,
  ) {
    await treeInstance.mount.saveDate(saveAccounts);
    /*    if (treeInstance.dataChangedCache) {
         await saveAccounts();
       } */

    adjustWidth(rows);
    return true;
  }

  function handleItemContextMenu(...args: any[]) {
    const [event, x, y] = args;
    onCollectionsContextMenuOpen(event, x, y);
    return false;
    function buildContextMenu() {
      const keys = ["label", "func", "args"];
      const menuPropsGroupsArr = [
        [
          ["菜单1", testContextMenu, ["菜单1", "第1位"]],
          ["菜单2", testContextMenu, ["菜单2", "第2位"]],
        ],
        [
          ["菜单4", testContextMenu, ["菜单4", "第3位"]],
          ["菜单3", testContextMenu, ["菜单3", "第4位"]],
        ],
      ];
      const idPostfix = "tableContextMenu";
      const contextMenu = new ContextMenu({
        keys,
        menuPropsGroupsArr,
        idPostfix,
      });
      return contextMenu;
    }
    async function onCollectionsContextMenuOpen(
      e: Event,
      x: number,
      y: number,
    ) {
      const contextMenu = buildContextMenu();
      //@ts-ignore has
      x = x || e.screenX; //@ts-ignore has
      y = y || e.screenY;
      // TEMP: Quick fix for https://forums.zotero.org/discussion/105103/
      //
      if (Zotero.isWin) {
        x += 10;
      }
      const anchor = e.target;
      //contextMenu.menupopup.openPopup(anchor, x, y);
      contextMenu.menupopup.openPopup(
        anchor,
        "after_pointer",
        0,
        0,
        true,
        false,
        e,
      ); //
      contextMenu.menupopup.moveTo(x, y);
    }

    function testContextMenu(...args: any[]) {
      const menuPopupEvent = args.pop();
      const target = args.pop();

      const eventType = menuPopupEvent.type;

      const id = target.id;
      showInfo(["表格行右键菜单:" + id, `事件类型：${eventType}`], {
        window: win,
      });
      const arg1 = args[0];
      const arg2 = args[1];
      showInfo("原始参数：" + arg1 + "<br><br>" + arg2);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    // Returning false to prevent default event.
    //return返回的值决定是否继续执行 virtualized-table.jsx 默认的按键功能
    //
    if (
      e.key == "Delete" ||
      e.key == "Backspace" ||
      (Zotero.isMac && e.key == "Backspace")
    ) {
      const confirm = win?.confirm(
        getString("info-delete-secretKey") +
        "\n" +
        getString("info-delete-confirm"),
      );
      if (!confirm) return true; //确认删除，点击cancel则取消

      //过滤掉选中行的数据，保留未选中的数据为数组，赋值给rows
      //@ts-ignore has
      const selectedIndices = Array.from(treeInstance.selection.selected);
      const rowsDelete =
        rows.filter((v: any, i: number) => selectedIndices.includes(i)) || [];
      selectedIndices.sort((a, b) => a - b);
      selectedIndices.filter((indexValue: number, subIndex: number) => {
        const deleteIndex = indexValue - subIndex; //避免下标变化而出错
        rows.splice(deleteIndex, 1);
      });

      //从services中删除
      const serviceID = getElementValue("serviceID") as string;
      const service = addon.mountPoint.services[serviceID];
      const appIDsDelete = rowsDelete.map((row) => row.appID);
      const secretkeysDelete = [];
      for (const row of rowsDelete) {
        const secretkeyDelete = getSerialNumberSync(serviceID, row.appID);
        secretkeysDelete.push(secretkeyDelete);
      }
      const accountsDelete = service.accounts.filter(
        (account: TranslateServiceAccount) =>
          appIDsDelete.includes(account.appID),
      );
      if (!accountsDelete || !accountsDelete.length) return false;
      service.accountsDelete = accountsDelete;
      const accounts = service?.accounts?.filter(
        (account: TranslateServiceAccount) =>
          !appIDsDelete.includes(account.appID),
      );
      service.accounts = accounts;

      //删除数据库数据
      //移到回收站？添加删除标志?
      for (const secretkeyDelete of secretkeysDelete) {
        deleteAccount(Number(secretkeyDelete));
      }

      treeInstance.invalidate();
      return false;
    }

    if (treeInstance.mount.editIndex != void 0) {
      if (e.key == "Enter" || e.key == "Escape") {
        if (e.key != "Escape") {
          commitEditingRow();
        } else {
          discardEditing();
        }
        return false;
      }
      /* if (e.key == ' ') {
                return false;
            } */
      return false;
    }

    if ((e.ctrlKey || e.metaKey) && e.key == "z") {
      showInfo("恢复");
      return false;
    }

    if ((e.ctrlKey || e.metaKey) && e.key == "v") {
      pasteAccount();
      return false;
    }

    /* if (e.key == 'ContextMenu' || (e.key == 'F10' && e.shiftKey)) {
            //@ts-ignore has
            const selectedElem = document.querySelector(`#${treeInstance._jsWindowID} [aria-selected=true]`);
            if (!selectedElem) return;
            const boundingRect = selectedElem.getBoundingClientRect();
            treeInstance.props.onItemContextMenu(
                e,
                window.screenX + boundingRect.left + 50,
                window.screenY + boundingRect.bottom
            );
            return;
        } */
    return true;
  }

  async function handleActivate(event: Event, indices: number[]) {
    //@ts-ignore has
    const editingRow = treeInstance._jsWindow._renderedRows.get(
      indices[0],
    ) as HTMLDivElement;
    const cellIndex = getcellIndex(event);
    if (cellIndex == void 0) return;

    //@ts-ignore has
    treeInstance.OriginRow = { ...rows[indices[0]] };
    const cell = editingRow.children[cellIndex] as HTMLSpanElement;
    const inputCell = await cellChangeToInput(cell);
    setTimeout(() => {
      inputCell.focus();
      inputCell.select();
    });
  }

  async function cellChangeToInput(cell: HTMLElement) {
    //解密
    if (treeInstance.mount.editIndex != void 0) {
      //@ts-ignore has
      treeInstance.commitEditingRow();
    }
    const selectedRow = treeInstance.selection.focused;
    const originRow = rows[selectedRow];
    const state = await encryptState();
    const key = cell.classList[1];
    let cellValue = originRow[key];
    if (state && ["secretKey", "token"].includes(key)) {
      if (cellValue && cellValue != "" && !cellValue.endsWith("No Data")) {
        try {
          if (cellValue.includes("encryptAESString")) {
            cellValue = await decryptByAESKey(cellValue);
          }
        } catch (e: any) {
          showInfo("不是加密数据");
          throw e;
        }
      }
    }
    const inputCell = document.createElement("input");
    //inputCell.placeholder = cellValue==""?cellValue

    //inputCell.value = cellValue || '';
    inputCell.value = "";
    //将行号作为class，作为编辑行的标志（blur时行号可能已经改变）

    inputCell.className = cell.classList[1];
    inputCell.classList.add(String(selectedRow));

    inputCell.dir = "auto";
    let cellBackgroundColor = window
      .getComputedStyle(cell)
      .getPropertyValue("backgroundColor");
    if (cellBackgroundColor == "") cellBackgroundColor = "black";
    //const color = window.getComputedStyle(cell).getPropertyValue('color');
    const color = "#4072e5";
    const styleInput = {
      width:
        Math.round((cell.clientWidth / cell.parentElement!.clientWidth) * 100) +
        "%",
      height: cell.clientHeight + "px",
      fontSize: "1.3rem",
      borderLeft: `4px solid ${color}`,
      borderRight: `4px solid ${color}`,
      marginTop: "auto",
      marginBottom: "auto",
      left: cell.offsetLeft + "px",
      backgroundColor: `${cellBackgroundColor}`,
      position: `absolute`,
      zIndex: "100",
    };
    Object.assign(inputCell.style, styleInput);
    cell.parentElement!.appendChild(inputCell);

    win?.addEventListener("click", doit);
    function doit(e: Event) {
      if (e.target != inputCell) {
        if (inputCell.value == "" || inputCell.value.endsWith("No Data"))
          return;
        valueToRows();
        treeInstance.invalidate();
        inputCell.remove();
        win?.removeEventListener("click", doit);
      }

    }
    adjustWidth(rows, false);

    //const updateRowDebounce = Zotero.Utilities.debounce(valueToRows, 1000);
    inputCell.addEventListener("input", updateWidth);
    inputCell.addEventListener("input", valueToRows);
    inputCell.addEventListener("focus", upLevel);
    batchListen([[
      inputCell,
      ["keydown", "keyup", "input", "mousedown", "mouseup", "dblclick"],
      [stopEvent],
    ]]);

    function upLevel() {
      const cells = inputCell.parentElement?.querySelectorAll("input");
      if (!cells) return;
      const zIndexs = []; //
      for (const cell of Array.from(cells)) {
        Number(cell.style.zIndex || 0);
        zIndexs.push(Number(cell.style?.zIndex || 0));
      }
      const zIndex = Math.max(...zIndexs) + 100;
      inputCell.style.zIndex = `${zIndex}`;
    }
    //当选中的行发生变化，react 会更新表，
    //导致 input 元素消失，所以 input 的 blur 事件不会被触发
    //inputCell.addEventListener('blur', blurUpdateRow);
    function valueToRows(e?: Event) {
      const key = inputCell.classList[0];
      const index = Number(inputCell.classList[1]);
      if (!rows[index] || !rows[index][key]) return; //空数据也在rows内

      treeInstance.changeData(index, key, inputCell.value);
      if (!treeInstance.mount.editIndex) treeInstance.mount.editIndex = index;
      let ei = treeInstance.mount.editIndex;
      if (!treeInstance.mount.editIndices) treeInstance.mount.editIndices = [];
      const eis = treeInstance.mount.editIndices;
      if (index != ei) {
        eis.push(ei);
        ei = index;
      }
    }

    const doResizeInput = resizeInput(inputCell);
    function updateWidth(e: Event) {
      doResizeInput(inputCell);
    }
    return inputCell;
  }


  /**
   * 更新表格数据，缓存单元格旧数据
   * @param index
   * @param key
   * @param value
   */
  /*   function dataChanged(index: number, key: string, value: any) {
      if (!treeInstance.dataChangedCache)
        treeInstance.dataChangedCache = {};
      const dc = treeInstance.dataChangedCache;
      if (!dc[index]) dc[index] = {};
      // 存储整行原始数据
      if (!dc[index]["originRow"])
        dc[index]["originRow"] = deepClone(rows[index]);
      // 存储 某一个 key 的原始数据，之后保存修改的数据从 rows 中读取
      if (!dc[index][key]) dc[index][key] = deepClone(rows[index][key]);
      //修改表格单元格数据 当前数据源 rows，如果刷新表格，则 rows 中修改的数据会显示出来
      rows[index][key] = value;
    } */

  function resizeInput(inputCell: HTMLInputElement) {
    const cacheValue = { value: inputCell.value };
    return function dodo(inputCellCurrent: HTMLInputElement) {
      if (cacheValue.value.length > inputCellCurrent.value.length + 5) {
        while (inputCellCurrent.scrollWidth <= inputCellCurrent.clientWidth) {
          const old = inputCellCurrent.clientWidth;
          inputCellCurrent.style.width =
            inputCellCurrent.scrollWidth - 10 + "px";
          if (old == inputCellCurrent.clientWidth) {
            break;
          }
        }
        cacheValue.value = inputCellCurrent.value;
      }
      if (inputCellCurrent.scrollWidth > inputCellCurrent.clientWidth) {
        inputCellCurrent.style.width = inputCellCurrent.scrollWidth + 50 + "px";
        cacheValue.value = inputCellCurrent.value;
      }
    };
  }

  function teInputWidth(inputCell: HTMLInputElement) {
    const topContainer = inputCell.ownerDocument.querySelector(
      `#zotero-prefpane-${config.addonRef}`,
    );
    const spanContainer = inputCell.ownerDocument.createElement("div");
    const spanShowWidth = inputCell.ownerDocument.createElement("span");
    spanContainer.appendChild(spanShowWidth);
    topContainer?.appendChild(spanContainer);
    spanContainer.style.position = "fixed";
    spanContainer.style.top = "-1000px"; //@ts-ignore has
    treeInstance.spanShowWidth = spanShowWidth;
    return function () {
      spanShowWidth.textContent = inputCell.value;
      if (inputCell.scrollWidth < inputCell.clientWidth)
        inputCell.style.width = spanShowWidth.scrollWidth + "px";
    };
    //return width2;
  }

  function getRowElement(index?: number) {
    if (!index) index = treeInstance.selection.focused; //@ts-ignore has
    return treeInstance._jsWindow.getElementByIndex(index);
  }

  function getColumn(index: number) {
    //@ts-ignore has
    const columns = treeInstance._getVisibleColumns(); //@ts-ignore has
    return columns[index];
  }
  function discardEditing() {
    //是否需要恢复行数据？
    if (!treeInstance.mount.editingRow) return;
    const oldCells = treeInstance.mount.editingRow["oldCells"];
    if (!oldCells) return;
    const currentCells = treeInstance.mount.editingRow["currentCells"];
    if (!oldCells || !currentCells) return;
    for (let i = 0; i < currentCells.length; i++) {
      currentCells[i].parentNode?.replaceChild(oldCells[i], currentCells[i]);
    }
    treeInstance.mount.clearEditing();
    treeInstance.invalidate();
  }
  //单元格从编辑状态复原
  function commitEditing(newCell?: HTMLElement, oldCell?: HTMLElement) {
    //@ts-ignore has
    if (!oldCell) oldCell = treeInstance.oldCell; //@ts-ignore has
    if (!oldCell) return; //@ts-ignore has
    const inputCell = newCell ? newCell : treeInstance.inputCell; //@ts-ignore has
    if (!inputCell) return;
    const index = treeInstance.mount.editIndex;
    if (index == void 0) return;
    //@ts-ignore has
    const key: string = oldCell.classList[1];
    if (oldCell!.textContent == inputCell.value) {
      inputCell.parentNode?.replaceChild(oldCell, inputCell);
      return;
    }
    treeInstance.changeData(index, key, inputCell.value);
  }

  async function clickTableOutsideCommit(e: MouseEvent,) {
    if (!outside(e, treeInstance._topDiv!)) return;
    await treeInstance.mount.saveDate(saveAccounts);
  }



  function commitEditingRow() {
    if (!treeInstance.mount.editingRow) return;
    const oldCells = treeInstance.mount.editingRow["oldCells"];
    const currentCells = treeInstance.mount.editingRow["currentCells"];
    if (!oldCells || !currentCells) return;
    const keys = Object.keys(rows[0]);
    const changeCellIndices = [];
    if (treeInstance.mount.editIndex != void 0) {
      const rowElement = getRowElement(treeInstance.mount.editIndex);
      // 输入单元格为 input 标签，如果为 span 说明为非编辑状态，表明之前没有清除编辑状态
      if (rowElement.children[0].tagName == "span") {
        treeInstance.mount.clearEditing();
        return;
      }
    }
    /* const selectedIndex = Array.from(treeInstance.selection.selected)[0];
        if (selectedIndex != treeInstance.mount.editIndex){
     
        } */
    for (let i = 0; i < currentCells.length; i++) {
      if (oldCells[i].textContent != currentCells[i].value) {
        changeCellIndices.push(i);
      }
      if (
        currentCells[i].value.includes(EmptyValue) &&
        [keys[0], keys[1]].includes(keys[i])
      ) {
        showInfo(
          keys[0] + " or " + keys[1] + " cannot be the default EmptyValue",
        );
        //@ts-ignore has

        return;
      }
    }
    if (!changeCellIndices.length) return;

    for (let i = 0; i < currentCells.length; i++) {
      if (currentCells[i].value.includes(EmptyValue)) {
        currentCells[i].value =
          DEFAULT_VALUE[keys[i] as keyof typeof DEFAULT_VALUE];
        if (!currentCells[i].value) return;
      }
      commitEditing(currentCells[i], oldCells[i]);
    }
    // stopRowEditing();
  }
  //@ts-ignore has
  treeInstance.commitEditingRow = commitEditingRow;
  //更新翻译引擎账号，清除编辑标志，重新渲染表格
  async function saveAccounts() {
    const dc = treeInstance.mount.dataChangedCache;
    if (!dc) return;
    const indices = Object.keys(dc);
    if (!dc || !indices?.length) {
      treeInstance.mount.clearEditing();
      return;
    }
    const serviceAccountsSave = [];
    for (const index of indices) {
      if (index == void 0) return;
      const changedKeys = Object.keys(dc[index]);
      changedKeys.splice(changedKeys.indexOf("originRow"), 1); //移除不用的key
      const rowData = rows[Number(index)]; //当前数据源一行
      const noDatas = Object.values(rowData).filter((e: any) =>
        e.endsWith("No Data"),
      );
      if (noDatas.length) {
        showInfo("has empty data");
        return;
      }
      let serviceID = getElementValue("serviceID") as string;
      if (["baiduModify", "baidufieldModify"].includes(serviceID)) {
        serviceID = serviceID.replace("Modify", "");
      }
      const serialNumber = getSerialNumberSync(serviceID, rowData.appID);
      //比较false==0的结果为true
      //if (typeof serialNumber != "boolean" && serialNumber != void 0) {
      if (serialNumber >= 0) {
        //更新账号
        const serviceAccount = getServiceAccountSync(serviceID, serialNumber);
        if (!serviceAccount) continue;
        changedKeys.filter((key) => {
          if (
            rowData[key] != serviceAccount[key as keyof TranslateServiceAccount]
          ) {
            if (!serviceAccount.changedData) serviceAccount.changedData = {};
            serviceAccount.changedData[key] = rowData[key];
            if (!serviceAccount.previousData) serviceAccount.previousData = {};
            serviceAccount.previousData[key] =
              serviceAccount[key as keyof TranslateServiceAccount];
            //@ts-ignore has 修改 services
            serviceAccount[key] = rowData[key];
          }
        });
        //serviceAccount.save()
        serviceAccountsSave.push(serviceAccount);
      } else {
        try {
          const account = saveNewAccount(rowData);
          serviceAccountsSave.push(account);
          if (account.serviceID.includes("baidu")) {
            const serviceID2 = account.serviceID == "baidu" ? "baidufield" : "baidu";
            const rowData2 = deepClone(rowData);
            rowData2.charConsum = 0;
            const account2 = saveNewAccount(rowData2, serviceID2);
            serviceAccountsSave.push(account2);
          }
        } catch (e) {
          notifyAccountSave(serviceAccountsSave);
          treeInstance.mount.clearEditing();
          treeInstance.invalidate();
          throw e;
        }
      }
    }
    notifyAccountSave(serviceAccountsSave);
    treeInstance.mount.clearEditing();
    treeInstance.invalidate();

  }

  function saveNewAccounts(rows: any[]) {
    const serviceAccountsSave = [];
    for (const rowData of rows) {
      try {
        serviceAccountsSave.push(saveNewAccount(rowData));
      } catch (e) {
        notifyAccountSave(serviceAccountsSave);
        treeInstance.mount.clearEditing();
        treeInstance.invalidate();
        throw e;
      }
    }
    notifyAccountSave(serviceAccountsSave);
    treeInstance.mount.clearEditing();
    treeInstance.invalidate();

  }

  function notifyAccountSave(obj: any | any[]) {
    if (!Array.isArray(obj)) obj = [obj]; //
    Zotero.Notifier.trigger("add", "item", [999999999999], { data: obj }, true);
    //event, type, ids, extraData, force
    /**
     * Trigger a notification to the appropriate observers
     *
     * Possible values:
     *
     * 	event: 'add', 'modify', 'delete', 'move' ('c', for changing parent),
     *		'remove' (ci, it), 'refresh', 'redraw', 'trash', 'unreadCountUpdated', 'index'
     * 	type - 'collection', 'search', 'item', 'collection-item', 'item-tag', 'tag',
     *		'group', 'relation', 'feed', 'feedItem'
     * 	ids - single id or array of ids
     *
     * Notes:
     *
     * - If event queuing is on, events will not fire until commit() is called
     * unless _force_ is true.
     *
     * - New events and types should be added to the order arrays in commit()
     **/

    //var _types = [		'collection', 'search', 'share', 'share-items', 'item', 'file',		'collection-item', 'item-tag', 'tag', 'setting', 'group', 'trash',		'bucket', 'relation', 'feed', 'feedItem', 'sync', 'api-key', 'tab',		'itemtree'	]

    /* 
        
        Zotero.Notifier.trigger('add', 'tab', [id], { [id]: data }, true);
    ('close', 'tab', [closedIDs], true);
    ('select', 'tab', [tab.id], { [tab.id]: { type: tab.type } }, true);
    ('open', 'file', item.id);
    ('redraw', 'item', []);
    ('open', 'file', attachment.id);
    () on an undo or redo
    (eventParts[0], eventParts[1], data['id']);
    ('delete', 'collection', 'document');
    ('add', 'collection', 'document');
    ('modify', 'item', [item.id]);
    ('refresh', 'item', [itemID]);
    ('refresh', 'item', itemIDs);
    ('redraw', 'item', item.id, { column: "hasAttachment" });
    ('redraw', 'item', parentItem.id, { column: "hasAttachment" });
    (event, 'setting', [id], extraData);
    ('delete', 'setting', [id], extraData);
    ('statusChanged', 'feed', this.id);
    ('unreadCountUpdated', 'feed', this.id);
    ('modify', 'item', ids, {});
    ('refresh', 'item', this.id);
    ('removeDuplicatesMaster', 'item', item.id, null, true);
    ('refresh', 'trash', libraryID);
    ('refresh', 'item', idsToRefresh);
    ('redraw', 'item', affectedItems, { column: 'title' });
    ('download', 'file', item.id);
    ('delete', 'api-key', []);
    ('modify', 'api-key', []);
    ('start', 'sync', []);
    ('finish', 'sync', librariesToSync || []);
    ('redraw', 'collection', []);
        
        */
  }

  function pasteAccount() {
    window.navigator.clipboard
      .readText()
      .then(async (v) => {
        const serviceID = getElementValue("serviceID") as string;
        const text: string = v;
        const confirm = win?.confirm(
          "账号信息将要添加到翻译引擎：" + serviceID + " 中。请确认。",
        );
        if (!confirm) return;
        await batchAddAccount(text);
        //tableHelper.render();
      })
      .catch((v) => {
        ztoolkit.log("Failed To Read Clipboard: ", v);
      });
  }

  async function batchAddAccount(text: string) {
    if (!text) return;
    let serviceID = getElementValue("serviceID") as string;
    if (["baiduModify", "baidufieldModify"].includes(serviceID)) {
      serviceID = serviceID.replace("Modify", "");
    }
    if (!dataVerify[serviceID]) {
      throw new Error(serviceID + ": No validation method defined for this engine, unable to validate data");
    }
    const textArr = text.split(/\r?\n/).filter((e) => e);
    const valuesArr = textArr.map((str: string) =>
      str.split(/[# \t,;，；]+/).filter((e) => e),
    );
    const keys = Object.keys(rows[0]);
    for (const values of valuesArr) {
      if (
        !["chatgpt", "azuregpt", "gemini"].includes(serviceID) &&
        !dataVerify[serviceID](keys, values)
      ) {
        showInfo(serviceID + "：数据格式未通过验证");
        const info =
          "appID#secretKey#usable#consumes: 2222222#g8g8g8g8g8#0#800; or appID#secretKey: 2222222#g8g8g8g8g8";
        const dataFormat: any = {
          baidu: info,
          caiyun: "appID 任意。token（secretKey）长度 20。" + info,
          tencent: "appID 长度36, secretKey 长度 32。" + info,
          niutranspro: "appID 任意。API-KEY 长度 32。" + info,
          microsoft: "appID 任意。secretKey 长度 32。。" + info,
          youdaozhiyun: "appID 任意。secretKey 长度 32。。" + info,
          deeplfree: "appID 任意。secretKey 长度 >= 36。" + info,
          deeplpro: "appID 任意。secretKey 长度 >= 36。" + info,
        };
        showInfo(serviceID + " 数据格式样例：" + dataFormat[serviceID]);
        throw new Error(serviceID + "：数据格式未通过验证");
      }
    }

    const pasteRows = valuesArr.map((values: string[]) => {
      const row: any = kvArrsToObject(keys)(values);
      Object.keys(row).filter((key: string, i: number) => {
        if ((row[key] as string).includes(EmptyValue)) {
          row[key] = DEFAULT_VALUE[key as keyof typeof DEFAULT_VALUE];
        }
      });
      return row;
    });

    const newRows = pasteRows.filter(
      (pasteRow: any) => !rows.find((row: any) => !differObject(pasteRow, row)),
    );
    if (newRows && pasteRows && newRows.length != pasteRows.length) {
      ztoolkit.log(
        pasteRows.length - newRows.length + " " + getString("info-filtered"),
      );
    }
    if (pasteRows.length - newRows.length) {
      showInfo(pasteRows.length - newRows.length + " 条记录被过滤掉了");
      if (!newRows.length) throw new Error("没有新记录");
      showInfo("添加了 " + newRows.length + " 条记录");
    }
    const noneEmptys = rows.filter(
      (e) =>
        !Object.values(e).filter((str: any) => str.includes("No Data")).length,
    );
    rows.length = 0;
    if (noneEmptys.length) rows.push(...noneEmptys);
    rows.push(...newRows);

    saveNewAccounts(newRows);
    tableHelper.render();
    await priorityWithKeyTable();
  }

  /*  function clearEditing() {
     [
       "dataChangedCache",
       "editIndex",
       "editingRow",
       "editIndices",
       "editingRow",
     ].forEach((key) => {
       (treeInstance as any)[key] = void 0;
     });
   } */



  function getColumnWidth(index: number) {
    const COLUMN_PADDING = 16;
    //@ts-ignore has
    const columns = treeInstance._getVisibleColumns();
    const proportion =
      columns[index].width /
      columns
        .map((c: any) => c.width)
        .reduce((sum: number, number: number) => sum + number, 0);

    //@ts-ignore has
    const tableWidth = treeInstance._topDiv.getBoundingClientRect().width;
    return Math.round(proportion * tableWidth * window.devicePixelRatio);
  }

  // const saveDebounce = Zotero.Utilities.debounce(saveTx, 10000);

  function getcellIndex(e: Event) {
    //@ts-ignore has
    //如果代码触发双击，则返回 0
    const x = e.x;
    if (!x) {
      return 0;
      /*  const clickEvent = new window.MouseEvent('click', {
                 bubbles: true,
                 cancelable: true,
             });
             e.target!.dispatchEvent(clickEvent);
             x = clickEvent.x; */
    }
    if (!e.target) return 0;
    const parent = e.target as HTMLElement;
    function left(el: HTMLElement) {
      return el.getBoundingClientRect().x;
    }
    function right(el: HTMLElement) {
      return el.getBoundingClientRect().x + el.getBoundingClientRect().width;
    }
    for (let i = 0; i < parent.childNodes.length; i++) {
      if (
        //@ts-ignore has
        e.x >= left(parent.childNodes[i]) && //@ts-ignore has
        e.x <= right(parent.childNodes[i])
      ) {
        return i;
      }
    }
  }

  function resizeColumnWidth(
    columIndexOrKey: number | string,
    extendValue?: number,
  ) {
    const onResizeData: any = {};
    let column;
    if (typeof columIndexOrKey === "number") {
      column = getColumn(columIndexOrKey);
    }
    if (typeof columIndexOrKey === "string") {
      //@ts-ignore has
      const temps = treeInstance._getColumns().filter((e: any) => e.dataKey == columIndexOrKey);
      if (temps.length == 0) return;
      column = temps[0];
    }
    if (!column) return;
    onResizeData[column.dataKey] = column.width + extendValue; //@ts-ignore has
    treeInstance._columns.onResize(onResizeData);
  }
  function resize() {
    const columns = treeInstance._getVisibleColumns(); //@ts-ignore has
    treeInstance._columns.onResize(
      Object.fromEntries(columns.map((c: any) => [c.dataKey, c.width])),
    );

    // const styleIndex = treeInstance._columns._columnStyleMap[dataKey]
    //@ts-ignore has
    // treeInstance._columns._stylesheet.sheet.cssRules[styleIndex].style.setProperty('flex-basis', `200px`);
  }

  async function addRecord(e: Event) {
    if (treeInstance.mount.editIndex != void 0) {
      //@ts-ignore has
      treeInstance.commitEditingRow();
    }
    const rows = treeInstance.mount.rowsData || [];
    const serviceID = getElementValue("serviceID");
    const emptyrows = (await secretKeysRows(serviceID, true)) || [];
    if (emptyrows.length == 0) {
      const keys = Object.keys(rows[0]);
      const row = arrToObj(
        keys,
        keys.map((k) => k + ": No Data"),
      );
      emptyrows.push(row);
    }
    rows.push(emptyrows[0]);
    //treeInstance.render();
    treeInstance.invalidate();
    treeInstance.selection.select(rows.length - 1); //@ts-ignore has
    const seletedRow = treeInstance._topDiv.querySelectorAll(
      //@ts-ignore has
      `#${treeInstance._jsWindowID} [aria-selected=true]`,
    )[0];
    if (!seletedRow) {
      showInfo("No seletedRow");
      return;
    }
    const dblClickEvent = new window.MouseEvent("dblclick", {
      bubbles: true,
      cancelable: true,
    });
    seletedRow.dispatchEvent(dblClickEvent); //发送鼠标双击，模拟激活节点，直接开始编辑
  }
  async function addRecordBulk(e: Event) {
    let text = (await readTextFiles()) as string;
    text = verigyServiceID(text) as string;
    await batchAddAccount(text);
    //tableHelper.render();
  }
  async function addOldCryKey(e: Event) {
    await Cry.importCryptoKey();
    return;
  }
}

export function saveNewAccount(rowData: any, serviceID?: string) {
  const serialNumber = getNextServiceSNSync();
  const accuntOptions: any = {};
  serviceID = serviceID ? serviceID : getElementValue("serviceID") as string;
  if (["baiduModify", "baidufieldModify"].includes(serviceID)) {
    serviceID = serviceID.replace("Modify", "");
  }
  accuntOptions.serviceID = serviceID;
  accuntOptions.serialNumber = serialNumber; //
  Zotero.Utilities.Internal.assignProps(accuntOptions, rowData);
  accuntOptions.forbidden = false;
  const account = new TranslateServiceAccount(accuntOptions);
  const service = addon.mountPoint.services[serviceID];
  if (!service) {
    throw new Error("service not found: " + service);
  }
  if (!service.accounts) service.accounts = [];
  service.accounts.push(account);
  return account;
}

export function elemHiddenSwitch(labelIDs: string[], hidden?: boolean) {
  labelIDs.forEach((id) => {
    const elem = getDom(id) as HTMLElement | XUL.Element;
    hidden == void 0 ? (hidden = !elem.hidden) : hidden;
    if (elem) elem.hidden = hidden;
  });
}
export async function priorityWithKeyTable() {
  elemHiddenSwitch(
    ["labelPriorityWithoutKey", "labelPriorityWithKey"],
    !getPref("isPriority"),
  );
  if (!getPref("isPriority")) return;
  const win = addon.data.prefs?.window;
  if (!win) return;
  const id = `${config.addonRef}-` + "servicePriorityWithKey";
  const containerId = `${config.addonRef}-table-servicePriorityWithKey`;
  if (getDom(id)) return;
  const services = await getServices();
  const rowsData: any[] = (await serviceWithKeyRowsData()) || [];
  if (!rowsData || rowsData.length == 0) return;

  //props
  const columnPropValues = makeColumnPropValues(rowsData[0]);
  const columnsProp = arrsToObjs(columnPropKeys)(
    columnPropValues,
  ) as ColumnOptions[];
  const props: VirtualizedTableProps = {
    id: id,
    columns: columnsProp,
    staticColumns: false,
    showHeader: true,
    multiSelect: true,
    getRowCount: () => rowsData.length,
    getRowData: (index: number) => rowsData[index],
    getRowString: handleGetRowString,
    onKeyDown: handleKeyDown,
  };

  const options: TableFactoryOptions = {
    win,
    containerId,
    props,
    rowsData,
  };

  const tableHelper = await tableFactory(options);
  const treeInstance = tableHelper.treeInstance as unknown as VirtualizedTable; //@ts-ignore has
  treeInstance.scrollToRow(rowsData.length - 1);


  async function serviceWithKeyRowsData() {
    //let rows= getRowsByOrderFromDB(hasKey:Boolean)
    const settingValue = await getSettingValue(
      "servicesWithKeyByOrder",
      "services",
    );
    const oldRows = JSON.parse(settingValue);

    const rows = Object.values(services)
      .filter((e) => e.accounts && e.accounts.length)
      .map((e2) => ({
        serviceID: e2.serviceID,
        locale: getString(`service-${e2.serviceID}`),
        forbidden:
          e2.forbidden !== undefined
            ? getString(`forbidden-${String(e2.forbidden)}`)
            : getString("forbidden-false"),
      }));
    const value = JSON.stringify(rows);
    if (value != settingValue) {
      const newRows2 = rows.filter((newRow: any) => !oldRows.find((row: any) => !differObject(newRow, row)));
      const newRows = [];
      for (const row of rows) {
        let has = false;
        for (const oldRow of oldRows) {
          if (!differObject(oldRow, row)) {
            has = true;
            break;
          }
        }
        if (has) continue;
        newRows.push(row);
      }
      if (newRows.length) {
        oldRows.push(...newRows);
        const value = JSON.stringify(oldRows);
        await setSettingValue("servicesWithKeyByOrder", value, "services");
      }
    }

    return oldRows;
  }

  function handleGetRowString(index: number) {
    return getRowString(rowsData, index, treeInstance);
  }

  function handleKeyDown(event: KeyboardEvent) {
    const oldRows = [...rowsData];
    priorityKeyDown(event, rowsData, treeInstance, services).then(
      async (res) => {
        if (objArrDiffer(oldRows, rowsData)) {
          const value = JSON.stringify(rowsData);
          await setSettingValue("servicesWithKeyByOrder", value, "services");
        }
        return res;
      },
    );
    return true;
  }
}

export async function priorityWithoutKeyTable() {
  if (!getPref("isPriority")) return;
  const win = addon.data.prefs?.window;
  if (!win) return;
  const id = `${config.addonRef}-` + "servicePriorityWithoutKey";
  const containerId = `${config.addonRef}-table-servicePriorityWithoutKey`;
  if (getDom(id)) return;
  const services = await getServices();
  const rowsData: any[] = (await getWithoutKeyRowsData()) || [];
  if (!rowsData || rowsData.length == 0) return;

  //props
  const columnPropValues = makeColumnPropValues(rowsData[0]);
  const columnsProp = arrsToObjs(columnPropKeys)(
    columnPropValues,
  ) as ColumnOptions[];
  const props: VirtualizedTableProps = {
    id: id,
    columns: columnsProp,
    staticColumns: false,
    showHeader: true,
    multiSelect: true,
    getRowCount: () => rowsData.length,
    getRowData: (index: number) => rowsData[index],
    getRowString: handleGetRowString,
    onKeyDown: handleKeyDown,
  };

  const options: TableFactoryOptions = {
    win: win,
    containerId: containerId,
    props: props,
    rowsData,
  };

  const tableHelper = await tableFactory(options);
  const treeInstance = tableHelper.treeInstance as unknown as VirtualizedTable; //@ts-ignore has
  treeInstance.scrollToRow(rowsData.length - 1);

  async function getWithoutKeyRowsData() {
    const settingValue = await getSettingValue(
      "servicesWithoutKeyByOrder",
      "services",
    );
    if (settingValue) return JSON.parse(settingValue);
    const rows = Object.values(services)
      .filter((e) => !e.hasSecretKey && !e.hasToken)
      .map((e2) => ({
        serviceID: e2.serviceID,
        locale: getString(`service-${e2.serviceID}`),
        forbidden:
          e2.forbidden !== undefined
            ? getString(`forbidden-${String(e2.forbidden)}`)
            : getString("forbidden-false"),
      }));
    const value = JSON.stringify(rows);
    await setSettingValue("servicesWithoutKeyByOrder", value, "services");
    return rows;
  }

  function handleGetRowString(index: number) {
    return getRowString(rowsData, index, treeInstance);
  }
  function handleKeyDown(event: KeyboardEvent) {
    const oldRows = [...rowsData];
    priorityKeyDown(event, rowsData, treeInstance, services).then(
      async (res) => {
        if (objArrDiffer(oldRows, rowsData)) {
          const value = JSON.stringify(rowsData);
          await setSettingValue("servicesWithoutKeyByOrder", value, "services");
        }

        return res;
      },
    );
    return true;
  }
}







export function makeColumnPropValues(row: any) {
  // 本地化 ftl 文件中条目的前缀
  const prefTableStringPrefix = "prefs-table-";

  const temp = Object.keys(row).map((key: string, i: number) => {
    //let type = '';
    // getString 未找到相应本地化字符串时，返回`${config.addonRef}-${localeString}`
    let label = getString(`${prefTableStringPrefix}${key}`);
    if (!label || label.startsWith(config.addonRef)) {
      label = key;
    }
    const result: any[] = [key, label];
    result.push(false, false);
    if (i == 1) {
      result.push(2);
    } else {
      result.push(1);
    }
    /* if (key == "usable") {
            type = 'checkbox';
        }
        result.push(type); */
    return result;
  });
  return temp;
}
export function getRowString(rows: any, index: number, treeInstance: any) {
  const rowCellsString = Object.values(rows[index]).filter(
    (e) => typeof e === "string",
  ) as string[];
  if (rowCellsString.length === 0) return ""; //@ts-ignore has
  const typingString = treeInstance._typingString as string;
  const matchCells = rowCellsString.filter((str: string) =>
    str.toLowerCase().includes(typingString),
  );
  if (matchCells.length > 0) {
    return matchCells[0];
  } else {
    return "";
  }
}

export async function updateServiceData(
  serviceAccount: TranslateService | TranslateServiceAccount,
  key: string,
  value: any,
) {
  if (serviceAccount[key as keyof typeof serviceAccount] == value) return;
  if (!serviceAccount.changedData) serviceAccount.changedData = {};
  serviceAccount.changedData[key] = value;
  if (!serviceAccount.previousData) serviceAccount.previousData = {};
  serviceAccount.previousData[key] =
    serviceAccount[key as keyof typeof serviceAccount];
  serviceAccount[key as keyof typeof serviceAccount] = value;
  await serviceAccount.saveChange();
}

export async function changedData(
  serviceAccount: TranslateService | TranslateServiceAccount,
  key: string,
  value: any,
) {
  if (!serviceAccount.changedData) serviceAccount.changedData = {};
  serviceAccount.changedData[key] = value;
  if (!serviceAccount.previousData) serviceAccount.previousData = {};
  serviceAccount.previousData[key] =
    serviceAccount[key as keyof typeof serviceAccount];
  serviceAccount[key as keyof typeof serviceAccount] = value;
}

/**
 * 获取引擎账号或空数据
 * @param serviceID
 * @param getEmptyData
 * @returns
 */
async function secretKeysRows<T extends keyof TranslateService>(
  serviceID: T,
  getEmptyData: boolean = false,
) {
  let services = await getServices();
  if (["baiduModify", "baidufieldModify"].includes(serviceID)) {
    serviceID = serviceID.replace("Modify", "") as T;
  }
  let serviceSelected = services[serviceID];
  if (!serviceSelected || !serviceSelected.accounts) {
    services = await getServicesFromDB();
    serviceSelected = services[serviceID];
    if (!serviceSelected) return;
  }
  let rows: any[];
  if (!serviceSelected.hasSecretKey && !serviceSelected.hasToken) return;
  const secretKeyOrtoken = serviceSelected.hasSecretKey ? "secretKey" : "token";
  const keys = ["appID", secretKeyOrtoken, "usable", "charConsum"];
  if (
    !serviceSelected.accounts ||
    !serviceSelected.accounts.length ||
    getEmptyData
  ) {
    return (rows = [kvArrsToObject(keys)()]); // 返回空数据
  }
  //const keys = Object.keys(serviceSelected.accounts[0]);// feild much more
  const getRowDataValues = kvArrsToObject(keys);
  const accounts = serviceSelected.accounts.filter(
    (account) => !account.forbidden,
  );
  rows = accounts.map((acount: TranslateServiceAccount) =>
    getRowDataValues(
      keys.map((key) => acount[key as keyof TranslateServiceAccount]),
    ),
  );
  return rows;
}

/**
 * Auto fill with " key + ': '+ EmptyValue " when no values
 * @param keys
 * @returns
 */
function kvArrsToObject(keys: string[]) {
  return function (values?: any | any[]) {
    if (!values) values = [];
    if (!Array.isArray(values)) values = [values];
    return arrToObj(
      keys,
      keys.map((k, i) =>
        values[i] !== void 0 ? String(values[i]) : k + ": " + EmptyValue,
      ),
    );
  };
}

async function priorityKeyDown(
  event: KeyboardEvent,
  rows: any[],
  treeInstance: any,
  services: ServiceMap,
) {
  //return返回的是控制默认按键功能是否启用

  if (
    event.key == "Delete" ||
    event.key == "Backspace" ||
    (Zotero.isMac && event.key == "Backspace")
  ) {
    //获取要禁用的行数据，
    const rowDataForbidden = rows.filter((v, i) =>
      treeInstance.selection.isSelected(i),
    );
    //确认删除，点击cancel则取消
    const confirm = addon.data.prefs!.window.confirm(
      getString("info-forbidden") + "\n" + getString("info-delete-confirm"),
    );
    if (!confirm) return true;

    //选中行的引擎，获得秘钥，设forbidden 为 true
    if (rowDataForbidden.length) {
      for (const rowData of rowDataForbidden) {
        const serviceID = rowData.serviceID;
        await updateServiceData(services[serviceID], "forbidden", true);
        //services[serviceID]["forbidden"] = true;
        rowData["forbidden"] = getString(`forbidden-true`);

        const element = getDom(serviceID) as any;
        if (element && element.isMenulistChild) {
          element.remove();
        }
      }
    }

    treeInstance.invalidate();
  }
  if (event.key == "ArrowUp") {
    rows.map((v, i) => {
      if (treeInstance.selection.isSelected(i)) {
        if (i > 0) {
          const temp = rows[i];
          rows[i] = rows[i - 1];
          rows[i - 1] = temp;
        }
      }
    });
    treeInstance.invalidate();
  }
  if (event.key == "ArrowDown") {
    rows.map((v, i) => {
      if (treeInstance.selection.isSelected(i)) {
        if (i < rows.length - 1) {
          const temp = rows[i];
          rows[i] = rows[i + 1];
          rows[i + 1] = temp;
        }
      }
    });
    treeInstance.invalidate();
  }
  return true;
}

export async function readTextFiles(filePaths?: string[]) {
  if (!filePaths) filePaths = await chooseDirOrFilePath("files");
  let text = "";
  for (let i = 0; i < filePaths.length; i++) {
    const MIME = await Zotero.MIME.getMIMETypeFromFile(filePaths[i]);
    if (MIME != "text/plain") {
      const fileName = PathUtils.filename(filePaths[i]);
      showInfo(fileName + " is not a plain text file. Skip it.");
      continue;
    }
    const result = await Zotero.File.getContentsAsync(filePaths[i]); // 读取拖拽文件内容
    if (typeof result != "string") continue;
    text += result;
  }
  return text;
}

function baiduVerify(keys: any[], values: any[]) {
  const reg = {
    appID: /^\d{17}$/m,
    secretKey: /^[A-Za-z\d_]{20}$/m,
  };
  return coreVerify(keys, values, reg);

}
function coreVerify(keys: any[], values: any[], reg: any) {
  const reg2 = {
    usable: /\d/,
    charConsum: /^\d+$/m,
  };
  reg = Object.assign(reg, reg2);

  for (let i = 0; i < values.length; i++) {
    // @ts-ignore xxx
    if (!regRes(values[i], reg[keys[i]])) return false;
  }
  return true;
  function regRes(value: string, reg: RegExp) {
    const match = value.match(reg);
    if (match) {
      if (match[0] == value) return true;
    }
  }
}
function caiyunVerify(keys: any[], values: any[]) {
  const reg = {
    appID: /^.+$/m,
    secretKey: /^[A-Za-z\d]{20}$/m,
    token: /^[A-Za-z\d]{20}$/m,
  };

  return coreVerify(keys, values, reg);
}
function tencentVerify(keys: any[], values: any[]) {
  const reg = {
    appID: /^[A-Za-z\d]{36}$/m,
    secretKey: /^[A-Za-z\d]{32}$/m,
  };

  return coreVerify(keys, values, reg);
}

function niutransproVerify(keys: any[], values: any[]) {
  const reg = {
    appID: /^.+$/m,
    secretKey: /^[a-z\d]{32}$/m,
  };

  return coreVerify(keys, values, reg);
}
function microsoftVerify(keys: any[], values: any[]) {
  const reg = {
    appID: /^.+$/m,
    secretKey: /^.{32}$/m,
  };

  return coreVerify(keys, values, reg);
}

function youdaozhiyunVerify(keys: any[], values: any[]) {
  const reg = {
    appID: /^.+$/m,
    secretKey: /^.{32}$/m,
  };

  return coreVerify(keys, values, reg);
}

function deeplVerify(keys: any[], values: any[]) {
  const reg = {
    appID: /^.+$/m,
    secretKey: /^.{36,}$/m,
  };

  return coreVerify(keys, values, reg);
}

function aliyunVerify(keys: any[], values: any[]) {
  const reg = {
    appID: /^[A-Za-z\d]{24}$/m,
    secretKey: /^[A-Za-z\d]{30}$/m,
  };

  return coreVerify(keys, values, reg);
}
function chatgptVerify(keys: any[], values: any[]) {
  /* const reg = {
        "appID": /^[A-Za-z\d]{24}$/m,
        "secretKey": /^[A-Za-z\d]{30}$/m,
    };

    return coreVerify(keys, values, reg); */
}

function azuregptVerify(keys: any[], values: any[]) {
  /* const reg = {
        "appID": /^[A-Za-z\d]{24}$/m,
        "secretKey": /^[A-Za-z\d]{30}$/m,
    };

    return coreVerify(keys, values, reg); */
}

function geminiVerify(keys: any[], values: any[]) {
  /* const reg = {
        "appID": /^[A-Za-z\d]{24}$/m,
        "secretKey": /^[A-Za-z\d]{30}$/m,
    };

    return coreVerify(keys, values, reg); */
}

export function getSelectedRow(singleRow: boolean = true) {
  const tableHelper = getTableByID(`${config.addonRef}-` + "secretKeysTable");
  if (!tableHelper) return;
  const treeInstance = tableHelper.treeInstance as any;
  const selecedRows = treeInstance._topDiv.querySelectorAll(
    `#${treeInstance._jsWindowID} [aria-selected=true]`,
  );
  if (singleRow) {
    return selecedRows[0] as HTMLElement;
  }
  return selecedRows;
}

export async function updateTable<T extends keyof TranslateService>(
  tableID: string,
  serviceID: T,
) {
  const tableHelper = getTableByID(tableID);
  if (!tableHelper) return;
  const rowsNew = await secretKeysRows(serviceID);
  if (!rowsNew?.length) return;
  const oldrows = tableHelper.treeInstance.rows as any[];
  oldrows.length = 0;
  oldrows.push(...rowsNew);
  //if (!oldrows.length) return;
  //const temp = [...oldrows];
  //for (const oldrow of temp) {
  //    if (rowsNew.some((row: any) => row.appID == oldrow.appID)) continue;
  //    oldrows.splice(oldrows.indexOf(oldrow), 1);
  //}
  tableHelper.render();
  return true;
}

export function getTableByID(tableID?: string) {
  if (!addon.mountPoint.tables) return;
  const tables = addon.mountPoint.tables;
  if (!tableID) return tables;
  if (!tableID.includes(`${config.addonRef}-`))
    tableID = `${config.addonRef}-` + tableID;
  const element = addon.data.prefs?.window.document.getElementById(tableID);
  if (!element) return;
  return tables[tableID];
}






async function readTextFilesDroped(e: DragEvent) {
  // 文件拖拽
  if (!e.dataTransfer) return false; //
  const dragData = Zotero.DragDrop.getDataFromDataTransfer(e.dataTransfer);
  if (!dragData) {
    //
    Zotero.debug("No drag data");
    return false;
  }
  const data = dragData.data;
  return await readTextFiles(data);
}

export async function encryptSecretKeyOrToken(rows: any[]) {
  if (!(await encryptState())) return;
  if (!Array.isArray(rows)) rows = [rows];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!["secretKey", "token"].includes(key)) continue;
      if (row[key] == DEFAULT_VALUE[key as keyof typeof DEFAULT_VALUE])
        continue;
      row[key] = await encryptByAESKey(row[key]);
    }
  }
}
