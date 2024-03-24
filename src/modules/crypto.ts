import { arrayBufferTOstring, chooseDirOrFilePath, chooseFiles, collectFilesRecursive, confirmWin, ensureNonePath, getFiles, getPS, showInfo, stringToArrayBuffer, stringToUint8Array, uint8ArrayToString } from '../utils/tools';
import { config } from "../../package.json";
import { addonDatabaseDir } from "../utils/constant";
import { getDB, getDBSync } from "./database/database";
import { OS } from "../utils/tools";
import { getString } from '../utils/locale';
import { dbRowsToArray, dbRowsToObjs, getTableBySN } from './translate/translateServices';
import { getDom } from './ui/uiTools';
import { selectData } from './ui/dataDialog';
import { Command, setEncryptState, updateDBSettings } from './command';
import { warn } from 'console';



const BEGIN_PUBLIC = `-----BEGIN PUBLIC KEY-----\n`;
const END_PUBLIC = `\n-----END PUBLIC KEY-----`;
const BEGIN_PRIVATE = `-----BEGIN PRIVATE KEY-----\n`;
const END_PRIVATE = `\n-----END PRIVATE KEY-----`;

/**
 * 必须包含ARS公私秘钥
 * @param files 
 * @returns ture 代表秘钥文件不符合要求，需要重新选择文件，
 */
async function isRechooseFiles(files: string[]) {
    const KEYS_NAME = await Cry.getKEYS_NAME();
    if (!KEYS_NAME) return true;
    if (!Array.isArray(files) || typeof files[0] != "string") return;
    const fileNames = files.map(path => OS.Path.basename(path));
    if (!fileNames.includes(KEYS_NAME.PUBLICKEY_NAME)) {
        showInfo(getString("info-noPublicKey"));
        return true;
    }
    if (!fileNames.includes(KEYS_NAME.PRIVATEKEY_NAME)) {
        showInfo(getString('info-noPrivateKey'));
        return true;
    }

    for (const path of files) {
        if (!await verifyKeyContent(path, files, KEYS_NAME)) return true;
    }


}

/**
 * 验证秘钥文件内容是否正确
 * @param path 秘钥文件地址
 * @param files 可选，包含RSA秘钥的所有文件地址（用于未开启加密，或添加新秘钥的情况）
 * @param KEYS_NAME 可选
 * @returns 不存在或内容不正确返回 false 反之为true
 */
async function verifyKeyContent(path: string, files?: string[], KEYS_NAME?: KEYSNAME) {
    const name = PathUtils.filename(path);
    if (!await IOUtils.exists(path)) {
        showInfo(name + getString("info-notExist"));
        return false;
    }
    let ctx;
    try {
        ctx = await IOUtils.readUTF8(path);
    } catch (e: any) {
        ctx = await IOUtils.read(path);
    }

    if (!ctx) {
        showInfo(name + ' ' + getString("info-readFailure"));
        return false;
    }
    //ctx = await Zotero.File.getContentsAsync(path);
    if (!KEYS_NAME) {
        KEYS_NAME = await Cry.getKEYS_NAME();
        if (!KEYS_NAME) return false;
    }
    //if (typeof ctx == "string" && name == KEYS_NAME.PUBLICKEY_NAME) {
    if (typeof ctx == "string" && name == KEYS_NAME.PUBLICKEY_NAME) {
        if ((!ctx.startsWith(BEGIN_PUBLIC) || !ctx.endsWith(END_PUBLIC))) {
            showInfo(getString("info-formatInvalid") + getString("info-publicKey"));
            return false;
        } else {
            return true;
        }
    }

    if (typeof ctx == "string" && name == KEYS_NAME.PRIVATEKEY_NAME) {
        if ((!ctx.startsWith(BEGIN_PRIVATE) || !ctx.endsWith(END_PRIVATE))) {
            showInfo(getString("info-formatInvalid") + getString("info-privateKey"));
            return false;
        } else {
            return true;
        }
    }

    if (ctx.constructor == Uint8Array && name == KEYS_NAME.AESCBCKEY_NAME) {
        let info;
        let privatePath;
        if (!files) {
            const dirName = PathUtils.parent(path);
            if (!dirName) return;
            privatePath = PathUtils.join(dirName, KEYS_NAME!.PRIVATEKEY_NAME);
        } else {
            privatePath = files.filter(path => PathUtils.filename(path) == KEYS_NAME!.PRIVATEKEY_NAME)[0];
        }
        if (!privatePath) return false;
        const privateStirng = await Zotero.File.getContentsAsync(privatePath);

        if (typeof privateStirng != "string") {
            info = getString("info-hasNot") + getString("info-privateKey") + getString("info-unableVerifyAES");
            showInfo(info);
            return false;
        }
        const privateKey = await Cry.importKey(privateStirng);
        if (!privateKey) {
            showInfo(info);
            return false;
        }
        const AESKey = await window.crypto.subtle.unwrapKey(
            "raw",
            ctx,//.buffer
            privateKey,
            { name: "RSA-OAEP" },
            { name: 'AES-CBC' },
            true,
            ["encrypt", "decrypt"]
        );

        if (!AESKey)
            showInfo(getString("info-formatInvalidAES"));
        return false;
    }
    else {
        return true;
    }
}

export async function isRSAKey(path: string) {
    if (!await IOUtils.exists(path)) return false;
    let ctx;
    try {
        ctx = await IOUtils.readUTF8(path);
    } catch (e: any) {
        return false;
    }
    if ((ctx.startsWith(BEGIN_PUBLIC) && ctx.endsWith(END_PUBLIC))) {
        return "PUBLIC";
    }
    if ((ctx.startsWith(BEGIN_PRIVATE) && ctx.endsWith(END_PRIVATE))) {
        return "PRIVATE";
    }
    return false;
}

