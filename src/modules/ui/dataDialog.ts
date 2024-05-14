import { ColumnOptions } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { config } from "../../../package.json";
import { addonDatabaseDir } from "../../utils/constant";
import { getString } from "../../utils/locale";
import { arrsToObjs, chooseDirOrFilePath, getWindow, showInfo } from "../../utils/tools";
import { aiCHat, getModels } from "../largeLanguageModels/ollama";
import { fullTextTranslate } from "../translate/fullTextTranslate";
import { getSingleServiceUnderUse } from "../translate/serviceManage";
import { getRowString } from "./tableSecretKeys";
import { makeTagElementProps } from "./uiTools";
import { tableFactory } from "./tableFactory";
/**
 * fieldName 用作 Dom id ，不可有空格冒号
 * @param fieldNames
 * @returns
 */
export async function modifyData(fieldNames: string[] | any) {
  const dialogType = "input";
  const title = getString("info-modifyData");
  return await onOpenDialog(fieldNames, dialogType, title);
}

export function selectData(fieldNames: string[]) {
  const dialogType = "multiSelect";
  const title = getString("info-multiSelect");
  return onOpenDialog(fieldNames, dialogType, title);
}

export async function directorySaveCryptoKeys(fieldNames: string[] | string) {
  if (!Array.isArray(fieldNames)) fieldNames = [fieldNames];
  const dialogType = "directory";
  const title = getString("info-selectSavePath");
  return await onOpenDialog(fieldNames, dialogType, title);
}

export function showTrans() {
  const dialogType = "showTrans";
  const title = getString("info-showTrans");
  const fieldNames = ["fieldNames"];
  const url = `chrome://${config.addonRef}/content/dataDialog.xhtml`;
  const io: any = { fieldNames, dialogType, title };
  const win = getWindow();
  win.openDialog(
    url,
    "dataDialog",
    "chrome,centerscreen,resizable=yes,scroll=yes,noDialogMode=true,",
    io,
  );
}

