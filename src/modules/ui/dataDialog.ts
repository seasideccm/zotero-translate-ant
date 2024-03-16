import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { OS, batchAddEventListener, chooseDirOrFilePath, showInfo } from "../../utils/tools";
import { stopEvent } from "./tableSecretKeys";
import { makeTagElementProps } from "./uiTools";

export function modifyData(fieldNames: string[] | any) {
    const dialogType = 'input';
    const title = getString('info-modifyData');
    const io = onOpenDialog(fieldNames, dialogType, title);
    return io.dataOut;
}

export function selectData(fieldNames: string[]) {
    const dialogType = 'multiSelect';
    const title = getString('info-multiSelect');
    const io = onOpenDialog(fieldNames, dialogType, title);
    return io.dataOut;

}

export function selectDirectoryCryptoKeys(fieldNames: string[] | string) {
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
    win.openDialog(url, "dataDialog", "chrome,modal,centerscreen,fitContent=true,resizable=yes", io);
    //const win = window.openDialog(url, "dataDialog", "chrome,modal,centerscreen,fitContent=true,resizable=yes", io);
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
        const fieldNames = io.fieldNames;
        const dialogType = io.dialogType;
        const title = io.title;
        if (title) win.document.title = title;

        const parent = win.document.querySelector('#input') as XUL.Box;
        if (!parent) return;
        win.document.addEventListener('dialogaccept', () => DataDialog.handleAccept(win));
        if (Array.isArray(fieldNames)) {
            if (dialogType == 'input') {
                fieldNames.forEach((field: string) => {
                    ztoolkit.UI.appendElement({
                        tag: "input",
                        id: `fieldName-${field}`,
                        namespace: "html",
                        attributes: {
                            placeholder: `${field}: Please Input Content`,
                            name: field,
                        }
                    }, parent);
                });
            }
            if (dialogType == 'multiSelect') {
                parent.style.marginLeft = "2em";
                const checkboxs = fieldNames.map((e: string) => ({
                    tag: "checkbox",
                    id: `fieldName-${e}`,
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
                const child = parent.childNodes[0].childNodes[0].childNodes;
                if (child && child.length == 2) (child[1] as XUL.Box).setAttribute("class", "");
            }
            if (dialogType == 'directory') {
                const basename = OS.Path.basename(fieldNames[0]);
                const labelProps = makeTagElementProps({
                    tag: "label",
                    id: "fieldName-" + basename,
                    namespace: "html",
                    properties: {
                        textContent: fieldNames[0],
                    }
                });
                const filesIcon = makeTagElementProps({
                    tag: "span",
                    namespace: "html",
                    classList: ['icon', 'icon-css', 'icon-collection', 'cell-icon'],
                    listeners: [{
                        type: "click",
                        listener: selectDir
                    }]

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
                        children: [labelProps, filesIcon, filepicker]

                    }, parent);
            }

        } else {
            const fields = Object.keys(fieldNames);
            if (dialogType == 'input') {
                const maxLength = Math.max(...fields.map((field: string) => field.length)) + 2;
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
                    const label = addon.mountPoint.label;
                    showInfo("结束编辑吗？");//@ts-ignore xxx
                    const labelInput = row?.children[1] as HTMLInputElement;//@ts-ignore xxx
                    row?.children[2].setAttribute("id", `fieldName-${labelInput!.value}`);
                    label.textContent = labelInput!.value;
                    row.setAttribute("id", "");
                    row.replaceChild(label, labelInput);
                };
                const ondelete = {
                    type: "click",
                    listener: buttonDel
                };
                fields.forEach((field: string) => {
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
                                    },
                                    listeners: [ondelete]
                                },
                                {
                                    tag: "label",
                                    namespace: "html",
                                    attributes: {
                                        for: `fieldName-${field}`,
                                        style: `margin-inline: 1em`
                                    },
                                    properties: {
                                        textContent: field,
                                    }
                                },
                                {
                                    tag: "input",
                                    id: `fieldName-${field}`,
                                    namespace: "html",
                                    attributes: {
                                        placeholder: `${fieldNames[field]}`,
                                        type: "text",
                                        //size: maxLength,
                                        name: field,
                                        style: `width: ${maxLength}em; margin-inline: 1em`,
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
                                        const button = win.document.querySelector('#insertRow');
                                        endEdit(e);
                                        showInfo("click 插入吗？");//@ts-ignore xxx
                                        //const lastRow = button?.parentElement.previousSibling;
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
                const checkboxs = fields.map((e: string) => ({
                    tag: "checkbox",
                    id: `fieldName-${e}`,
                    namespace: "xul",
                    attributes: {
                        label: e + ": " + fieldNames[e],
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
            /*             for (let i = 0; i < elements.length; i++) {
                            const fieldName = elements.item(i).id.replace("fieldName-", "");
                            if (elements.item(i).tagName == "checkbox") {
                                dataOut[fieldName] = (elements.item(i) as XUL.Checkbox).checked;
                            } else if () {
                                textContent;
                            }
                            else {
                                dataOut[fieldName] = (elements.item(i) as HTMLInputElement).value;
                            }
                        } */
        }

        function makeDataout() {
            for (let i = 0; i < elements.length; i++) {
                const el = elements.item(i) as any;
                const tagName = el.tagName;
                const fieldName = el.id.replace("fieldName-", "");
                switch (tagName) {
                    case "checkbox":
                        dataOut[fieldName] = el.checked;
                        break;
                    case "label":
                        if (dialogType == "directory") {
                            dataOut['dir'] = el.textContent;
                        }
                        break;
                    case "input":
                        dataOut[fieldName] = el.value;
                        break;
                    default: break;
                }
            }
        }


        //@ts-ignore xxx win.arguments[0]即为传入的 io 对象，修改其值
        win.arguments[0].dataOut = dataOut;
    }





}