export async function getKeyNameByContent(path: string, files?: string[], KEYS_NAME?: KEYSNAME) {
    const name = PathUtils.filename(path);
    if (!await IOUtils.exists(path)) {
        showInfo(name + getString("info-notExist"));
        return false;
    }
    let ctx;
    try {
        ctx = await IOUtils.readUTF8(path);
    } catch (e: any) {
        showInfo(name + getString("info-readFailure "));
    }

    if (!ctx) return false;
    //ctx = await Zotero.File.getContentsAsync(path);
    if (!KEYS_NAME) {
        KEYS_NAME = await Cry.getKEYS_NAME();
        if (!KEYS_NAME) return false;
    }

    if (typeof ctx == "string") {
        if ((ctx.startsWith(BEGIN_PUBLIC) && ctx.endsWith(END_PUBLIC))) {
            return 'PUBLICKEY_NAME';
        } else if ((ctx.startsWith(BEGIN_PRIVATE) && ctx.endsWith(END_PRIVATE))) {
            return 'PRIVATEKEY_NAME';
        }
        else {
            showInfo(getString("info-formatInvalid"));
            return false;
        }
    }

    /*  if (ctx.constructor == Uint8Array) {
         let privatePath;
         if (!files) {
             const dirName = PathUtils.parent(path);
             if (!dirName) return;
             privatePath = PathUtils.join(dirName, KEYS_NAME!.PRIVATEKEY_NAME);
         } else {
             privatePath = files.filter(path => PathUtils.filename(path) == KEYS_NAME!.PRIVATEKEY_NAME)[0];
         }
         if (!privatePath) return false;
         const privateStirng = await Zotero.File.getContentsAsync(privatePath);
         const info = getString("info-hasNot") + getString("info-privateKey") + getString("info-unableVerifyAES");
         if (typeof privateStirng != "string") {
             showInfo(info);
             return false;
         }
         const privateKey = await Cry.importKey(privateStirng);
         if (!privateKey) {
             showInfo(info);
             return false;
         }
         const AESKey = await window.crypto.subtle.unwrapKey(
             "raw",
             ctx,//.buffer
             privateKey,
             { name: "RSA-OAEP" },
             { name: 'AES-CBC' },
             true,
             ["encrypt", "decrypt"]
         );
         if (AESKey) {
             return KEYS_NAME.AESCBCKEY_NAME;
         } else {
             return false;
         }
     } */
    return true;

}


export class Cry {

