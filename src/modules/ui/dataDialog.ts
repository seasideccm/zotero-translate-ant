import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { OS } from "../../utils/tools";

export function modifyData(fieldNames: string[] | any) {
    const dialogType = 'input';
    const title = getString('info-modifyData');
    return onOpenDialog(fieldNames, dialogType, title);
}

export function selectData(fieldNames: string[]) {
    const dialogType = 'multiSelect';
    const title = getString('info-multiSelect');
    return onOpenDialog(fieldNames, dialogType, title);
}

export function selectDirectory(fieldNames: string[] | string) {
    if (!fieldNames) return;
    if (!Array.isArray(fieldNames)) fieldNames = [fieldNames];
    const dialogType = 'directory';
    const title = 'info-selectDirectory' || getString('info-selectDirectory');
    return onOpenDialog(fieldNames, dialogType, title);
}


function onOpenDialog(fieldNames: string[] | any, dialogType: string, title: string) {
    const url = `chrome://${config.addonRef}/content/dataDialog.xhtml`;
    //fieldNames.push(name);
    const io: any = { fieldNames, dialogType };
    //io负责对话框窗口数据通信
    //window.openDialog chrome,modal，等待用户操作，完成后给 io 赋值
    const win = window.openDialog(url, title, "chrome,modal,centerscreen,fitContent=true,resizable=yes", io);
    return io.dataOut;
}




export class DataDialog {
    static onOpenDataDialog(win: Window) {
        if (!addon.mountPoint.inputDialog) addon.mountPoint.inputDialog = win;
        //@ts-ignore xxx
        const io = win.arguments[0];
        const fieldNames = io.fieldNames;
        const dialogType = io.dialogType;
        ztoolkit.log(io);
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
            }
            if (dialogType == 'directory') {
                const basename = OS.Path.basename(fieldNames[0]);
                ztoolkit.UI.appendElement({
                    tag: "span",
                    id: "fieldName-" + basename,
                    namespace: "html",
                    properties: {
                        textContent: fieldNames[0],
                    }
                }, parent);
                ztoolkit.UI.appendElement({
                    tag: "input",
                    id: "filepicker",
                    namespace: "html",
                    properties: {
                        value: fieldNames[0],
                        type: "file",
                        webkitdirectory: true,
                        multiple: true,
                    }
                }, parent);
            }

        } else {
            const fields = Object.keys(fieldNames);
            if (dialogType == 'input') {
                fields.forEach((field: string) => {
                    const div = ztoolkit.UI.appendElement({
                        tag: "div",
                        namespace: "html",
                        children: [{
                            tag: "lable",
                            namespace: "html",
                            attributes: {
                                for: field,
                            }
                        },
                        {
                            tag: "input",
                            id: `fieldName-${field}`,
                            namespace: "html",
                            attributes: {
                                placeholder: `${fieldNames[field]}: Please Modify Content`,
                                name: field,
                                type: "text"
                            }
                        }
                        ]

                    }, parent);

                });
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
        const filepicker = win.document.querySelector("#filepicker");
        if (filepicker) {
            filepicker!.addEventListener("change", (event) => {
                if (!event.target || !event.target.files) return;
                const path = event.target.files[0].mozFullPath;
                if (path) {
                    const dir = OS.Path.dirname(path);
                    const span = win.document.querySelector("[id^='fieldName-']");
                    if (span) span.textContent = dir;
                }
            });

        }

        const child = parent.childNodes[0].childNodes[0].childNodes;
        if (child && child.length == 2) (child[1] as XUL.Box).setAttribute("class", "");


    }
    static handleAccept(win: Window) {
        const elements = win.document.querySelectorAll('[id^="fieldName"]');
        const dataOut: any = {};
        if (elements.length) {
            for (let i = 0; i < elements.length; i++) {
                const fieldName = elements.item(i).id.replace("fieldName-", "");
                if (elements.item(i).tagName == "checkbox") {
                    dataOut[fieldName] = (elements.item(i) as XUL.Checkbox).checked;
                } else {
                    dataOut[fieldName] = (elements.item(i) as HTMLInputElement).value;
                }
            }
        }
        //@ts-ignore xxx win.arguments[0]即为传入的 io 对象，修改其值
        win.arguments[0].dataOut = dataOut;
    }
}









