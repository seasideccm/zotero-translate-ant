import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { OS, chooseDirOrFilePath, showInfo } from "../../utils/tools";
import { makeTagElementProps } from "./uiTools";
/**
 * fieldName 用作 Dom id ，不可有空格冒号
 * @param fieldNames 
 * @returns 
 */
export function modifyData(fieldNames: string[] | any, win?: Window) {
    const dialogType = 'input';
    const title = getString('info-modifyData');
    const io = onOpenDialog(fieldNames, dialogType, title, win);
    return io.dataOut;
}

export function selectData(fieldNames: string[], win?: Window) {
    const dialogType = 'multiSelect';
    const title = getString('info-multiSelect');
    const io = onOpenDialog(fieldNames, dialogType, title, win);
    return io.dataOut;

}

export function directorySaveCryptoKeys(fieldNames?: string[] | string) {
    if (!fieldNames) return;
    if (!Array.isArray(fieldNames)) fieldNames = [fieldNames];
    const dialogType = 'directory';
    const title = getString('info-selectSavePath');
    const win = addon.data.prefs?.window;
    const io = onOpenDialog(fieldNames, dialogType, title, win);
    return io.dataOut;
}


function onOpenDialog(fieldNames: string[] | any, dialogType: string, title: string, win?: Window) {
    const url = `chrome://${config.addonRef}/content/dataDialog.xhtml`;
    //fieldNames.push(name);
    const io: any = { fieldNames, dialogType, title };
    //io负责对话框窗口数据通信
    //window.openDialog chrome,modal，等待用户操作，完成后给 io 赋值

    if (!win) win = window;
    const dialog = win.openDialog(url, "dataDialog", "chrome,modal,centerscreen,fitContent=true,resizable=yes", io);
    addon.mountPoint.dialog = dialog;
    return io;
}




