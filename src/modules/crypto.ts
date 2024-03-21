import { arrayBufferTOstring, chooseDirOrFilePath, chooseFiles, collectFilesRecursive, confirmWin, ensureNonePath, getPS, showInfo, stringToArrayBuffer, stringToUint8Array, uint8ArrayToString } from '../utils/tools';
import { config } from "../../package.json";
import { addonDatabaseDir } from "../utils/constant";
import { getDB, getDBSync } from "./database/database";
import { OS } from "../utils/tools";
import { getString } from '../utils/locale';
import { dbRowsToArray, dbRowsToObjs } from './translate/translateServices';
import { getDom } from './ui/uiTools';
import { selectData, directorySaveCryptoKeys } from './ui/dataDialog';
import { Command } from './command';



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
        showInfo(name + " 文件无法读取");
        return false;
    }
    let ctx;
    try {
        ctx = await IOUtils.readUTF8(path);
    } catch (e: any) {
        ctx = await IOUtils.read(path);
    }

    if (!ctx) {
        showInfo(name + " 文件读取失败");
        return false;
    }
    //ctx = await Zotero.File.getContentsAsync(path);
    if (!KEYS_NAME) {
        KEYS_NAME = await Cry.getKEYS_NAME();
        if (!KEYS_NAME) return false;
    }
    if (typeof ctx == "string" && name == KEYS_NAME.PUBLICKEY_NAME) {
        if ((!ctx.startsWith(BEGIN_PUBLIC) || !ctx.endsWith(END_PUBLIC))) {
            showInfo("文件不是有效的 pem 格式 RSA 公钥");
            return false;
        } else {
            return true;
        }
    }

    if (typeof ctx == "string" && name == KEYS_NAME.PRIVATEKEY_NAME) {
        if ((!ctx.startsWith(BEGIN_PRIVATE) || !ctx.endsWith(END_PRIVATE))) {
            showInfo("文件不是有效的 pem 格式 RSA 私钥");
            return false;
        } else {
            return true;
        }
    }

    if (ctx.constructor == Uint8Array && name == KEYS_NAME.AESCBCKEY_NAME) {
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
            showInfo("无 RSA 私钥，无法验证AES秘钥");
            return false;
        }
        const privateKey = await Cry.importKey(privateStirng);
        if (!privateKey) {
            showInfo("无 RSA 私钥，无法验证AES秘钥");
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
            showInfo("文件不是有效的 AES 秘钥");
        return false;
    }
    else {
        return true;
    }
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
            showInfo("format mismatch PRIVATE and PUBLIC, use origin crypto function");
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
        path = await ensureNonePath(path, addon.data.prefs?.window);
        if (!path) return;
        if (!key || !path || await IOUtils.exists(path)) { showInfo("not save"); return; }
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
        const info = getString("info-hasNot") + " crypto " + getString("prefs-table-secretKey") + "\n" + getString("info-addNewCryKey");
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
     * 
     * @param needUserConfirm 
     * @returns 
     */
    static async checkCryKey() {
        const hasKeys: string[] = [];
        const KEYS_NAME: KEYSNAME = await Cry.getKEYS_NAME();
        let path = addon.mountPoint.crypto?.path;
        path = path ? path : await Cry.getPathCryKey();
        for (const keyName of Object.keys(KEYS_NAME)) {
            const keyPath = PathUtils.join(path, KEYS_NAME[keyName as "PUBLICKEY_NAME" | 'PRIVATEKEY_NAME']);
            //const exist = await IOUtils.exists(keyPath);
            const existCorrectContent = await verifyKeyContent(keyPath, undefined, KEYS_NAME);
            if (!existCorrectContent) continue;
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
        if (hasKeys.length == 0) {
            info = getString("info-hasNot") + " AES ARS " + getString("prefs-table-secretKey") + "\n" + getString("info-Confirm") + getString("info-addNewCryKey") + "?";
            title = getString("info-addNewCryKey");
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
        const promptService = getPS();
        return promptService.confirm(window, title, info);
    }

    static async importCryKey(filePaths?: string[]) {
        //确认存储目录
        const directoryCryptoKeys = await identifyPathCryKey();
        if (!directoryCryptoKeys) return;

        if (!filePaths || filePaths.length === 0) {
            //参数没有指定文件时，用户选择秘钥存储目录下已有的秘钥
            const temp = await collectFilesRecursive(directoryCryptoKeys);
            if (!temp.length) {
                showInfo("文件夹为空");
                return;
            }
            const fileNames = temp.map(file => file.name);

            const files = temp.map(file => file.path) as string[];
            const win = addon.data.prefs?.window;

            const dataOut = selectData(fileNames, win);
            if (!dataOut) return;
            //const fileNamesSelected = Object.keys(dataOut).filter(key => dataOut[key] === true);
            const fileNamesSelected = Object.values(dataOut);
            filePaths = files.filter((file: string) => fileNamesSelected.includes(PathUtils.filename(file)));
            if (!filePaths) return;
        }
        if (await isRechooseFiles(filePaths)) {
            const temp = await chooseFiles();
            if (await isRechooseFiles(temp)) {
                showInfo("所选文件不是有效秘钥，请重新选择");
                return;
            }
            filePaths = temp;
        }
        showInfo(filePaths.join('\n'));
        //return;
        const cryPath = await Cry.getPathCryKey();
        for (const path of filePaths) {
            const fileName = PathUtils.filename(path);
            await IOUtils.copy(path, cryPath + fileName);
        }
        //await Cry.setPathCryKey(directoryCryptoKeys);加密路径不变，文件名不变，除非人为指定




        //const selectedPaths = res.filePaths;


        //await Cry.makeNewRASAESKeys(pathSave);
        // await Cry.setPathCryKey(pathSave);

        //const dirHandle = await window.showDirectoryPicker();

        //|| await chooseDirOrFilePath("dir", addonDatabaseDir, getString("info-selectSavePath"));

        showInfo("TODO");
        async function identifyPathCryKey() {
            const pathSelect = await Cry.getPathCryKey() || await chooseDirOrFilePath("dir", addonDatabaseDir, getString("info-selectSavePath"));
            const res = directorySaveCryptoKeys(pathSelect);
            if (!res) return;
            if (typeof res == "object" && !Object.values(res).length) return;
            const directoryCryptoKeys = Object.values(res)[0];
            if (!directoryCryptoKeys || typeof directoryCryptoKeys !== 'string' || !await IOUtils.exists(directoryCryptoKeys)) return;
            showInfo(["加密秘钥存储目录已确定", directoryCryptoKeys, "该选择文件了"]);
            return directoryCryptoKeys;
        }

    }

    static async addCryKey() {
        //选择文件，确认并验证文件有效

        let path = await Cry.getPathCryKey();
        if (path) {
            const cf = confirmWin("是否使用默认路径？\n" + path, addon.data.prefs?.window);
            if (!cf) path = null;
        }
        if (!path) {
            path = await chooseDirOrFilePath("dir", addonDatabaseDir, getString("info-selectSavePath"));
        }

        if (!path) return;
        const temp = await collectFilesRecursive(path);
        let fileNames = temp.map(file => file.name);
        if (fileNames.length) {
            const win = addon.data.prefs?.window || window;
            let confirm = win.confirm("所选目录非空，是否仍选择该目录");
            if (!confirm) {
                showInfo(getString("info-userCancle"));
                return;
            }
            confirm = win.confirm("是否选择文件");
            if (confirm) {
                const files = temp.map(file => file.path) as string[];
                const dataOut = selectData(fileNames);
                if (!dataOut) return;
                const fileNamesSelected = Object.keys(dataOut).filter(key => dataOut[key] === true);
                const filesSelected = files.filter((file: string) => fileNamesSelected.includes(OS.Path.basename(file)));
                if (await isRechooseFiles(filesSelected)) {
                    const TIP = "Please Select Files, Click Cancle When Finished";
                    while (TIP) {
                        const path = await chooseDirOrFilePath("files", addonDatabaseDir, TIP);
                        filesSelected.push(...path);
                        showInfo(filesSelected.join('\n'));
                        if (!path) break;
                    }
                    if (await isRechooseFiles(filesSelected)) return;
                }
                // 是否导入原有秘钥
                fileNames = filesSelected.map(e => OS.Path.basename(e));
                const promptService = getPS();
                const title = getString("info-addOldCryKey");
                const info = getString("info-has") + fileNames.join(', ') + "\n" + getString("info-Confirm") + getString("info-addOldCryKey") + "?";
                let confirm = promptService.confirm(window, title, info);
                if (confirm) {
                    let info = filesSelected.join('\n');
                    const title = "Check FilePaths";
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
                    Cry.importCryKey(filesSelected);
                    return;
                } else {
                    confirm = promptService.confirm(window, "Are You Shoure", "create new AES RSA keys?");
                    if (!confirm) return;

                }
            }
        }

        showInfo("create new AES RSA keys...");
        await Cry.makeNewRASAESKeys(path);
        await Cry.setPathCryKey(path);
    }



    static async makeNewRASAESKeys(path: string) {
        const KEYS_NAME = await Cry.getKEYS_NAME();
        const keyPair = await Cry.getRSAKeyPair();
        const publicKey = await Cry.exportKey(keyPair.publicKey);
        const AESKey = await Cry.getAESKey();
        const AESKeyWraped = await window.crypto.subtle.wrapKey("raw", AESKey, keyPair.publicKey, { name: "RSA-OAEP" });
        await Cry.saveKey(publicKey, PathUtils.join(path, KEYS_NAME["PUBLICKEY_NAME"]));
        await Cry.saveKey(await Cry.exportKey(keyPair.privateKey), PathUtils.join(path, KEYS_NAME["PRIVATEKEY_NAME"]));
        if (KEYS_NAME["AESCBCKEY_NAME"]) await Cry.saveKey(new Uint8Array(AESKeyWraped), PathUtils.join(path, KEYS_NAME["AESCBCKEY_NAME"]));
        addon.mountPoint["crypto"] = {
            publicKey: publicKey,
            path: path,
        };
    }

    static async getPathCryKey() {
        const DB = await getDB();
        return await DB.valueQueryAsync(`SELECT value from settings WHERE key = 'cryptoKeyPath'`);
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
        if (!keyNames.includes("PUBLICKEY_NAME") || !keyNames.includes("PRIVATEKEY_NAME")) {
            if (addon.mountPoint["KEYS_NAME"]) addon.mountPoint["KEYS_NAME"] = null;
            showInfo(getString("info-noPrivateKey") + " OR " + getString("info-noPublicKey") + " field");
            const confirm = window.confirm(getString("info-customKeysFileName"));
            if (confirm) {
                await Command.customKeysFileName(KEYS_NAME);
            } else {
                throw new Error(getString("info-noPrivateKey") + "OR" + getString("info-noPublicKey") + " field");
            }
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
    if (!fileMD5) return;
    const deleSourceFile = (getDom("deleSourceFile") as XUL.Checkbox)?.checked;
    if (deleSourceFile) {
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
        wrapedSignKeyString
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

/**
 * - 字符串参数至少含有密文和向量
 * - 其他参数参见 {@link EncryptAESInfo}
 * - 文件解密时，从文件读取 buffer/Unit8Array ，作为参数传递
 * @param encryptAESInfoString 
 * @returns 
 */
export const decryptByAESKey = async (encryptAESInfoString: string,
    fileBuffer?: Buffer | Uint8Array,
    path?: string) => {
    const encryptAESInfo = JSON.parse(encryptAESInfoString!);    //@ts-ignore XXX
    if (!encryptAESInfo.ivString) return;
    Object.keys(encryptAESInfo).forEach(key => { if (typeof encryptAESInfo[key] == "string") { encryptAESInfo[key] = stringToArrayBuffer(encryptAESInfo[key]); } });
    //const iv=stringToArrayBuffer(encryptAESInfo.ivString)
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
    } else {
        // 读取保存的对称私钥
        key = await Cry.unwrapAESKey();
    }
    if (!key) {
        showInfo("No available decryption key (AES-CBC)");
        return;
    }
    if (!encryptAESInfo.decryptAlgorithm.name) {
        encryptAESInfo.decryptAlgorithm.name = 'AES-CBC';
    }
    const algorithm = { name: encryptAESInfo.decryptAlgorithm.name, iv: encryptAESInfo.ivString };
    if (!encryptAESInfo.encryptAESString) {
        if (!fileBuffer) {
            showInfo("No provider File's Buffer Or Unit8Array");
            return;
        }
        encryptAESInfo.encryptAESString = fileBuffer;
    }
    const deBuffer = await window.crypto.subtle.decrypt(algorithm, key, encryptAESInfo.encryptAESString);
    if (!deBuffer) {
        showInfo("Decrypt Failure");
        return false;
    }
    if (fileBuffer) {
        return deBuffer;
    }
    const decryptContent = arrayBufferTOstring(deBuffer);
    showInfo(["decryptContent:", decryptContent]);
    return decryptContent;
};


export async function decryptAllAccount() {
    const encryptSerialNumbers = await getAllEncryptAccounts();
    const DB = getDBSync();
    if (!encryptSerialNumbers?.length) return;
    if (!window.confirm(getString("info-decryptAllAccount") + "?")) {
        showInfo("info-userCancle");
        return;
    }
    const decryptedAccounts = await DB.executeTransaction(async () => {
        const snTokens = [];
        const decryptAccounts = [];
        for (const sn of encryptSerialNumbers) {
            let sql = `SELECT secretKey FROM accounts WHERE serialNumber = ${sn}`;
            let secretKey = await DB.valueQueryAsync(sql);
            if (!secretKey) {
                snTokens.push(sn);
                continue;
            }
            secretKey = await decryptByAESKey(secretKey);
            if (!secretKey) throw new Error("decryptAccount error");
            sql = `UPDATE accounts SET secretKey = '${secretKey}' WHERE serialNumber = ${sn}`;
            await DB.queryAsync(sql);
            decryptAccounts.push(sn);
            showInfo(`${sn} has decrypted`);
        }
        for (const sn of snTokens) {
            let sql = `SELECT token FROM accessTokens WHERE serialNumber = ${sn}`;
            let token = await DB.valueQueryAsync(sql);
            if (!token) {
                showInfo(`account ${sn} hasn't serialNumber or token`);
                continue;
            }
            token = await decryptByAESKey(token);
            if (!token) throw new Error("decryptAccount error");
            sql = `UPDATE accessTokens SET token = '${token}' WHERE serialNumber = ${sn}`;
            await DB.queryAsync(sql);
            decryptAccounts.push(sn);
            showInfo(`${sn} has decrypted`);
        }
        return decryptAccounts;
    });
    return decryptedAccounts as string[];
}

/**
   * @returns encryptSerialNumbers
   */
async function getAllEncryptAccounts() {
    const DB = await getDB();
    const rows = await DB.queryAsync(`SELECT serialNumber FROM encryptAccounts`);
    return dbRowsToArray(rows, ['serialNumber'])?.flat(Infinity) as string[];
}


export async function decryptAllFiles() {
    //文件不在原来目录下？
    const DB = await getDB();
    const rows = await DB.queryAsync(`SELECT MD5 path encryptAESStringNoBuffer FROM encryptFilePaths`);
    const fileEncryptInfos = dbRowsToObjs(rows, ['MD5,path,encryptAESStringNoBuffer']);
    if (!fileEncryptInfos || !fileEncryptInfos.length) return;
    if (!window.confirm(getString("info-decryptAllFiles") + "?")) {
        showInfo("info-userCancle");
        return;
    }
    let decryptedFileNumbers = 0;
    for (const info of fileEncryptInfos) {
        const path = info.path;
        const encryptAESStringNoBuffer = info.encryptAESStringNoBuffer;
        const fileUint8Array = await IOUtils.read(path);
        const res = await decryptByAESKey(encryptAESStringNoBuffer, fileUint8Array, path);
        if (res) decryptedFileNumbers++;
    }
    return decryptedFileNumbers;
}

export async function decryptFile(path: string) {
    if (!path) {
        path = await chooseDirOrFilePath('file');
        if (!path) return;
        if (Array.isArray(path)) path = path[0];
    }
    //let fileName = PathUtils.filename(path).split(".").shift()!;
    //fileName = fileName.substring(0, fileName?.length - 3);
    const fileMD5 = await Zotero.Utilities.Internal.md5Async(path);
    const DB = await getDB();
    const sql = `SELECT encryptAESStringNoBuffer FROM encryptFilePaths WHERE MD5 LIKE ?`;
    const args = `%${fileMD5}%`;//LIKE 模糊匹配为了防止脚本注入，必须以参数传递，此时不能加单引号
    const encryptAESStringNoBuffer = await DB.valueQueryAsync(sql, args);
    if (!encryptAESStringNoBuffer) return;
    const fileUint8Array = await IOUtils.read(path);
    const deBuffer = await decryptByAESKey(encryptAESStringNoBuffer, fileUint8Array, path);
    const is = deBuffer?.constructor instanceof ArrayBuffer;
    if (!deBuffer || is) return;
    const parent = PathUtils.parent(path)!;
    const fileName = PathUtils.filename(path).replace(".AESEncrypt", "");

    const decryptFilePath = PathUtils.join(parent, "decrypt-" + fileName);
    await IOUtils.write(decryptFilePath, new Uint8Array(deBuffer as ArrayBuffer));
    showInfo(["decryptFileSuccess", decryptFilePath]);
}

async function getAccountTableName(serialNumber: number | string) {
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