    static async encryptRSA(publicKey: any, data: any) {
        const encodedData = new TextEncoder().encode(data);
        const encryptedData = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP", },
            publicKey,
            encodedData//Uint8Array 一个包含了待加密的数据（也称为明文）的 ArrayBuffer、TypedArray 或 DataView 对象。
        );
        return encryptedData;//ArrayBuffer
    }

    /**
     * Uint8Array或ArrayBuffer均可
     * @param privateKey 
     * @param encryptedData 
     * @returns 
     */
    static async decryptRSA(privateKey: any, encryptedData: any) {
        const decryptedData = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP", },
            privateKey,
            encryptedData
        );

        return new TextDecoder().decode(decryptedData);
    }

    static async getRSAKeyPair() {
        return await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: { name: "SHA-256" },
            },
            true,
            ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
        );

    }

    /**
     * pem 格式
     * @param RawKey 
     * @returns 
     */
    static async exportKey(RawKey: any) {
        const type = RawKey.type == "private" ? "pkcs8" : "spki";
        const key = await window.crypto.subtle.exportKey(
            type,
            RawKey
        );
        const keyBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(key) as any));

        const PUBLIC = BEGIN_PUBLIC + keyBase64 + END_PUBLIC;
        const PRIVATE = BEGIN_PRIVATE + keyBase64 + END_PRIVATE;
        return type == "pkcs8" ? PRIVATE : PUBLIC;//pemExported
    }

    static async importKey(pem: string) {

        const PRIVATE = 'PRIVATE';
        const PUBLIC = 'PUBLIC';
        if (!pem.includes(PRIVATE) && !pem.includes(PUBLIC)) {
            getString("info-formatInvalid") + getString("info-publicKey") + getString("info-privateKey");
            showInfo(getString("info-formatInvalid") + getString("info-publicKey") + getString("info-privateKey"));
            return;
        }
        let pemContents = pem;
        let format: "pkcs8" | "spki" = "pkcs8";
        const keyUsage: KeyUsage[] = [];
        const type = pem.includes(PRIVATE) ? PRIVATE : PUBLIC;
        format = type == PRIVATE ? "pkcs8" : "spki";
        type == PRIVATE ? keyUsage.push("decrypt", "unwrapKey") : keyUsage.push("encrypt", "wrapKey");
        const pemHeader = `-----BEGIN ${type} KEY-----\n`;
        const pemFooter = `\n-----END ${type} KEY-----`;
        pemContents = pemContents.replace(pemHeader, '').replace(pemFooter, '');


        // base64 decode the string to get the binary data
        const binaryDerString = window.atob(pemContents);
        // convert from a binary string to an ArrayBuffer
        const binaryDer = stringToArrayBuffer(binaryDerString);
        return await window.crypto.subtle.importKey(
            format,
            binaryDer,
            {
                name: "RSA-OAEP",
                hash: "SHA-256",
            },
            true,
            keyUsage,
        );
    }

    static async saveKey(key: any, path: string) {
        if (await IOUtils.exists(path)) {
            if (!confirmWin(path + "\n" + getString("info-overwrite"), "win")) {
                showInfo(getString("info-userCancle"));
                throw new Error(getString("info-userCancle"));
            }
        }
        if (!path) return;
        //btoa 字节转字母
        //const keyBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(key) as any));
        if (typeof key == "string") {
            await IOUtils.writeUTF8(path, key);
        } else {
            await IOUtils.write(path, key);
        }
        return path;
    }

    static async getAESKey() {
        return await window.crypto.subtle.generateKey(
            { name: 'AES-CBC', length: 256, },
            true,
            ['encrypt', 'decrypt'],
        );
    }

    static async getSignKey() {
        return await window.crypto.subtle.generateKey(
            { name: 'HMAC', hash: { name: 'SHA-256' }, },
            true,
            ['sign', 'verify'],
        );
    }
    static getIV() {
        return window.crypto.getRandomValues(new Uint8Array(16));
    }

    static async encryptAESKey(data: BufferSource, secretKey: CryptoKey, iv: any) {
        return await window.crypto.subtle.encrypt(
            { name: 'AES-CBC', iv, },
            secretKey,
            data,
        );
    }

    static async decryptAESKey(data: BufferSource, secretKey: CryptoKey, iv: Uint8Array) {
        return await window.crypto.subtle.decrypt(
            { name: 'AES-CBC', iv, },
            secretKey,
            data,
        );
    }

    static async signInfo(data: BufferSource, signKey: CryptoKey) {
        return await window.crypto.subtle.sign(
            { name: 'HMAC', hash: { name: 'SHA-256' }, },
            signKey,
            data,
        );
    }

    static async verify(signature: BufferSource, data: BufferSource, keyVerify: CryptoKey) {
        // Will verify with sender's public key
        return await window.crypto.subtle.verify(
            { name: 'HMAC', hash: { name: 'SHA-256' }, },
            keyVerify,
            signature,
            data,
        );
    }

    static async getKey(type: "publicKey" | 'privateKey' | "AESCBC") {
        if (addon.mountPoint.crypto && addon.mountPoint.crypto.publicKey && type == "publicKey") {
            const key = addon.mountPoint.crypto[type];
            return await Cry.importKey(key);
        }
        if (!addon.mountPoint.crypto) addon.mountPoint.crypto = {};
        const info = getString("info-hasNot") + " crypto " + getString("prefs-table-secretKey") + "\n" + getString("info-updateCryptoKey");
        if (!addon.mountPoint.crypto?.path) {
            const res = await Cry.getPathCryKey();
            if (!res) {
                showInfo(info);
                return;
            }
            addon.mountPoint["crypto"]["path"] = res;
        }
        let path = addon.mountPoint.crypto.path;
        if (!path) return;
        const KEYS_NAME: KEYSNAME = await Cry.getKEYS_NAME();
        if (!KEYS_NAME) {
            showInfo(info);
            return;
        }
        if (type == "AESCBC") {
            //if (!Object.keys(KEYS_NAME).includes("AESCBCKEY_NAME")) return;
            if (!KEYS_NAME["AESCBCKEY_NAME"]) return;
            path = PathUtils.join(path, KEYS_NAME["AESCBCKEY_NAME"]);
            const key = await IOUtils.read(path);
            verify(key);
            return key;
        }

        if (type == "publicKey") path = PathUtils.join(path, KEYS_NAME['PUBLICKEY_NAME']);
        if (type == 'privateKey') path = PathUtils.join(path, KEYS_NAME['PRIVATEKEY_NAME']);
        const key = await Zotero.File.getContentsAsync(path);
        await Cry.verifyMD5CryKey();
        verify(key);
        if (typeof key == 'string') {
            if (type == "publicKey") addon.mountPoint.crypto[type] = key;
            return await Cry.importKey(key);
        }

        /**
         * key 为空显示消息，然后抛出错误
         * @param key 
         * @returns 
         */
        function verify(key: any) {
            if (!key) {
                showInfo("Please check: " + path);
                showInfo(info);
                showInfo(`argument ${key} is null`);
                //throw new Error(`argument ${key} is null`);
            }
        }
    }

    static async unwrapAESKey(wrapedAESKey?: Uint8Array,) {
        if (!wrapedAESKey) {
            wrapedAESKey = await Cry.getKey("AESCBC") as Uint8Array;
            if (!wrapedAESKey) return;
        }
        const privateKey = await Cry.getKey("privateKey") as CryptoKey;
        const AESKey = await window.crypto.subtle.unwrapKey(
            "raw",
            wrapedAESKey,//.buffer
            privateKey,
            { name: "RSA-OAEP" },
            { name: 'AES-CBC' },
            true,
            ["encrypt", "decrypt"]
        );

        return AESKey;
    }

    static async encryptAccount(value: string) {
        //非对称秘钥负责加密对称秘钥，对称秘钥负责加密解密文本内容
        //读取私钥，加密的对称秘钥

        const encryptedData = await Cry.encryptRSA(Cry.getKey("publicKey"), value);
        return uint8ArrayToString(new Uint8Array(encryptedData));
    }

    static async decryptAccount(value: string) {
        //读取私钥，加密的对称秘钥
        const encryptedData = stringToUint8Array(value).buffer;
        return await Cry.decryptRSA(Cry.getKey("privateKey"), encryptedData);
    }

    /**
     * 从数据库获取 RSA 秘钥信息并验证是否存在
     * @returns 
     */
    static async checkCryKey() {
        const hasKeys: string[] = [];
        const KEYS_NAME: KEYSNAME = await Cry.getKEYS_NAME();
        const path = await Cry.getPathCryKey();
        if (!path) {
            showInfo(getString("info-noDir"));
            return;
        }
        for (const keyName of Object.keys(KEYS_NAME)) {
            const keyPath = PathUtils.join(path, KEYS_NAME[keyName as "PUBLICKEY_NAME" | 'PRIVATEKEY_NAME']);
            if (!await isRSAKey(keyPath)) return;
            hasKeys.push(keyName);
        }
        return hasKeys;
    }
    /**
     * RAS 公钥私钥均存在则直接返回 false
     * 否则请用户决定
     * @param hasKeys 验证通过的秘钥
     * @returns 
     */
    static async replaceConfirm(hasKeys: string[]) {
        let info = '', title = '';
        const promptService = getPS();
        if (hasKeys.length == 0) {
            info = getString("info-hasNot") + " ARS " + getString("prefs-table-secretKey") + "\n" + getString("info-Confirm") + getString("info-updateCryptoKey") + "?";
            title = getString("info-updateCryptoKey");

            const win = addon.data.prefs?.window;
            const options = ["不选择", "选择文件夹", "创建新的秘钥"];
            const selectResult = {};
            const cf = promptService.select(win, title, info, options, selectResult);
            if (cf) {
                return selectResult;
            } else {
                return;
            }

        } else if (hasKeys.includes("PRIVATEKEY_NAME") && hasKeys.includes("PUBLICKEY_NAME")) {
            return false;
        } else {
            const infokeys = [];
            if (hasKeys.includes("PUBLICKEY_NAME")) {
                infokeys.push(getString("info-publicKey"));
            }
            if (hasKeys.includes("PRIVATEKEY_NAME")) {
                infokeys.push(getString("info-privateKey"));
            }
            if (hasKeys.includes("AESCBCKEY_NAME")) {
                infokeys.push(getString("info-AESKey"));
            }
            info = getString("info-has") + ":\n" + infokeys.join(", ") + "\n" + getString("info-Confirm") + getString("info-replaceOldKey") + "\n" + getString("info-decrypThenEncrypt");
            title = getString("info-replaceOldKey");
        }

        //return promptService.confirm(addon.data.prefs?.window, title, info);

    }

    static async importCryptoKey(filePaths?: string[]) {
        //确认要导入的秘钥所在目录，上次导入的路径保存在db中

        let importDirectory;
        const cryPath = await Cry.getPathCryKey();
        if (!filePaths) {
            importDirectory = await chooseDirOrFilePath(
                "dir",
                await Cry.getImportDir(),
                getString("info-importDir"));
            if (!importDirectory) return;
            if (cryPath == importDirectory) {
                showInfo(getString("info-sameDirectory"));
                return;
            }
            filePaths = await Cry.chooseRSAKeys(importDirectory);
            if (!filePaths) return;
        } else {
            //确保文件是同一个目录
            const parents = [...new Set(...filePaths.map(path => PathUtils.parent(path)).filter(e => e))];
            if (parents.length != 1) return;
            importDirectory = parents[0];
            if (cryPath == importDirectory) {
                showInfo(getString("info-sameDirectory"));
                return;
            }


        }



        /* if (!filePaths || filePaths.length === 0) {
            //参数没有指定文件时，用户选择秘钥存储目录下已有的秘钥
            //const temp = (await IOUtils.getChildren(importDirectory)).filter((path: string) =>);
            

            const temp = await collectFilesRecursive(importDirectory);
            if (!temp.length) {
                showInfo(getString("info-emptyDirectory"));
                return;
            }
            showInfo(getString("info-selectKey"));
            const fileNames = temp.map(file => file.name);
            const files = temp.map(file => file.path) as string[];
            const dataOut = await selectData(fileNames, addon.data.prefs?.window);
            if (!dataOut) return;
            const fileNamesSelected = Object.values(dataOut);
            filePaths = files.filter((file: string) => fileNamesSelected.includes(PathUtils.filename(file)));
            if (!filePaths) return;
        } */
        showInfo(filePaths);
        showInfo([getString("info-copyFilesTo"), cryPath]);
        const pairPaths = [];
        for (const path of filePaths) {

            const fileName = await getKeyNameByContent(path) as string;
            if (!fileName) {
                showInfo(getString("info-hasErrorKey"));
                return;
            }
            pairPaths.push([path, PathUtils.join(cryPath, fileName)]);
        }
        for (const pair of pairPaths) {
            await IOUtils.copy(pair[0], pair[1]);
        }

        await Cry.setImportDir(importDirectory);
        await Cry.setMD5CryKey();
        showInfo(getString("info-importSuccess"));
    }
    static async createCryKey(path?: string) {
        const state = await encryptState();
        if (state) {
            const tip = getString("info-offCrypto") + "\n" + getString("info-exit");
            confirmWin(tip, "win");
            return;
        }
        if (!path) path = await Cry.getPathCryKey() || PathUtils.join(addonDatabaseDir, "cryptoKeys");
        if (!path) return;
        await Cry.creatRASKeys(path);
        await Cry.setPathCryKey(path);
        await Cry.setMD5CryKey();
    }

    static async updateCryptoKey() {
        let path;
        path = await Cry.getPathCryKey();
        if (path) {
            const tip = getString("info-useDefaultDirectory") + "\n" + path;
            const cf = confirmWin(tip, "win");
            if (!cf) path = null;
        }
        if (!path) path = await chooseDirOrFilePath("dir", addonDatabaseDir, getString("info-selectSavePath"));
        if (!path) return;
        await decryptAll();
        await Cry.createCryKey(path);
        showInfo(getString("info-updated"));
    }

    static async chooseRSAKeys(path: string) {
        const temp = await getFiles(path);//不含子文件夹    
        const files = [];
        for (const path of temp) {
            if (await isRSAKey(path)) files.push(path);
        }
        if (files.length) {
            const win = addon.data.prefs?.window || window;
            let confirm = win.confirm(getString("info-dirNotEmpty"));
            if (!confirm) {
                showInfo(getString("info-userCancle"));
                return;
            }

            //const files = temp.map(file => file.path) as string[];
            let fileNames = files.map(path => PathUtils.filename(path));
            const dataOut = selectData(fileNames, win);
            if (!dataOut) return;
            const fileNamesSelected = Object.keys(dataOut).map(key => dataOut[key]);
            const filesSelected = files.filter((file: string) => fileNamesSelected.includes(OS.Path.basename(file)));
            if (await isRechooseFiles(filesSelected)) {
                const TIP = getString("info-selectOrCancle");
                while (TIP) {
                    const path = await chooseDirOrFilePath("files", addonDatabaseDir, TIP);
                    filesSelected.push(...path);
                    showInfo(filesSelected.join('\n'));
                    if (!path) break;
                }
                if (await isRechooseFiles(filesSelected)) return;
            }
            // 是否导入原有秘钥
            fileNames = filesSelected.map(e => PathUtils.filename(e));
            const promptService = getPS();
            const title = getString("info-addOldCryKey");
            const info = getString("info-has") + fileNames.join(', ') + "\n" + getString("info-Confirm") + getString("info-addOldCryKey") + "?";
            confirm = promptService.confirm(window, title, info);
            if (confirm) {
                let info = filesSelected.join('\n');
                const title = getString("info-checkPath");
                confirm = promptService.confirm(window, title, info);
                if (!confirm) {
                    const fs = await chooseDirOrFilePath("files", path);
                    info = fs.join('\n');
                    confirm = promptService.confirm(window, title, info);
                    if (!confirm) {
                        showInfo(getString('info-cancle') + ': ' + getString("info-addOldCryKey"));
                        return;
                    }
                }
                return filesSelected;
            } else {
                confirm = promptService.confirm(window, "Are You Shoure", "create new AES RSA keys?");
                if (!confirm) return;

            }

        } else {
            showInfo(getString("info-emptyDirectory") + getString("info-noRSAKeys"));
        }
    }


    static async creatRASKeys(path: string) {
        const KEYS_NAME = await Cry.getKEYS_NAME();
        const keyPair = await Cry.getRSAKeyPair();
        const publicKey = await Cry.exportKey(keyPair.publicKey);
        //const AESKey = await Cry.getAESKey();
        //const AESKeyWraped = await window.crypto.subtle.wrapKey("raw", AESKey, keyPair.publicKey, { name: "RSA-OAEP" });
        await Cry.saveKey(publicKey, PathUtils.join(path, KEYS_NAME["PUBLICKEY_NAME"]));
        await Cry.saveKey(await Cry.exportKey(keyPair.privateKey), PathUtils.join(path, KEYS_NAME["PRIVATEKEY_NAME"]));
        //if (KEYS_NAME["AESCBCKEY_NAME"]) await Cry.saveKey(new Uint8Array(AESKeyWraped), PathUtils.join(path, KEYS_NAME["AESCBCKEY_NAME"]));
        addon.mountPoint["crypto"] = {
            publicKey: publicKey,
            path: path,
        };
    }

    static async getPathCryKey(keyName?: string) {
        const DB = await getDB();
        keyName = keyName ? keyName : 'cryptoKeyPath';
        return await DB.valueQueryAsync(`SELECT value from settings WHERE key = '${keyName}'`) as string;
    }

    /**
     * 插件数据库存储秘钥路径
     * 没有记录则添加，有变化则更新
     * @param path 
     * @returns 
     */
    static async setPathCryKey(path: string) {
        const DB = await getDB();
        let sql = `SELECT value from settings WHERE key = 'cryptoKeyPath'`;
        const value = await DB.valueQueryAsync(sql);
        if (value && path == value) return;
        await DB.executeTransaction(async () => {
            value ? sql = `UPDATE settings SET value = '${path}' WHERE key = 'cryptoKeyPath'`
                : sql = `INSERT INTO settings (setting,key,value) VALUES ('addon','cryptoKeyPath','${path}')`;
            await DB.queryAsync(sql);
        });
    }


    static async setPathRSAKeys(path: string[]) {
        const DB = await getDB();

        let sql = `SELECT value from settings WHERE key = 'cryptoKeyPath'`;
        const value = await DB.valueQueryAsync(sql);
        if (value && path == value) return;
        await DB.executeTransaction(async () => {
            value ? sql = `UPDATE settings SET value = '${path}' WHERE key = 'cryptoKeyPath'`
                : sql = `INSERT INTO settings (setting,key,value) VALUES ('addon','cryptoKeyPath','${path}')`;
            await DB.queryAsync(sql);
        });
    }


    static async setMD5CryKey() {
        await md5CryKey(modifyValue);
    }

    static async verifyMD5CryKey() {
        await md5CryKey(verifyValueDB);
    }

    static async getImportDir() {
        const sqlSELECT = `SELECT value FROM settings WHERE setting='addon' AND key='importDirectory'`;
        const DB = await getDB();
        return await DB.valueQueryAsync(sqlSELECT);
    }
    static async setImportDir(importDirectory: string) {
        if (!await IOUtils.exists(importDirectory)) return;
        if (!PathUtils.isAbsolute(importDirectory)) return;
        const DB = await getDB();
        const old = await Cry.getImportDir();
        if (importDirectory == old) return;
        await DB.executeTransaction(async () => {
            let sql;
            old ? sql = `UPDATE settings SET value = '${importDirectory}' WHERE key = 'importDirectory'`
                : sql = `INSERT INTO settings (setting,key,value) VALUES ('addon','importDirectory','${importDirectory}')`;
            await DB.queryAsync(sql);
        });
    }
    static async getKEYS_NAME() {
        if (addon.mountPoint["KEYS_NAME"]) {
            const KEYS_NAME = addon.mountPoint["KEYS_NAME"] as KEYSNAME;
            await Cry.identifyKEYS_NAME(KEYS_NAME);
            return KEYS_NAME;
        }
        const DB = await getDB();
        const sql = `SELECT value from settings WHERE key = 'cryptoKeysName'`;
        const jsonString = await DB.valueQueryAsync(sql);
        if (!jsonString) return await Cry.setDefaultKEYS_NAME();
        //jsonString = await DB.valueQueryAsync(sql);

        const KEYS_NAME = JSON.parse(jsonString) as KEYSNAME;
        await Cry.identifyKEYS_NAME(KEYS_NAME);
        return addon.mountPoint["KEYS_NAME"] = KEYS_NAME;
    }
    static async identifyKEYS_NAME(KEYS_NAME: KEYSNAME) {
        const keyNames = Object.keys(KEYS_NAME);
        if (!keyNames.includes("PUBLICKEY_NAME") || !keyNames.includes("PRIVATEKEY_NAME") || (keyNames.length != 2)) {
            showInfo(getString("info-incorrectRSAName"));
            await Command.customKeysFileName(KEYS_NAME);
        }

    }
    static async setDefaultKEYS_NAME() {
        const KEYS_NAME: KEYSNAME = {
            PUBLICKEY_NAME: `RSA-OAEP-${config.addonRef}.pub`,
            PRIVATEKEY_NAME: `RSA-OAEP-${config.addonRef}`,
            //AESCBCKEY_NAME: `AES-CBC-Wraped-${config.addonRef}`
        };
        return await Cry.setKEYS_NAME(KEYS_NAME);
    }

    static async setKEYS_NAME(KEYS_NAME: KEYSNAME) {
        await Cry.identifyKEYS_NAME(KEYS_NAME);
        const DB = await getDB();
        const jsonString = JSON.stringify(KEYS_NAME);
        const value = await DB.valueQueryAsync(`SELECT value from settings WHERE key = 'cryptoKeysName'`);
        if (value && jsonString == value) return KEYS_NAME;
        await DB.executeTransaction(async () => {
            let sql;
            value ? sql = `UPDATE settings SET value = '${jsonString}' WHERE key = 'cryptoKeysName'`
                : sql = `INSERT INTO settings (setting,key,value) VALUES ('addon','cryptoKeysName','${jsonString}')`;
            await DB.queryAsync(sql);
        });
        addon.mountPoint["KEYS_NAME"] = KEYS_NAME;
        return KEYS_NAME;
    }

    // todo 更换 SSHKEY 密钥轮换 保留旧秘钥解码相应密文
    //RSA算法，在使用OAEP填充模式时，每次最多只能加密190字节。
    //非对称密钥加解密的性能相对于对称密钥，差了很多，在这实际的业务流加解密中，无法进行业务落地。
    //因此在实际的工程化上，一般使用非对称密钥进行数据密钥的协商与交换，而使用数据密钥与对称加密算法进行数据流的加解密保护。

}


