import { encrypt, path2UnixFormat, requireModule, showInfo } from "../../utils/tools";
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
    const publicKey = "1234567890123456789012345678901234567890";
    const encode = encrypt(text, "1234567890123456789012345678901234567890");
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


    async function encryptAsymmetricKey(publicKey: any, data: any) {
        const encodedData = new TextEncoder().encode(data);
        const encryptedData = await window.crypto.subtle.encrypt(
            {
                name: "RSA-OAEP",
            },
            publicKey,
            encodedData
        );
        return encryptedData;
    }

    async function decryptAsymmetricKey(privateKey: any, encryptedData: any) {
        const decryptedData = await window.crypto.subtle.decrypt(
            {
                name: "RSA-OAEP",
            },
            privateKey,
            encryptedData
        );
        return new TextDecoder().decode(decryptedData);
    }

    async function asymmetricEncryptionDecryption() {
        const text = "Shavahn";

        // 生成一对非对称加密密钥
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: { name: "SHA-256" },
            },
            true,
            ["encrypt", "decrypt"]
        );

        // 加密文本
        const encryptedData = await encryptAsymmetricKey(keyPair.publicKey, text);

        // 将加密后的文本解密
        const decryptedText = await decryptAsymmetricKey(
            keyPair.privateKey,
            encryptedData
        );



        ztoolkit.log("原始文本：", text);
        ztoolkit.log("加密后的文本：", new Uint8Array(encryptedData));
        ztoolkit.log("解密后的文本：", decryptedText);
        return keyPair;
    }

    const key = await asymmetricEncryptionDecryption();


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
    //showInfo("publicKey");
    //showInfo("privateKey");

}