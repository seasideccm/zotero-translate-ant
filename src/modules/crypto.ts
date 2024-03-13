import { arrayBufferTOstring, chooseDirOrFilePath, collectFilesRecursive, ensureNonePath, getPS, showInfo, stringToArrayBuffer, stringToUint8Array, uint8ArrayToString } from '../utils/tools';
import { config } from "../../package.json";
import { addonDatabaseDir } from "../utils/constant";
import { getDB } from "./database/database";
import { OS } from "../utils/tools";
import { getString } from '../utils/locale';

const KEYS_NAME: {
    PUBLICKEY_NAME: string;
    PRIVATEKEY_NAME: string;
    AESCBCKEY_NAME: string;
} = {
    PUBLICKEY_NAME: `RSAO-AEP-${config.addonRef}.pub`,
    PRIVATEKEY_NAME: `RSA-OAEP-${config.addonRef}`,
    AESCBCKEY_NAME: `AES-CBC-Wraped-${config.addonRef}`
};

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
        const PUBLIC = `-----BEGIN PUBLIC KEY-----\n${keyBase64}\n-----END PUBLIC KEY-----`;
        const PRIVATE = `-----BEGIN PRIVATE KEY-----\n${keyBase64}\n-----END PRIVATE KEY-----`;
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
        let path = addon.mountPoint.crypto?.path;
        if (!path) {
            path = await Cry.getCryKeyPath();
            path ? addon.mountPoint["crypto"]["path"] = path : await Cry.addCryKey();
        }
        path = addon.mountPoint.crypto.path;
        if (type == "AESCBC") {
            path = PathUtils.join(path, "AESCBCWraped");
            let key;
            try {
                key = await IOUtils.read(path);
            } catch (e: any) {
                showInfo(e.message);
                showInfo("Please check: " + path);
                throw e;

            }

            if (!key) {
                showInfo("Please check: " + path);
                return;
            }
            return key;
        }

        if (type == "publicKey") path = PathUtils.join(path, PUBLICKEY_NAME);
        if (type == 'privateKey') path = PathUtils.join(path, PRIVATEKEY_NAME);
        let key;
        try {
            key = await Zotero.File.getContentsAsync(path);
        } catch (e: any) {
            showInfo(e.message);
            showInfo("Please check: " + path);
            throw e;
        }
        if (!key) {
            showInfo("Please check: " + path);
            return;
        }
        if (type == "publicKey") addon.mountPoint.crypto[type] = key;
        if (typeof key == 'string') return await Cry.importKey(key);

    }

    static async unwrapAESKey() {
        const wrapedKey = await Cry.getKey("AESCBC") as Uint8Array;
        if (!wrapedKey) return;
        const privateKey = await Cry.getKey("privateKey") as CryptoKey;
        const AESKey = await window.crypto.subtle.unwrapKey(
            "raw",
            wrapedKey,//.buffer
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

    static async checkCryKey(customComfirm: boolean = false) {
        const hasKeys: string[] = [];
        let path = addon.mountPoint.crypto?.path;
        path = path ? path : await Cry.getCryKeyPath();
        Object.keys(KEYS_NAME).forEach(async (keyName) => {
            const keyPath = OS.Path.join(path, KEYS_NAME[keyName as keyof typeof KEYS_NAME]);
            const exist = await IOUtils.exists(keyPath);
            if (exist) hasKeys.push(keyName);
        });
        showInfo("hasKeys:\n" + hasKeys.join('\n'));
        if (customComfirm) {
            let info = '', title = '';
            if (hasKeys.length == 0) {
                info = getString("info-hasNot") + " AES ARS " + getString("prefs-table-secretKey") + "\n" + getString("info-Confirm") + getString("info-addNewCryKey") + "?";
                title = getString("info-addNewCryKey");
            } else if (hasKeys.length == 3) {
                info = getString("info-hasAllKey") + "\n" + getString("info-Confirm") + getString("info-replaceOldKey") + "\n" + getString("info-decrypThenEncrypt");
                title = getString("info-replaceOldKey");
            } else {
                info += getString("info-has") + ":";
                if (hasKeys.includes("PUBLICKEY_NAME")) {
                    info += (getString("info-hasPublicKey") + ' ');
                }
                if (hasKeys.includes("PRIVATEKEY_NAME")) {
                    info += getString("info-privateKey") + ' ';
                }
                if (hasKeys.includes("AESCBCKEY_NAME")) {
                    info += getString("info-AESKey");
                }
                info += ("\n" + getString("info-Confirm") + getString("info-replaceOldKey") + "\n" + getString("info-decrypThenEncrypt"));
                title = getString("info-replaceOldKey");
            }

            const promptService = getPS();
            const replace = promptService.confirm(window, title, info,);
            return replace;
        }
        return hasKeys;
    }

    static async importCryKey(filePaths: string[] = []) {
        if (filePaths.length != 3) return;
        showInfo("TODO");

    }

    static async addCryKey() {
        const path = await chooseDirOrFilePath(true, addonDatabaseDir);
        if (!path) return;

        const files = await collectFilesRecursive(path);
        if (files && files.length) {
            // 是否导入原有秘钥
            const filesName = files.map(e => e.name);
            const promptService = getPS();
            const title = getString("info-addOldCryKey");
            const info = getString("info-has") + filesName.join(', ') + "\n" + getString("info-Confirm") + getString("info-addOldCryKey") + "?";
            let confirm = promptService.confirm(window, title, info);
            if (confirm) {
                const filePaths = files.map(e => e.path);
                let info = filePaths.join('\n');
                const title = "Check FilePaths";
                confirm = promptService.confirm(window, title, info);
                if (!confirm) {
                    const fs = await chooseDirOrFilePath(false, path);
                    info = fs.join('\n');
                    confirm = promptService.confirm(window, title, info);
                    if (!confirm) {
                        showInfo(getString('info-cancle') + ': ' + getString("info-addOldCryKey"));
                        return;
                    }
                }
                Cry.importCryKey(filePaths);
                return;
            } else {
                showInfo("create new AES RSA keys");
            }
        }

        const keyPair = await Cry.getRSAKeyPair();
        const publicKey = await Cry.exportKey(keyPair.publicKey);
        const privateKey = await Cry.exportKey(keyPair.privateKey);
        const keyName = KEYS_NAME["PRIVATEKEY_NAME"];
        // 公钥私钥 AES 秘钥三者保存在用户指定的同一目录下

        const pathSSH = await ensureNonePath(PathUtils.join(path, keyName));
        await Cry.saveKey(publicKey, pathSSH + ".pub");
        await Cry.saveKey(privateKey, pathSSH);
        const AESKey = await Cry.getAESKey();
        ///const AESKeyArrayBuffer = await window.crypto.subtle.exportKey("raw", AESKey);
        const AESKeyWraped = await window.crypto.subtle.wrapKey("raw", AESKey, keyPair.publicKey, { name: "RSA-OAEP" });
        const AESKeyWrapedUnit8Array = new Uint8Array(AESKeyWraped);
        const pathAES = await ensureNonePath(PathUtils.join(path, "AESCBCWraped"));
        await Cry.saveKey(AESKeyWrapedUnit8Array, pathAES);
        //公钥读取后留在程序中随时用来加密
        addon.mountPoint["crypto"] = {
            publicKey: publicKey,
            path: path,
            fileName: keyName,
        };
        const DB = await getDB();
        await DB.executeTransaction(async () => {
            //保存参数到数据库
            let sql = `SELECT value from settings WHERE key = 'cryptoKeyPath'`;
            const value = await DB.valueQueryAsync(sql);
            if (value && path == value) return;
            if (value) {
                sql = `UPDATE settings SET value = '${path}' WHERE key = 'cryptoKeyPath'`;
            } else {
                sql = `INSERT INTO settings (setting,key,value) VALUES ('addon','cryptoKeyPath','${path}')`;
            }
            await DB.queryAsync(sql);
        });
    }



    static async getCryKeyPath() {

        const DB = await getDB();
        const sql = `SELECT value from settings WHERE key = 'cryptoKeyPath'`;
        const path = await DB.valueQueryAsync(sql);
        return path;
    }
    // todo 更换 SSHKEY 密钥轮换 保留旧秘钥解码相应密文
    //RSA算法，在使用OAEP填充模式时，每次最多只能加密190字节。
    //非对称密钥加解密的性能相对于对称密钥，差了很多，在这实际的业务流加解密中，无法进行业务落地。
    //因此在实际的工程化上，一般使用非对称密钥进行数据密钥的协商与交换，而使用数据密钥与对称加密算法进行数据流的加解密保护。

}


/**
 * - 返回 json 字符串
 * - 含有：
 * - encryptAESString
 * - signatureString
 * - decryptAlgorithm
 * - ivString
 * - wrapedKeyString
 * - wrapedsignKeyString
 * @param text 
 * @returns 
 */
export const encryptAES = async (text: string = "Hello, world!") => {
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
    const wrapedKey = await Cry.getKey("AESCBC") as Uint8Array;//wrapedKey可以是储存的和当前包裹的key
    const wrapedsignKey = await window.crypto.subtle.wrapKey("raw", signKey, publicKey, { name: "RSA-OAEP" });
    const wrapedsignKeyString = arrayBufferTOstring(wrapedsignKey);
    const wrapedKeyString = arrayBufferTOstring(wrapedKey.buffer);
    const decryptAlgorithm = { name: 'AES-CBC' };
    const ivString = arrayBufferTOstring(iv);//向量转字符串
    const encryptAESInfo = {
        encryptAESString,
        signatureString,
        decryptAlgorithm,
        ivString,
        wrapedKeyString,
        wrapedsignKeyString
    };
    return JSON.stringify(encryptAESInfo);
};

/**
 * - 字符串参数至少含有密文和向量
 * - 其他参数参见 {@link EncryptAESInfo}
 * @param encryptAESInfoString 
 * @returns 
 */
export const decryptAES = async (encryptAESInfoString?: string) => {
    //encryptAESInfoString = await encryptAES();
    if (!encryptAESInfoString) return;
    const encryptAESInfo = JSON.parse(encryptAESInfoString!);    //@ts-ignore XXX
    if (!encryptAESInfo.ivString) return;
    Object.keys(encryptAESInfo).forEach(key => { if (typeof encryptAESInfo[key] == "string") { encryptAESInfo[key] = stringToArrayBuffer(encryptAESInfo[key]); } });
    //const iv=stringToArrayBuffer(encryptAESInfo.ivString)
    const privateKey = await Cry.getKey("privateKey") as CryptoKey;
    const algorithmVerify = { name: 'HMAC', hash: { name: 'SHA-256' } };
    // 签名验证
    if (encryptAESInfo.wrapedsignKeyString) {
        const signingKey = await window.crypto.subtle.unwrapKey(
            "raw",
            encryptAESInfo.wrapedsignKeyString,
            privateKey,
            { name: "RSA-OAEP" },
            algorithmVerify,
            true,
            ['sign', 'verify']);

        const verified = await window.crypto.subtle.verify(algorithmVerify, signingKey, encryptAESInfo.signatureString, encryptAESInfo.encryptAESString);

        if (!verified) {
            throw new Error("Can't verify message");
        }
    }
    let key;
    if (encryptAESInfo.wrapedKeyString) {
        key = await window.crypto.subtle.unwrapKey(
            "raw",
            encryptAESInfo.wrapedKeyString,
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
    const deBuffer = await window.crypto.subtle.decrypt(algorithm, key, encryptAESInfo.encryptAESString);
    if (!deBuffer) {
        showInfo("Decrypt Failure");
        return;
    }
    showInfo(["decryptContent:", arrayBufferTOstring(deBuffer)]);
};


export async function testCryInfo(info: string) {
    const cryedInfo = await encryptAES(info);
    if (!cryedInfo) return;
    const cryedInfoJSON = JSON.parse(cryedInfo);
    showInfo(cryedInfoJSON.encryptAESString);
}
export async function testCry() {

    //保存秘钥对
    const keyPair = await Cry.getRSAKeyPair();
    const publicKey = await Cry.exportKey(keyPair.publicKey);
    const privateKey = await Cry.exportKey(keyPair.privateKey);
    const keyName = "ssh-keyTest";
    let path = PathUtils.join(await chooseDirOrFilePath(), keyName);
    path = await ensureNonePath(path);
    await Cry.saveKey(publicKey, path + ".pub");
    await Cry.saveKey(privateKey, path);

    const rawKeyprivateKey = await Cry.importKey(privateKey);
    const rawKeypublicKey = await Cry.importKey(publicKey);
    const text = "加密解密流程测试";

    const encryptedData = await Cry.encryptRSA(keyPair.publicKey, text);
    //ArrayBuffer形式密文转为string以便传送，
    //不使用 TextDecoder，因为转出的字符串无法被 TextEncoder 还原成原来的 Uint8Array
    const sendString = uint8ArrayToString(new Uint8Array(encryptedData));
    const restoreUint8Array = stringToUint8Array(sendString);
    const decryptedText = await Cry.decryptRSA(rawKeyprivateKey, restoreUint8Array);//Uint8Array或ArrayBuffer均可
    showInfo(["source:", text]);
    showInfo(["decryptedText:", decryptedText]);


    const test = "test";



}