export async function encryptState() {
    const sqlSELECT = `SELECT value FROM settings WHERE setting='addon' AND key='enableEncrypt'`;
    const DB = await getDB();
    const dbValue = await DB.valueQueryAsync(sqlSELECT);
    return Boolean(Number(dbValue));////undefined转NaN转false，null转0转false
}




/**
 * - 返回 json 字符串
 * - 含有：
 * - encryptAESString
 * - signatureString
 * - decryptAlgorithm
 * - ivString
 * - wrapedAESKeyString
 * - wrapedSignKeyString
 * @param text 
 * @returns 
 */
export const encryptByAESKey = async (text: string) => {
    const key = await Cry.unwrapAESKey();
    if (!key) return;
    const data = new TextEncoder().encode(text);
    const signKey = await Cry.getSignKey();
    const iv = Cry.getIV();//加解密必须使用相同的初始向量,iv是 initialization vector的缩写，必须为 16 位
    const algorithm = { name: 'AES-CBC', iv };// 加密算法
    const encryptAESBuffer = await window.crypto.subtle.encrypt(algorithm, key, data);//加密
    const encryptAESString = arrayBufferTOstring(encryptAESBuffer);//密文转字符串  
    const signature = await Cry.signInfo(encryptAESBuffer, signKey);//密文签名
    const signatureString = arrayBufferTOstring(signature); //签名转字符串 
    const publicKey = await Cry.getKey("publicKey") as CryptoKey;
    const wrapedAESKey = await Cry.getKey("AESCBC") as Uint8Array;//wrapedAESKey可以是储存的和当前包裹的key
    const wrapedSignKey = await window.crypto.subtle.wrapKey("raw", signKey, publicKey, { name: "RSA-OAEP" });
    const wrapedSignKeyString = arrayBufferTOstring(wrapedSignKey);
    const wrapedAESKeyString = arrayBufferTOstring(wrapedAESKey.buffer);
    const decryptAlgorithm = { name: 'AES-CBC' };
    const ivString = arrayBufferTOstring(iv);//向量转字符串
    const encryptAESInfo = {
        encryptAESString,
        signatureString,
        decryptAlgorithm,
        ivString,
        wrapedAESKeyString,
        wrapedSignKeyString
    };
    const stringEncyptAES = JSON.stringify(encryptAESInfo);
    //未传sn，为一般文本加密，返回加密结果，
    //否则为秘钥或token则写入数据库
    return stringEncyptAES;

};


