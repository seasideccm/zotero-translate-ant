import { config } from "../../../package.json";
import { showInfo } from "../../utils/tools";

export function inputData(...fieldName: string[]) {

    const url = `chrome://${config.addonRef}/content/inputDialog.xhtml`;
    //fieldName.push(name);
    const io: any = { fieldName };
    const win = window.openDialog(url, "_blank", "chrome,modal,centerscreen,resizable=no", io);//io负责对话框窗口数据通信
    const dataOut = io.dataOut;
    if (!dataOut) {
        return null;
    }

    showInfo(JSON.stringify(dataOut));
}

export class InputDialog {
    static onOpenInputDialog(win: Window) {
        if (!addon.mountPoint.inputDialog) addon.mountPoint.inputDialog = win;
        //@ts-ignore xxx
        const io = win.arguments[0];
        const fieldName = io.fieldName;
        ztoolkit.log(io);
        const parent = win.document.querySelector('#input')!;
        fieldName.forEach((field: string) => {
            ztoolkit.UI.appendElement({
                tag: "input",
                id: `fieldName-${field}`,
                namespace: "html",
                attributes: {
                    placeholder: `${field}: Please Input Content`,
                }
            }, parent);
            win.document.addEventListener('dialogaccept', () => InputDialog.handleAccept(win));
        });

    }
    static handleAccept(win: Window) {
        const elements = win.document.querySelectorAll('[id^="fieldName"]');
        const dataOut: any = {};
        if (elements.length) {
            for (let i = 0; i < elements.length; i++) {
                const value = (elements.item(i) as HTMLInputElement).value;
                const fieldName = elements.item(i).id.replace("fieldName-", "");
                dataOut[fieldName] = value;
            }
        }
        //@ts-ignore xxx
        win.arguments[0].dataOut = dataOut;
    }
}