export function showTargeCombine(soureArr: any[], targetArr: any[]) {
  const url = `chrome://${config.addonRef}/content/dataDialog.xhtml`;
  const title = getString("info-targeCombine");
  const dialogType = "targeCombine";
  const io: any = { soureArr, targetArr, title, dialogType };
  const win = getWindow();
  const dialog = win.openDialog(
    url,
    "dataDialog",
    "chrome,modal,centerscreen,resizable=yes,scroll=yes",
    io,
  );
  addon.mountPoint.dialog = dialog;
  return {
    soureArr: io.soureArr,
    targetArr: io.targetArr
  };
}
async function targeCombineUI(dialogType: string, win: Window, parent: XUL.Box, io: any) {
  if (dialogType != "targeCombine") return;
  parent.style.width = "1400px";
  parent.style.height = "800px";
  win.resizeTo(win.screen.availWidth, win.screen.availHeight);
  const soureArr = io.soureArr as string[];
  const targetArr = io.targetArr as string[];
  const hbox = ztoolkit.createXULElement(win.document, "hbox");
  const help = ztoolkit.createXULElement(win.document, "div");
  help.innerText = "选中行，按键 ↑ 箭头译文与向上合并，按键 ↓ 箭头译文向下合并。";
  const div1 = ztoolkit.createXULElement(win.document, "div");
  div1.setAttribute("id", "table-sourceCombine");
  const div2 = ztoolkit.createXULElement(win.document, "div");
  div2.setAttribute("id", "table-targetCombine");
  hbox.appendChild(div1);
  hbox.appendChild(div2);
  parent.appendChild(help);
  parent.appendChild(hbox);
  await translationCombineTable();

  async function translationCombineTable() {
    if (!win) return;
    const id = "sourceCombine";
    const containerId = `table-sourceCombine`;
    function getRows() {
      const newArr = [];
      for (let i = 0; i < targetArr.length; i++) {
        newArr.push([i, soureArr[i] || '', targetArr[i]]);
      }
      const rows: any[] = arrsToObjs(["index", "sourceText", "translation"])(newArr) || [];
      return rows;
    }
    const rows: any[] = getRows();


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
        ["index", "index", false, false, true, 20],
        ["sourceText", "sourceText", false, false, true, 400],
        ["translation", "translation", false, false, true, 400],
      ]
    ) as ColumnOptions[];
    const props: VirtualizedTableProps = {
      id: id,
      columns: columnsProp,
      staticColumns: false,
      showHeader: true,
      multiSelect: true,
      getRowCount: () => rows.length,
      getRowData: (index: number) => rows[index],
      getRowString: handleGetRowString,
      onKeyDown: handleKeyDown,
      containerWidth: 1200,
    };

    const options: TableFactoryOptions = {
      win: win,
      containerId: containerId,
      props: props,
      rowsData: rows,
    };

    const tableHelper = await tableFactory(options);
    const tableTreeInstance = tableHelper.treeInstance; //@ts-ignore has
    tableTreeInstance._jsWindow.innerElem.style.width = "1400px";

    function handleGetRowString(index: number) {
      return getRowString(rows, index, tableTreeInstance);
    }

    function combineRows(type: "up" | "down" | "recover") {
      if (!addon.mountPoint.rowsPrevious) addon.mountPoint.rowsPrevious = [];
      const rowsPrevious: any[] = addon.mountPoint.rowsPrevious;
      let index = tableTreeInstance.selection.focused;
      if (index == void 0) index = Array.from(tableTreeInstance.selection.selected)[0];
      if (index == void 0) return true;
      if (type == "up") {
        if (index == 0) return true;
        rowsPrevious.push([...targetArr]);
        targetArr[index - 1] += targetArr[index];
        targetArr.splice(index, 1);

      } else if (type == "down") {
        if (index == targetArr.length - 1) return;
        rowsPrevious.push([...targetArr]);
        targetArr[index + 1] += targetArr[index];
        targetArr.splice(index, 1);

      } else {
        if (!rowsPrevious || !rowsPrevious.length) return;
        targetArr.length = 0;
        targetArr.push(...rowsPrevious.slice(-1)[0]);
      }
      rows.length = 0;
      rows.push(...getRows());

      tableTreeInstance.invalidate();
      //@ts-ignore xxx
      tableTreeInstance._jsWindow.innerElem.style.width = "1400px";


    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key == "ArrowUp") {
        combineRows("up");

      }
      if (event.key == "ArrowDown") {
        combineRows("down");

      }
      if ((event.ctrlKey || event.metaKey) && event.key == "z") {
        combineRows("recover");
      }
      return true;
    }

  }
}

function transUI(dialogType: string, win: Window, parent: XUL.Box) {
  if (dialogType != "showTrans") return;
  const dialog = win.document.documentElement.children[2] as any;
  const acceptButton = dialog.getButton("accept");
  acceptButton.label = "Enter 翻译";
  const originTextStyle = `height: 150px; margin-inline: 1rem`;
  const originText = ztoolkit.UI.appendElement(
    {
      tag: "textarea",
      attributes: {
        placeholder: "原文",
        rows: "10",
        cols: "80",
        style: originTextStyle,
      },
      listeners: [
        {
          type: "change", //内容没有变化不会翻译
          listener: tran,
        },
        {
          type: "input",
          //listener: (e) => tranThrottle(e)
          listener: () => tranThrottle(),
        },
      ],
    },
    parent,
  ) as HTMLTextAreaElement;
  const divStyle = `min-height: 50px; margin-inline: 1rem`;
  const showText = ztoolkit.UI.appendElement(
    {
      tag: "div",
      attributes: {
        style: divStyle,
      },
      children: [
        {
          tag: "span",
          properties: {
            innerText: "译文",
          },
        },
      ],
    },
    parent,
  );
  //防止窗口关闭，文本区域失焦开始翻译

  async function tran() {
    if (!addon.mountPoint.chatCache) addon.mountPoint.chatCache = new WeakMap();
    const cache = addon.mountPoint.chatCache;
    const value = originText.value;
    if (!value || value == "") return;
    const service = await getSingleServiceUnderUse();
    if (!service) return;
    const taskTran = { service: service.serviceID, value: value };
    let res;
    if (cache.has(taskTran)) {
      res = cache.get(value);
    } else {
      res = await fullTextTranslate.translateGo(value);
      //res = await addon.mountPoint.transator.polo(value);
      cache.set(taskTran, res);
    }
    const sp = parent.querySelector("span");
    if (!sp) return;
    if (sp.innerText != res) {
      sp.innerText = res;
      adjustHeight(parent);
    }
  }
  //throttle
  const tranThrottle = Zotero.Utilities.debounce(
    tran,
    1500,
    //{ leading: false, trailing: false }
  );

  // 同步返回false，对话框不关闭，异步则会关闭
  acceptButton.onclick = () => {
    tran();
    return false;
  };

  return;
}