export const encryptFileByAESKey = async (path?: string) => {
    if (!path) {
        path = await chooseDirOrFilePath('file');
        if (!path) return;
    }
    const fileUint8Array = await IOUtils.read(path);
    if (!fileUint8Array) return;
    const signKey = await Cry.getSignKey();
    const iv = Cry.getIV();//加解密必须使用相同的初始向量,iv是 initialization vector的缩写，必须为 16 位
    const algorithm = { name: 'AES-CBC', iv };// 加密算法
    const key = await Cry.getAESKey();
    if (!key || !iv || !signKey) return;
    const encryptAESBuffer = await window.crypto.subtle.encrypt(algorithm, key, fileUint8Array);//加密
    const encrypedFilePath = path + ".AESEncrypt";
    const res = await IOUtils.write(encrypedFilePath, new Uint8Array(encryptAESBuffer));
    if (!res) return;
    const fileMD5 = await Zotero.Utilities.Internal.md5Async(encrypedFilePath);
    if ((getDom("deleSourceFile") as XUL.Checkbox)?.checked) {
        await Zotero.File.removeIfExists(path);
    }
    const signature = await Cry.signInfo(encryptAESBuffer, signKey);//密文签名
    const signatureString = arrayBufferTOstring(signature); //签名转字符串 
    const publicKey = await Cry.getKey("publicKey") as CryptoKey;
    const wrapedAESKey = await window.crypto.subtle.wrapKey("raw", key, publicKey, { name: "RSA-OAEP" });
    const wrapedSignKey = await window.crypto.subtle.wrapKey("raw", signKey, publicKey, { name: "RSA-OAEP" });
    const wrapedSignKeyString = arrayBufferTOstring(wrapedSignKey);
    const wrapedAESKeyString = arrayBufferTOstring(wrapedAESKey);
    const decryptAlgorithm = { name: 'AES-CBC' };
    const ivString = arrayBufferTOstring(iv);//向量转字符串
    if (!signatureString || !decryptAlgorithm! || !ivString || !wrapedAESKeyString || !wrapedSignKeyString) return;
    const encryptAESInfoNoFileBuffer = {
        signatureString,
        decryptAlgorithm,
        ivString,
        wrapedAESKeyString,
        wrapedSignKeyString,
        fileMD5,
    };
    const stringToTableEncryptFilePaths = JSON.stringify(encryptAESInfoNoFileBuffer);
    const sql = `INSERT INTO encryptFilePaths (MD5, path, encryptAESStringNoBuffer) VALUES (?,?,?)`;
    const args = [fileMD5, encrypedFilePath, stringToTableEncryptFilePaths];
    //'${fileMD5}', '${encrypedFilePath}','${stringToTableEncryptFilePaths}'
    const DB = getDBSync();
    await DB.executeTransaction(async () => {
        await DB.queryAsync(sql, args);
    });
    return encrypedFilePath;
};