export class DataDialog {
    #handler = {
        directory: () => {

        },
        multiSelect: (win: Window) => {

        },
        input: (win: Window) => {

        },
    };

    static onOpenDataDialog(win: Window) {
        if (!addon.mountPoint.inputDialog) addon.mountPoint.inputDialog = win;
        //@ts-ignore xxx
        const io = win.arguments[0];
        let fieldNames = io.fieldNames;
        const dialogType = io.dialogType;
        const title = io.title;
        if (title) win.document.title = title;

        const parent = win.document.querySelector('#input') as XUL.Box;
        if (!parent) return;
        win.document.addEventListener('dialogaccept', () => DataDialog.handleAccept(win));
        if (Array.isArray(fieldNames)) {
            const maxLength = Math.max(...fieldNames.map((field: string) => field.length)) + 2;
            const style = `width: ${maxLength}rem; margin-inline: 1rem`;
            if (dialogType == 'input') {
                fieldNames.forEach((field: string, i: number) => {
                    ztoolkit.UI.appendElement({
                        tag: "input",
                        id: `fieldName-${Zotero.randomString(6)}`,
                        namespace: "html",
                        classList: ['key' + i],
                        attributes: {
                            placeholder: `${field}`,
                            style: style,
                        }
                    }, parent);
                });
            }
            if (dialogType == 'multiSelect') {
                parent.style.marginLeft = "2em";
                const checkboxs = fieldNames.map((e: string, i: number) => ({
                    tag: "checkbox",
                    id: `fieldName-${Zotero.randomString(6)}`,
                    classList: ["key" + i],
                    namespace: "xul",
                    attributes: {
                        label: e,
                        native: true,
                    }
                }));
                const multiselet = ztoolkit.UI.appendElement({
                    tag: "vbox",
                    id: `${config.addonRef}-multiSelectDialog`,
                    namespace: "xul",
                    children: checkboxs,
                }, parent);
                const child = parent.childNodes[0].childNodes[0].childNodes;//避免第一个选项自动选中显示边框
                if (child && child.length == 2) (child[1] as XUL.Box).setAttribute("class", "");
            }
            if (dialogType == 'directory') {
                if (!fieldNames) fieldNames = ["none"];
                const basename = OS.Path.basename(fieldNames[0]);
                const labelProps = makeTagElementProps({
                    tag: "label",
                    id: "fieldName-" + basename,
                    namespace: "html",
                    properties: {
                        textContent: fieldNames[0],
                    }
                });

                const filepicker = makeTagElementProps({
                    tag: "input",
                    id: "filepicker",
                    namespace: "html",
                    attributes: {
                        type: "file",
                        webkitdirectory: true,
                        multiple: true,
                    },
                    listeners: [{
                        type: "change",
                        listener: selectDirectory
                    }]
                });

                ztoolkit.UI.appendElement(
                    {
                        tag: "div",
                        namespace: "html",
                        children: [labelProps]

                    }, parent);
                ztoolkit.UI.appendElement(
                    {
                        tag: "div",
                        namespace: "html",
                        children: [filepicker]

                    }, parent);
            }

        } else {
            const fields = Object.keys(fieldNames);
            if (dialogType == 'input') {
                const maxLength = Math.max(...fields.map((field: string) => field.length)) + 2;
                const stlye = `width: ${maxLength}rem; margin-inline: 1rem`;
                const buttonDel = (e: MouseEvent) => {
                    //const button = win.document.querySelector('#deleteRow');
                    const button = e.target;
                    showInfo("click 删除吗？");//@ts-ignore xxx
                    button?.parentElement.remove();
                };
                const endEdit = (e: Event) => {
                    const hboxRow = win.document.querySelectorAll('#insertHbox')!;
                    if (!hboxRow || hboxRow.length != 1) return;
                    const row = hboxRow[0];
                    const label = addon.mountPoint.label;//@ts-ignore xxx
                    const labelInput = row?.children[1] as HTMLInputElement;//@ts-ignore xxx
                    //row?.children[2].setAttribute("id", `fieldName-${labelInput!.value}`);
                    label.textContent = labelInput!.value;
                    row.setAttribute("id", "");
                    row.replaceChild(label, labelInput);
                };
                const ondelete = {
                    type: "click",
                    listener: buttonDel
                };
                fields.forEach((field: string, i: number) => {
                    const div = ztoolkit.UI.appendElement(
                        {
                            tag: "hbox",
                            namespace: "xul",
                            children: [
                                {
                                    tag: "button",
                                    id: "deleteRow",
                                    namespace: "html",
                                    attributes: {
                                        style: `margin-inline: 1em`
                                    },
                                    properties: {
                                        textContent: "删除",
                                    },                                    //@ts-ignore xxx
                                    listeners: [ondelete]
                                },
                                {
                                    tag: "label",
                                    namespace: "html",
                                    attributes: {
                                        for: `fieldName-${'key' + i}`,
                                        style: `margin-inline: 1em`
                                    },
                                    properties: {
                                        textContent: field,
                                    }
                                },
                                {
                                    tag: "input",
                                    id: `fieldName-${'key' + i}`,
                                    namespace: "html",
                                    classList: ['key' + i],
                                    attributes: {
                                        placeholder: `${fieldNames[field]}`,
                                        type: "text",
                                        name: field,
                                        style: stlye,
                                    },
                                    properties: {
                                        value: `${fieldNames[field]}`,
                                    }
                                }
                            ],

                        }, parent);


                });
                const hbox = ztoolkit.UI.createElement(win.document, "hbox", {
                    tag: "hbox",
                    namespace: "xul",
                    attributes: {
                        flex: "1",
                    },
                    children: [
                        {
                            tag: "button",
                            id: "insertRow",
                            namespace: "html",
                            attributes: {
                                style: `margin-inline: 1em`
                            },
                            properties: {
                                textContent: "插入",
                            },
                            listeners: [
                                {
                                    type: "click",
                                    listener: (e) => {
                                        endEdit(e);
                                        const lastRow = parent.children[parent.children.length - 2];
                                        const newNode = lastRow?.cloneNode(true); //@ts-ignore xxx
                                        newNode?.setAttribute("id", "insertHbox");
                                        const bt = newNode?.childNodes[0];//@ts-ignore xxx
                                        bt.addEventListener("click", buttonDel);
                                        const label = newNode?.childNodes[1];
                                        addon.mountPoint.label = label;//@ts-ignore xxx
                                        label.setAttribute("for", "rowInput");//@ts-ignore xxx
                                        label.setAttribute("id", "rowLabel");
                                        ztoolkit.UI.replaceElement({
                                            tag: "input",
                                            id: "labelInput",
                                            namespace: "html",
                                            attributes: {
                                                placeholder: `${label?.textContent}`,
                                                type: "text",
                                            },

                                        }, label as Element);//@ts-ignore xxx
                                        //newNode?.childNodes[2].setAttribute("id", "rowInput");//@ts-ignore xxx
                                        lastRow?.insertAdjacentElement("afterend", newNode);
                                    }
                                },
                            ]
                        },
                        {
                            tag: "button",
                            id: "endEdit",
                            namespace: "html",
                            attributes: {
                                style: `margin-inline: 1em`
                            },
                            properties: {
                                textContent: "结束行编辑",
                            },
                            listeners: [
                                {
                                    type: "click",
                                    listener: endEdit
                                },

                            ]
                        },
                    ]
                },);
                parent.appendChild(hbox);

                /* ztoolkit.UI.appendElement(
                    {
                        tag: "hbox",
                        namespace: "xul",
                        children: [
                            {
                                tag: "button",
                                id: "insertRow",
                                namespace: "html",
                                properties: {
                                    textContent: "插入",
                                },
                                listeners: [

                                    {
                                        type: "click",
                                        listener: () => {
                                            const button = win.document.querySelector('#insertRow');
                                            showInfo("click 插入吗？");//@ts-ignore xxx
                                            const lastRow = button?.parentElement.previousSibling;
                                            const newNode = lastRow?.cloneNode(true);
                                            const label = newNode?.childNodes[1];
                                            addon.mountPoint.label = label;

                                            //@ts-ignore xxx
                                            newNode?.setAttribute("id", "insertHbox");

                                            //@ts-ignore xxx
                                            //@ts-ignore xxx
                                            newNode?.childNodes[1].setAttribute("for", "rowInput");//@ts-ignore xxx
                                            newNode?.childNodes[1].setAttribute("id", "rowLabel");//@ts-ignore xxx
                                            ztoolkit.UI.replaceElement({
                                                tag: "input",
                                                id: "labelInput",
                                                namespace: "html",
                                                attributes: {
                                                    placeholder: `${label?.textContent}`,
                                                    type: "text",
                                                },

                                            }, label);
                                            newNode?.childNodes[2].setAttribute("id", "rowInput");//@ts-ignore xxx
                                            lastRow?.insertAdjacentElement("afterend", newNode);
                                        }
                                    },

                                ]
                            },
                            {
                                tag: "button",
                                id: "endEdit",
                                namespace: "html",
                                properties: {
                                    textContent: "结束行编辑",
                                },
                                listeners: [

                                    {
                                        type: "click",
                                        listener: () => {
                                            const row = win.document.querySelector('#insertHbox');
                                            const label = addon.mountPoint.label;
                                            showInfo("结束编辑吗？");//@ts-ignore xxx
                                            //@ts-ignore xxx
                                            const labelInput = row?.childNodes[1];
                                            row?.childNodes[2].setAttribute("id", `fieldName-${labelInput!.value}`);
                                            label.textContent = labelInput!.value;
                                            row?.childNodes[1].parentElement?.replaceChild(label, labelInput);
                                        }
                                    },

                                ]
                            },
                        ]
                    }, parent); */
            }
            if (dialogType == 'multiSelect') {
                parent.style.marginLeft = "2em";
                const checkboxs = fields.map((e: string, i: number) => ({
                    tag: "checkbox",
                    id: `fieldName-${Zotero.randomString(6)}`,
                    classList: ["key" + i],
                    namespace: "xul",
                    attributes: {
                        label: fieldNames[e],
                        native: true,
                    }
                }));
                const multiselet = ztoolkit.UI.appendElement({
                    tag: "vbox",
                    id: `${config.addonRef}-multiSelectDialog`,
                    namespace: "xul",
                    children: checkboxs,
                }, parent);
            }
        }
        async function selectDir() {
            const path = await chooseDirOrFilePath();
            if (typeof path == "string") {
                const span = win.document.querySelector("[id^='fieldName-']");
                if (span) span.textContent = path;
            }
        }

        function selectDirectory(event: Event) {
            if (!event.target) return;
            const files = (event.target as HTMLInputElement).files;
            //@ts-ignore xxx
            const path2 = this.files[0];
            if (!files || !files.length) return;
            //@ts-ignore xxx
            const path = files[0].mozFullPath;
            if (path) {
                const dir = OS.Path.dirname(path);
                const span = win.document.querySelector("[id^='fieldName-']");
                if (span) span.textContent = dir;
            }
        }




    }
    static handleAccept(win: Window) {
        //@ts-ignore XXX
        const io = win.arguments[0];
        const dialogType = io.dialogType;
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
                            dataOut['dir'] = el.textContent;
                        }
                        break;
                    case "input":
                        dataOut[key] = el.value || el.placeholder;
                        break;
                    default: break;
                }
            }
        }


        //@ts-ignore xxx win.arguments[0]即为传入的 io 对象，修改其值
        win.arguments[0].dataOut = dataOut;
    }





}