export function aITransUI() {
  const dialogType = "aiTrans";
  const title = getString("info-aiTrans");
  const fieldNames = ["fieldNames"];
  const url = `chrome://${config.addonRef}/content/dataDialog.xhtml`;
  const io: any = { fieldNames, dialogType, title };
  const win = getWindow();
  const features = "chrome,centerscreen,scrollbars,resizable";
  //"chrome,centerscreen,resizable=yes,scroll=yes,noDialogMode=true,scrollbars, menubar,toolbar,status"
  win.openDialog(url, "dataDialog", features, io);
}

function onOpenDialog(
  fieldNames: string[] | any,
  dialogType: string,
  title: string,
) {
  const url = `chrome://${config.addonRef}/content/dataDialog.xhtml`;
  const io: any = { fieldNames, dialogType, title };
  const win = getWindow();
  const dialog = win.openDialog(
    url,
    "dataDialog",
    "chrome,modal,centerscreen,resizable=yes,scroll=yes",
    io,
  );
  addon.mountPoint.dialog = dialog;
  return io.dataOut;
  //io负责对话框窗口数据通信
  //window.openDialog chrome,modal，等待用户操作，完成后给 io 赋值
  //modal 模态窗口，等待用户关闭或做出选择后才能继续，fitContent=true,
}

