import { path2UnixFormat, requireModule, showInfo } from "../../utils/tools";
import { config } from "../../../package.json";

//测试通过
export function testReact() {
    const win = ztoolkit.getGlobal("window");
    const _require = (win as any).require;
    const React = _require("react");
    const ReactDOM = _require("react-dom");
    const VirtualizedTable = _require("components/virtualized-table");
    const IntlProvider = _require("react-intl").IntlProvider;

    const button = React.createElement("button", { className: "testButton", onClick: fnTest }, "测试按钮");
    const containerParent = win.document.querySelector("#zotero-items-toolbar");

    //容器将替换为 React 组件
    const container = win.document.createElement("button");
    function fnTest() {
        win.document.querySelector(".testButton")?.remove();
    }
    containerParent?.appendChild(container);
    ReactDOM.render(button, container);
}


export function testRequireModule() {
    return requireModule("react");
}


export function cryptoTest() {



    const text = "zotero 翻译工具包";

}

export async function generateKey() {

    function getInput() {
        const name = "sshKeyFileName";
        const libraryID = 1;
        const parentCollectionID = 0;
        const io: any = { name, libraryID, parentCollectionID };
        window.openDialog("chrome://zotero/content/newCollectionDialog.xhtml",
            "_blank", "chrome,modal,centerscreen,resizable=no", io);
        const dataOut = io.dataOut;
        if (!dataOut || !dataOut.name) {
            return "zotero_security_" + Zotero.randomString(6);
        }
        return dataOut.name;
    }
    const fileName = getInput();
    let filePath = PathUtils.join(Zotero.DataDirectory.dir, config.addonRef);
    filePath = PathUtils.join(filePath, fileName);
    const filePathUnix = path2UnixFormat(filePath);
    //const command = `cd ${Zotero.DataDirectory.dir} && ssh-keygen -t rsa -N '' -f ${fileName} -q`;
    const command = `ssh-keygen -t rsa -N '' -f ${filePathUnix} -q`;

    const args: any = ["-c", command];
    const cmd = "C:\\Program Files\\Git\\git-bash.exe";
    const success = await Zotero.Utilities.Internal.exec(cmd, args);
    if (!success) return;
    const publicKey = await Zotero.File.getContentsAsync(filePath + '.pub');
    const privateKey = await Zotero.File.getContentsAsync(filePath);





    /*     const
            await window.crypto.subtle.encrypt();
        const { generateKeyPairSync } = requireModule('crypto');
        const { publicKey, privateKey } = generateKeyPairSync('rsa', {
            modulusLength: 1024,
            publicKeyEncoding: {
                type: 'pkcs1',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem',
                cipher: 'aes-256-cbc',
                passphrase: 'top secret'
            }
        }); */

    showInfo(["success? " + success, key.publicKey.toString()]);


}