export async function decryptByAESKey(encryptAESInfoString: string): Promise<string>;
export async function decryptByAESKey(encryptAESInfoString: string, fileBuffer: Buffer | Uint8Array): Promise<ArrayBuffer>;

/**
 * - 字符串参数至少含有密文和向量
 * - 其他参数参见 {@link EncryptAESInfo}
 * - 文件解密时，从文件读取 buffer/Unit8Array ，作为参数传递
 * @param encryptAESInfoString 
 * @returns 
 */
export async function decryptByAESKey(encryptAESInfoString: string,
    fileBuffer?: Buffer | Uint8Array,
    path?: string) {
    const encryptAESInfo = JSON.parse(encryptAESInfoString!);    //@ts-ignore XXX
    if (!encryptAESInfo.ivString) return;
    Object.keys(encryptAESInfo).forEach(key => {
        if (typeof encryptAESInfo[key] == "string") {
            encryptAESInfo[key] = stringToArrayBuffer(encryptAESInfo[key]);
        }
    });
    const privateKey = await Cry.getKey("privateKey") as CryptoKey;
    const algorithmVerify = { name: 'HMAC', hash: { name: 'SHA-256' } };
    // 签名验证
    if (encryptAESInfo.wrapedSignKeyString) {
        const signingKey = await window.crypto.subtle.unwrapKey(
            "raw",
            encryptAESInfo.wrapedSignKeyString,
            privateKey,
            { name: "RSA-OAEP" },
            algorithmVerify,
            true,
            ['sign', 'verify']
        );
        const signature = encryptAESInfo.signatureString;
        encryptAESInfo.encryptAESString;
        const data = fileBuffer ? fileBuffer : encryptAESInfo.encryptAESString;
        if (!data) {
            //无签名验证？
            const test = "test";
        }

        const verified = await window.crypto.subtle.verify(algorithmVerify, signingKey, signature, data);

        if (!verified) {
            throw new Error("Can't verify message");
        }
    }
    let key;
    if (encryptAESInfo.wrapedAESKeyString) {
        key = await window.crypto.subtle.unwrapKey(
            "raw",
            encryptAESInfo.wrapedAESKeyString,
            privateKey,
            { name: "RSA-OAEP" },
            { name: 'AES-CBC' },
            true,
            ["encrypt", "decrypt"]);
    }

    if (!key) {
        showInfo(getString("info-noAESKey"));
        return;
    }
    if (!encryptAESInfo.decryptAlgorithm.name) {
        encryptAESInfo.decryptAlgorithm.name = 'AES-CBC';
    }
    const algorithm = { name: encryptAESInfo.decryptAlgorithm.name, iv: encryptAESInfo.ivString };
    if (!encryptAESInfo.encryptAESString) {
        if (!fileBuffer) {
            showInfo(getString("info-noBuffer"));
            return;
        }
        encryptAESInfo.encryptAESString = fileBuffer;
    }
    const deBuffer = await window.crypto.subtle.decrypt(algorithm, key, encryptAESInfo.encryptAESString);
    if (!deBuffer) {
        showInfo(getString("info-decryptFailure"));
        return false;
    }
    if (fileBuffer) {
        return deBuffer;
    }
    const decryptContent = arrayBufferTOstring(deBuffer);
    showInfo(["decryptContent:", decryptContent]);
    return decryptContent;
}