async function aiTransUI(dialogType: string, win: Window, parent: XUL.Box) {
  if (dialogType != "aiTrans") return;
  const dialog = win.document.documentElement.children[2] as any;
  const acceptButton = dialog.getButton("accept");
  const backgroundColor = window
    .getComputedStyle(acceptButton)
    .getPropertyValue("--color-background");
  acceptButton.label = "Enter " + getString("info-send");
  const divStyle = `margin-inline: 1rem; overflow: auto; user-select: text;`;
  const showText = ztoolkit.UI.appendElement(
    {
      tag: "div",
      id: "chatShowText",
      attributes: {
        style: divStyle,
      },
      properties: {
        innerText: getString("info-welcome"),
      },
    },
    parent,
  );
  const originTextStyle = `margin-inline: 1rem; height: auto, min-height: 100px`;
  const originText = ztoolkit.UI.appendElement(
    {
      tag: "textarea",
      attributes: {
        placeholder: getString("dialog-inputDialog"),
        rows: 1,
        cols: 80,
        style: originTextStyle,
      },
      listeners: [
        {
          type: "change",
          listener: originTextAutoHeight,
        },
        {
          type: "input",
          listener: (e: Event) => {
            originTextAutoHeightDebounce(e);
          },
        },
      ],
    },
    parent,
  ) as HTMLTextAreaElement;

  function originTextAutoHeight(e: Event) {
    if (!e.target) return;
    const elem = e.target as HTMLTextAreaElement;
    elem.style.height = "auto";
    elem.style.height = elem.scrollHeight + "px";
    adjustHeight(parent);
  }
  const originTextAutoHeightDebounce = Zotero.Utilities.debounce(
    originTextAutoHeight,
    1000,
  );

  originText.onkeydown = async function send(event: KeyboardEvent) {
    //var msgInput=$(this).val()
    //兼容Chrome和Firefox
    const keyCode = event.keyCode
      ? event.keyCode
      : event.which
        ? event.which
        : event.charCode;
    const altKey = event.ctrlKey || event.metaKey;
    if (keyCode == 13 && altKey) {
      //ctrl+enter换行
      const newDope = originText.value + "\n"; // 获取textarea数据进行 换行
      originText.value = newDope;
    } else if (keyCode == 13) {
      //enter发送
      await runModel(originText);
      event.preventDefault(); //禁止回车的默认换行
    }
  };
  acceptButton.onclick = () => {
    runModel(originText);
    return false;
  };
  const defaultModel = "qwen:latest";
  const models = (await getModels()) as string[];
  if (models.indexOf(defaultModel)) {
    models.splice(models.indexOf(defaultModel), 1);
    models.unshift(defaultModel);
  } else {
    models.unshift("");
  }
  const childrenProps: any[] = models.map((model: string) => ({
    tag: "menuitem",
    namespace: "xul",
    properties: {
      value: model,
      label: model == "" ? getString("info-chooseModel") : model,
    },
  }));

  const modelSelect = ztoolkit.UI.insertElementBefore(
    {
      tag: "menulist",
      namespace: "xul",
      id: "modelSelect",
      children: [
        {
          tag: "menupopup",
          namespace: "xul",
          children: childrenProps,
          styles: {
            backgroundColor: backgroundColor,
            marginInline: "1rem",
          },
        },
      ],
      listeners: [
        {
          type: "command",
          listener: (e: Event) => {
            if (modelSelect.value != "") {
              if (originText.value == getString("info-pleaseChooseModel")) {
                if (addon.mountPoint?.textareaCache) {
                  originText.value = addon.mountPoint.textareaCache;
                  return;
                }
                originText.value = "";
              }
            }
          },
        },
      ],
    },
    acceptButton,
  ) as HTMLSelectElement;
  const providrs = ["ollama", "openAI"];
  const providerProps: any[] = providrs.map((model: string) => ({
    tag: "menuitem",
    namespace: "xul",
    properties: {
      value: model,
      label: model,
    },
  }));
  const providerSelect = ztoolkit.UI.insertElementBefore(
    {
      tag: "menulist",
      namespace: "xul",
      id: "providerSelect",
      children: [
        {
          tag: "menupopup",
          namespace: "xul",
          children: providerProps,
          styles: {
            backgroundColor: backgroundColor,
            marginInline: "1rem",
          },
        },
      ],
      listeners: [
        {
          type: "command",
          listener: (e: Event) => { },
        },
      ],
    },
    modelSelect,
  ) as HTMLSelectElement;

  const streamChecker = ztoolkit.UI.insertElementBefore(
    {
      tag: "checkbox",
      namespace: "xul",
      properties: {
        label: getString("info-stream"),
        checked: true,
      },
      styles: {
        marginInline: "1rem",
      },
    },
    modelSelect,
  ) as XUL.Checkbox;
  //聊天内容

  function addChatContent(
    role: "AI" | "user",
    value: string,
    container: Element,
  ) {
    const buttonListener = {
      type: "click",
      listener: async (e: Event) => {
        const button = e.target as HTMLButtonElement;
        const parentNode = button.parentNode;
        if (button && parentNode) {
          const source = parentNode.childNodes[0].nodeValue;
          if (!source) return;
          const navigator = ztoolkit.getGlobal("navigator");
          await navigator.clipboard.writeText(source);
          //button.style.display="none"
          const newButton = ztoolkit.UI.replaceElement(
            {
              tag: "button",
              namespace: "html",
              properties: {
                innerText: getString("info-copyed"),
              },
              listeners: [buttonListener],
            },
            button,
          ) as HTMLButtonElement;
          setTimeout(() => {
            parentNode?.replaceChild(button, parentNode.children[0]);
            //parentNode?.childNodes[1].replaceWith(button);
          }, 1000);
        }
      },
    };
    let roleLabel, chatStyle;
    if (role == "AI") {
      roleLabel = getString("info-assistant");
      chatStyle = "display:flex; justify-content: left; margin:1rem";
    } else {
      roleLabel = getString("info-user");
      chatStyle = "display:flex; justify-content: right; margin:1rem";
    }
    ztoolkit.UI.appendElement(
      {
        tag: "div",
        namespace: "html",
        attributes: {
          style: chatStyle,
        },

        children: [
          {
            tag: "span",
            properties: {
              innerText: roleLabel,
            },
          },
        ],
      },
      container,
    );

    const chatConten = ztoolkit.UI.appendElement(
      {
        tag: "div",
        namespace: "html",
        attributes: {
          style: chatStyle,
        },

        children: [
          {
            tag: "span",
            properties: {
              innerText: value.trim(),
            },
            children: [
              {
                tag: "button",
                namespace: "html",
                properties: {
                  innerText: getString("info-copy"),
                },
                listeners: [buttonListener],
              },
            ],
          },
        ],
      },
      container,
    );
    return chatConten;
  }

  async function runModel(textarea: HTMLTextAreaElement) {
    const value = textarea.value;
    if (!value || value == "") {
      textarea.value = getString("info-empty");
      return;
    }
    textarea.scrollBy(0, textarea.scrollHeight); //底端对齐
    const model = modelSelect.value;
    if (model.length == 0) {
      addon.mountPoint.textareaCache = textarea.value;
      textarea.value = getString("info-pleaseChooseModel");
      return;
    }
    addChatContent("user", value, showText);
    showText.scrollBy(0, showText.scrollHeight);
    textarea.value = "";
    textarea.style.height = "";
    adjustHeight(parent);
    const role = undefined;
    const stream = streamChecker?.checked;

    const res = await aiCHat(value, model, role, stream);
    if (stream) {
      let first = true;
      let streamContain;
      for await (const part of res) {
        if (first) {
          streamContain = addChatContent("AI", part.message.content, showText);
          showText.scrollBy(0, showText.scrollHeight);
          adjustHeight(parent);
          first = false;
        } else {
          if (streamContain) {
            streamContain.childNodes[0].childNodes[0].nodeValue +=
              part.message.content;
          }
        }
      }
      return;
    }
    addChatContent("AI", res, showText);
    showText.scrollBy(0, showText.scrollHeight);
    adjustHeight(parent);
  }
  return;
}

