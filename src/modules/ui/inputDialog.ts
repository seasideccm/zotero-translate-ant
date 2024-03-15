import { config } from "../../../package.json";
import { showInfo } from "../../utils/tools";

export function inputData(dialogType: 'input' | 'multiSelect' = 'input', fieldNames: string[]) {

    const url = `chrome://${config.addonRef}/content/inputDialog.xhtml`;
    //fieldNames.push(name);
    const io: any = { fieldNames, dialogType };
    //io负责对话框窗口数据通信
    //window.openDialog chrome,modal，等待用户操作，完成后给 io 赋值
    const win = window.openDialog(url, "_blank", "chrome,modal,centerscreen,fitContent=true,resizable=yes", io);
    const dataOut = io.dataOut;
    if (!dataOut) {
        return null;
    }
    showInfo(JSON.stringify(dataOut));
    return dataOut;
}

export class InputDialog {
    static onOpenInputDialog(win: Window) {
        if (!addon.mountPoint.inputDialog) addon.mountPoint.inputDialog = win;
        //@ts-ignore xxx
        const io = win.arguments[0];
        const fieldNames = io.fieldNames as string[];
        const dialogType = io.dialogType;
        ztoolkit.log(io);
        const parent = win.document.querySelector('#input') as XUL.Box;
        if (!parent) return;
        /* win.onclick = () => {
            const href = win.location.href;
            const childs = parent.childNodes;
            const test = "t";
        }; */
        win.document.addEventListener('dialogaccept', () => InputDialog.handleAccept(win));
        if (dialogType == 'input') {
            fieldNames.forEach((field: string) => {
                ztoolkit.UI.appendElement({
                    tag: "input",
                    id: `fieldName-${field}`,
                    namespace: "html",
                    attributes: {
                        placeholder: `${field}: Please Input Content`,
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