export async function decryptAccount(sn: number | string) {
    const DB = getDBSync();
    const SK_TK_FIELD = {
        accounts: "secretKey",
        accessTokens: "token"
    };
    const tableName = await getTableBySN(sn);
    if (!tableName) return;
    let sql = `SELECT ${SK_TK_FIELD[tableName]} FROM ${tableName} WHERE serialNumber = ${sn}`;
    let value = await DB.valueQueryAsync(sql);
    if (!value) return;
    value = await decryptByAESKey(value);
    if (!value) {
        const info = "decryptAccount error: " + tableName + " - " + sn;
        showInfo(info);
        throw new Error(info);
    }
    sql = `UPDATE ${tableName} SET ${SK_TK_FIELD[tableName]} = '${value}' WHERE serialNumber = ${sn}`;
    await DB.queryAsync(sql);
    showInfo(`${sn} has decrypted`);
    sql = `DELETE FROM encryptAccounts WHERE serialNumber = ${sn}`;
    await DB.queryAsync(sql);
}
export async function decryptAllAccount() {
    showInfo("Decrypt The Encrypted Accounts...");
    const encryptSerialNumbers = await getAllEncryptAccounts();
    if (!encryptSerialNumbers?.length) return;
    const DB = getDBSync();
    if (!window.confirm(getString("info-decryptAllAccount") + "?")) {
        showInfo(getString("info-userCancle"));
        throw getString("info-userCancle");
    }
    return await DB.executeTransaction(async () => {
        const decryptFaildSN = [];
        const decryptAccounts = [];
        const SK_TK_FIELD = {
            accounts: "secretKey",
            accessTokens: "token"
        };
        for (const sn of encryptSerialNumbers) {
            const tableName = await getTableBySN(sn);
            if (!tableName) {
                decryptFaildSN.push(sn);
                continue;
            }
            let sql = `SELECT ${SK_TK_FIELD[tableName]} FROM ${tableName} WHERE serialNumber = ${sn}`;
            let value = await DB.valueQueryAsync(sql);
            if (!value) {
                decryptFaildSN.push(sn);
                continue;
            }
            value = await decryptByAESKey(value);
            if (!value) {
                decryptFaildSN.push(sn);
                const info = "decryptAccount error: " + tableName + " - " + sn;
                showInfo(info);
                throw new Error(info);
            }
            sql = `UPDATE ${tableName} SET ${SK_TK_FIELD[tableName]} = '${value}' WHERE serialNumber = ${sn}`;
            await DB.queryAsync(sql);

            decryptAccounts.push(sn);
            showInfo(`${sn} has decrypted`);
            //删除记录
            sql = `DELETE FROM encryptAccounts WHERE serialNumber = ${sn}`;
            await DB.queryAsync(sql);

        }
        if (decryptFaildSN.length) {
            showInfo("decrypt Faild SerialNumber: ");
            showInfo(decryptFaildSN);
            addon.mountPoint.decryptFaildSN = decryptFaildSN;
            confirmWin(getString("info-correct") + getString("info-then") + getString("info-retry"));
            return;
        }
        return decryptAccounts;
    }) as string[];

}

/**
   * @returns encryptSerialNumbers
   */
async function getAllEncryptAccounts() {
    const DB = await getDB();
    const rows = await DB.queryAsync(`SELECT serialNumber FROM encryptAccounts`);
    if (!rows.length) {
        showInfo("No encrypted account");
        return;
    }
    return dbRowsToArray(rows, ['serialNumber'])?.flat(Infinity) as string[];
}



export async function decryptAllFiles() {
    showInfo("Decrypt The Encrypted Files...");
    const DB = await getDB();
    const rows = await DB.queryAsync(`SELECT MD5, path, encryptAESStringNoBuffer FROM encryptFilePaths`);
    const fileEncryptInfos = dbRowsToObjs(rows, ["MD5", "path", "encryptAESStringNoBuffer"]);
    if (!fileEncryptInfos || !fileEncryptInfos.length) {
        showInfo("No encrypted file");
        return;
    }
    if (!confirmWin(getString("info-decryptAllFiles") + "?", "win")) {
        showInfo("info-userCancle");
        throw getString("info-userCancle");
    }
    const notExistFileEncrypted = [];
    const DecryptedMD5 = [];
    for (const info of fileEncryptInfos) {
        const path = info.path;
        const md5 = await Zotero.Utilities.Internal.md5Async(path);
        const encryptAESStringNoBuffer = info.encryptAESStringNoBuffer;
        if (!await IOUtils.exists(path) || info.MD5 != md5 || !encryptAESStringNoBuffer) {
            notExistFileEncrypted.push(path);
            continue;
        }
        await decryptAndWrite(path, encryptAESStringNoBuffer);
        DecryptedMD5.push(info.MD5);
    }
    if (notExistFileEncrypted.length) {
        addon.mountPoint.notExistFileEncrypted = notExistFileEncrypted;
        showInfo("not Exist File Encrypted");
        showInfo(notExistFileEncrypted);
    }
    return DecryptedMD5;
}
export async function deleteRecords(tableName: "encryptFilePaths" | "encryptAccounts", feild: string, values: any[] | any) {
    const DB = await getDB();
    await DB.executeTransaction(async () => {
        if (!Array.isArray(values)) values = [values];
        for (const value of values) {
            const sql = `DELETE FROM ${tableName} WHERE ${feild} = ?`;
            await DB.queryAsync(sql, value);
        }
    });
}