function adjustHeight(parent: XUL.Box) {
  const originText = parent.children[0] as HTMLTextAreaElement;
  const transText = parent.children[1] as HTMLDivElement;
  let oHeight = originText.scrollHeight;
  oHeight = oHeight > 400 ? 400 : oHeight;
  originText.style.height = oHeight + "px";
  let tHeight = transText.scrollHeight;
  tHeight = tHeight > 200 ? 200 : tHeight;
  transText.style.height = tHeight + "px";
  let h = oHeight + tHeight;
  h = h > 600 ? 600 : h;
  parent.style.height = h + "px";
  //@ts-ignore xxx
  const win = parent.ownerGlobal;
  const totalHeight = parent.ownerDocument.documentElement.scrollHeight;
  if (win.innerHeight < totalHeight) {
    const yDelta = totalHeight - win.innerHeight;
    win.resizeBy(0, yDelta);
    const winYDelta = win.screenY - yDelta;

    if (winYDelta > 0) {
      win.moveBy(0, -winYDelta);
    }
    if (winYDelta <= 0 && win.screenY > 0) {
      win.moveBy(0, -win.screenY);
    }
  }
  if (win.outerHeight > win.screen.availHeight) {
    win.resizeBy(0, win.screen.availHeight - win.outerHeight);
  }
}

export class DataDialog {
  static async onOpenDataDialog(win: Window) {
    const style = `min-width: 300px; max-width: 1200px; margin-inline: 1rem`;
    if (!addon.mountPoint.inputDialog) addon.mountPoint.inputDialog = win;
    //@ts-ignore xxx
    const io = win.arguments[0];
    let fieldNames = io.fieldNames;
    const dialogType = io.dialogType;

    const title = io.title;
    if (title) win.document.title = title;
    const parent = win.document.querySelector("#input") as XUL.Box;
    if (!parent) return;

    win.document.addEventListener("dialogaccept", () =>
      DataDialog.handleAccept(win),
    );
    win.document.addEventListener("dialogcancel", () =>
      DataDialog.handleCancel(win),
    );
    await targeCombineUI(dialogType, win, parent, io);



    transUI(dialogType, win, parent);
    await aiTransUI(dialogType, win, parent);
    if (fieldNames && !["targeCombine"].includes(dialogType))
      if (Array.isArray(fieldNames)) {
        if (dialogType == "input") {
          fieldNames.forEach((field: string, i: number) => {
            ztoolkit.UI.appendElement(
              {
                tag: "input",
                id: `fieldName-${Zotero.randomString(6)}`,
                namespace: "html",
                classList: ["key" + i],
                attributes: {
                  placeholder: `${field}`,
                  style: style,
                },
              },
              parent,
            );
          });
        }
        if (dialogType == "multiSelect") {
          parent.style.marginLeft = "1rem";
          const checkboxs = fieldNames.map((e: string, i: number) => ({
            tag: "checkbox",
            id: `fieldName-${Zotero.randomString(6)}`,
            classList: ["key" + i],
            namespace: "xul",
            attributes: {
              label: e,
              native: true,
              style: style,
            },
          }));
          const multiselet = ztoolkit.UI.appendElement(
            {
              tag: "vbox",
              id: `${config.addonRef}-multiSelectDialog`,
              namespace: "xul",
              children: checkboxs,
            },
            parent,
          );
          const child = parent.childNodes[0].childNodes[0].childNodes; //避免第一个选项自动选中显示边框
          if (child && child.length == 2)
            (child[1] as XUL.Box).setAttribute("class", "");
        }
        if (dialogType == "directory") {
          if (!fieldNames) fieldNames = ["none"];
          const basename = PathUtils.join(fieldNames[0]);
          const labelProps = makeTagElementProps({
            tag: "label",
            id: "fieldName-" + basename,
            namespace: "html",
            attributes: {
              style: style,
            },
            properties: {
              textContent: fieldNames[0],
            },
          });
          const filepickerButton = makeTagElementProps({
            tag: "button",
            id: "filepickerButton",
            namespace: "html",
            attributes: {
              style: `margin-inline: 1rem`,
            },
            properties: {
              textContent: getString("info-selectDirectory"),
            },
            listeners: [
              {
                type: "click",
                listener: onFilepicker,
              },
            ],
          });
          ztoolkit.UI.appendElement(
            {
              tag: "div",
              namespace: "html",
              children: [labelProps],
            },
            parent,
          );
          ztoolkit.UI.appendElement(
            {
              tag: "div",
              namespace: "html",
              children: [filepickerButton],
            },
            parent,
          );
        }
      } else {
        const fields = Object.keys(fieldNames);
        const values = Object.values(fieldNames) as string[];
        if (dialogType == "input") {
          const buttonDel = (e: Event) => {
            const button = e.target as HTMLButtonElement;
            button?.parentElement?.remove();
          };
          const endEdit = (e: Event) => {
            const hboxRow = win.document.querySelectorAll("#insertHbox")!;
            if (!hboxRow || hboxRow.length != 1) return;
            const row = hboxRow[0];
            const label = addon.mountPoint.label;
            const labelInput = row.children[1] as HTMLInputElement;
            label.textContent = labelInput.value;
            const inputfieldName = row.children[2] as HTMLInputElement;
            inputfieldName.name = labelInput.value;
            row.setAttribute("id", "");
            row.replaceChild(label, labelInput);
          };
          const ondelete = {
            type: "click",
            listener: buttonDel,
          };
          fields.forEach((field: string, i: number) => {
            ztoolkit.UI.appendElement(
              {
                tag: "hbox",
                namespace: "xul",
                children: [
                  {
                    tag: "button",
                    id: "deleteRow",
                    namespace: "html",
                    attributes: {
                      style: `margin-inline: 1rem`,
                    },
                    properties: {
                      textContent: getString("info-delete"),
                    },
                    listeners: [ondelete], //删除父元素 row
                  },
                  {
                    tag: "label",
                    namespace: "html",
                    attributes: {
                      for: `fieldName-${"key" + i}`,
                      style: `margin-inline: 1rem`,
                    },
                    properties: {
                      textContent: field,
                    },
                  },
                  {
                    tag: "input",
                    id: `fieldName-${"key" + i}`,
                    namespace: "html",
                    classList: ["key" + i],
                    attributes: {
                      placeholder: `${fieldNames[field]}`,
                      type: "text",
                      name: field,
                      style: style,
                    },
                    properties: {
                      value: `${fieldNames[field]}`,
                    },
                  },
                ],
              },
              parent,
            );
          });
          //插入，结束编辑
          const onInsertRow = {
            type: "click",
            listener: (e: Event) => {
              endEdit(e);
              const lastRow = parent.children[parent.children.length - 2]; //倒数第二行，最后一行是编辑按钮
              const newNode = lastRow?.cloneNode(true) as HTMLElement;
              if (!newNode) return;
              newNode.setAttribute("id", "insertHbox");
              const bt = newNode?.childNodes[0];
              bt.addEventListener("click", buttonDel); //重新添加事件，克隆元素不具有原有 addEventListener 事件
              const label = newNode?.childNodes[1] as HTMLLabelElement;
              addon.mountPoint.label = label; //标签挂载到插件挂载点上
              label.setAttribute("for", "rowInput");
              label.setAttribute("id", "rowLabel");
              ztoolkit.UI.replaceElement(
                {
                  //将 label 改为 input，以便修改字段
                  tag: "input",
                  id: "labelInput",
                  namespace: "html",
                  attributes: {
                    placeholder: `${label.textContent}`,
                    type: "text",
                    style: style,
                  },
                },
                label,
              );
              lastRow.insertAdjacentElement("afterend", newNode);
            },
          };
          const onSaveRow = {
            type: "click",
            listener: endEdit,
          };
          const hbox = ztoolkit.UI.createElement(win.document, "hbox", {
            tag: "hbox",
            namespace: "xul",
            attributes: {
              style: `display: flex; justify-Content: center; margin-inline: auto`,
            },
            children: [
              {
                tag: "button",
                id: "insertRow",
                namespace: "html",
                attributes: {
                  style: `margin-inline: 1rem`,
                },
                properties: {
                  textContent: getString("info-insertRow"),
                },
                listeners: [onInsertRow],
              },
              {
                tag: "button",
                id: "endEdit",
                namespace: "html",
                attributes: {
                  style: `margin-inline: 1rem`,
                },
                properties: {
                  textContent: getString("info-saveRow"),
                },
                listeners: [onSaveRow],
              },
            ],
          });
          parent.appendChild(hbox);
        }
        if (dialogType == "multiSelect") {
          parent.style.marginLeft = "1rem";
          const checkboxs = fields.map((e: string, i: number) => ({
            tag: "checkbox",
            id: `fieldName - ${Zotero.randomString(6)}`,
            classList: ["key" + i],
            namespace: "xul",
            attributes: {
              label: fieldNames[e],
              native: true,
              style: style,
            },
          }));
          const multiselet = ztoolkit.UI.appendElement(
            {
              tag: "vbox",
              id: `${config.addonRef} - multiSelectDialog`,
              namespace: "xul",
              children: checkboxs,
            },
            parent,
          );
        }
      }

    if (parent.clientHeight > win.screen.availHeight) {
      parent.style.height = (win.screen.availHeight * 2) / 3 + "px";
    }
    if (parent.clientWidth > win.screen.availWidth) {
      parent.style.width = (win.screen.availWidth * 2) / 3 + "px";
    }
    //await windowFitSize(win);
    async function selectDir() {
      const path = await chooseDirOrFilePath("file");
      if (typeof path == "string") {
        const span = win.document.querySelector("[id^='fieldName-']");
        if (span) span.textContent = path;
      }
    }
    async function onFilepicker(event: Event) {
      const path = await chooseDirOrFilePath(
        "dir",
        addonDatabaseDir,
        getString("info-selectSavePath"),
      );
      (event.target as HTMLElement).ownerDocument.defaultView?.focus();
      if (path) {
        const span = win.document.querySelector("[id^='fieldName-']");
        if (span) span.textContent = path;
      }
    }
  }