/**
 * 更新秘钥和关闭加密功能时
 */
export async function decryptAll() {
    const decryptAccounts = await decryptAllAccount();
    if (decryptAccounts?.length) await deleteRecords("encryptAccounts", "serialNumber", decryptAccounts);
    const DecryptedMD5 = await decryptAllFiles();
    if (DecryptedMD5?.length) await deleteRecords("encryptFilePaths", "MD5", DecryptedMD5);
    const numbers = (decryptAccounts?.length || 0) + (DecryptedMD5?.length || 0);
    if (numbers) showInfo(getString("info-finishedDecrypt") + ": " + numbers);
}

export async function getEncryptFileString(path: string) {
    const fileMD5 = await Zotero.Utilities.Internal.md5Async(path);
    if (!fileMD5) return;
    const DB = await getDB();
    const sql = `SELECT encryptAESStringNoBuffer FROM encryptFilePaths WHERE MD5 = ?`;
    //LIKE 模糊匹配为了防止脚本注入，必须以参数传递，此时不能加单引号
    return await DB.valueQueryAsync(sql, fileMD5);
}
export async function decryptFileSelected() {
    const path = await chooseDirOrFilePath('file');
    if (!path) return;
    const fileMD5 = await Zotero.Utilities.Internal.md5Async(path);
    if (!fileMD5) return;
    const DB = await getDB();
    let sql = `SELECT encryptAESStringNoBuffer FROM encryptFilePaths WHERE MD5 = ?`;
    const encryptAESStringNoBuffer = await DB.valueQueryAsync(sql, fileMD5);
    await decryptAndWrite(path, encryptAESStringNoBuffer);
    const deleteRecord = 0;
    if (!deleteRecord) return;
    sql = `DELETE FROM encryptFilePaths WHERE MD5 = 'fileMD5'`;
    await DB.queryAsync(sql);


}

async function decryptAndWrite(path: string, encryptFileString: string) {
    if (!path || !encryptFileString) return;
    const fileUint8Array = await IOUtils.read(path);
    if (!fileUint8Array) return;
    const deBuffer = await decryptByAESKey(encryptFileString, fileUint8Array) as ArrayBuffer;
    if (!(deBuffer?.constructor instanceof ArrayBuffer)) return;
    const parent = PathUtils.parent(path)!;
    const fileName = PathUtils.filename(path).replace(".AESEncrypt", "");
    const decryptFilePath = PathUtils.join(parent, "decrypt-" + fileName);
    await IOUtils.write(decryptFilePath, new Uint8Array(deBuffer as ArrayBuffer));
    showInfo([getString("info-decryptFileSuccess"), decryptFilePath]);
}





export async function getAccountTableName(serialNumber: number | string) {
    const DB = getDBSync();
    let tableName = "accounts";
    let sql = `SELECT COUNT(*) FROM ${tableName} WHERE serialNumber = ${serialNumber}`;
    let count = await DB.valueQueryAsync(sql);
    if (count > 0) return tableName;
    tableName = "accessTokens";
    sql = `SELECT COUNT(*) FROM ${tableName} WHERE serialNumber = ${serialNumber}`;
    count = await DB.valueQueryAsync(sql);
    if (count > 0) return tableName;
}


export async function testCryInfo(info: string) {
    const cryedInfo = await encryptByAESKey(info);
    if (!cryedInfo) return;
    const cryedInfoJSON = JSON.parse(cryedInfo);
    showInfo(cryedInfoJSON.encryptAESString);
}

declare type DBKV = {
    field: string;
    value: string;
};
async function modifyValue(tableName: string, target: DBKV, condition: DBKV, ...others: DBKV[]) {
    const DB = await getDB();
    let sql = `SELECT ${target.field} from ${tableName} WHERE ${condition.field} = '${condition.value}'`;
    const oldValue = await DB.valueQueryAsync(sql);
    if (oldValue && oldValue == target.value) return true;
    await DB.executeTransaction(async () => {
        if (oldValue) {
            sql = `UPDATE ${tableName} SET ${target.field} = '${target.value}' WHERE ${condition.field} = '${condition.value}'`;
            await DB.queryAsync(sql);
        } else {
            others.push(target);
            others.push(condition);
            const sqlColumns = others.map(kv => kv.field);
            const sqlValues = others.map(kv => kv.value);
            sql = `INSERT INTO ${tableName} (${sqlColumns.join(",")}) VALUES (${sqlValues.map(() => "?").join()})`;
            await DB.queryAsync(sql, sqlValues);
        }
        //sql = `INSERT INTO ${tableName}  VALUES (${sqlValues.map(() => "?").join()})`;
    });
    return true;
}

async function verifyValueDB(tableName: string, target: DBKV, condition: DBKV) {
    const DB = await getDB();
    const sql = `SELECT ${target.field} from ${tableName} WHERE ${condition.field} = '${condition.value}'`;
    const oldValue = await DB.valueQueryAsync(sql);
    if (!oldValue) return false;
    if (oldValue && oldValue == target.value) return true;
    throw new Error(condition.value + " MD5 faild verify with record of database.");
}



export async function getSettingValue(value: string) {
    const DB = await getDB();
    const sql = `SELECT value from settings WHERE key = '${value}'`;
    return await DB.valueQueryAsync(sql) as string;

}
const mapDB = {
    PUBLICKEY_NAME: "publicKeyMD5",
    PRIVATEKEY_NAME: "privateKeyMD5",
};
async function md5CryKey(fn: any) {

    const KEYS_NAME = await Cry.getKEYS_NAME();
    const path = await Cry.getPathCryKey();
    for (const key of Object.keys(KEYS_NAME)) {
        const keypath = PathUtils.join(path, KEYS_NAME[key as "PUBLICKEY_NAME" | "PRIVATEKEY_NAME"]);
        if (!await IOUtils.exists(keypath)) return false;
        const md5 = await Zotero.Utilities.Internal.md5Async(keypath);
        if (!md5) return false;
        const tableName = "settings";
        const target: DBKV = { field: "value", value: md5 };
        const condition: DBKV = {
            field: "key",
            value: mapDB[key as "PUBLICKEY_NAME" | "PRIVATEKEY_NAME"]
        };
        const others = [{ field: "setting", value: "addon" }];
        await fn(tableName, target, condition, ...others);
    }
    return true;
}