  static handleAccept(win: Window) {
    //@ts-ignore XXX
    const io = win.arguments[0];
    const dialogType = io.dialogType;
    if (dialogType == "targeCombine") {
      return;
    }

    if (dialogType == "aiTrans") {
      return false;
    }
    const elements = win.document.querySelectorAll('[id^="fieldName"]');
    const dataOut: any = {};
    if (elements.length) {
      makeDataout();
    }

    function makeDataout() {
      for (let i = 0; i < elements.length; i++) {
        const el = elements.item(i) as any;
        const tagName = el.tagName;
        const fieldName = el.id.replace("fieldName-", "");
        const key = el.classList[0];
        switch (tagName) {
          case "checkbox":
            if (el.checked) dataOut[key] = el.label;
            break;
          case "label":
            if (dialogType == "directory") {
              dataOut["dir"] = el.textContent;
            }
            break;
          case "input":
            if (el.name) {
              dataOut[el.name] = el.value || el.placeholder;
            } else {
              dataOut[key] = el.value || el.placeholder;
            }
            break;
          default:
            break;
        }
      }
    }

    //@ts-ignore xxx win.arguments[0]即为传入的 io 对象，修改其值
    win.arguments[0].dataOut = dataOut;
  }

  static handleCancel(win: Window) {
    showInfo("you click cancel");
  }
}
