import { chooseDirOrFilePath, ensureNonePath, showInfo, stringToArrayBuffer, stringToUint8Array, uint8ArrayToString } from "./tools";
import { config } from "../../package.json";
import { addonDatabaseDir, addonStorageDir } from "./constant";
import { getString } from "./locale";
import { getDB } from "../modules/database/database";

export class Cry {

    static async encrypt(publicKey: any, data: any) {
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
    static async decrypt(privateKey: any, encryptedData: any) {
        const decryptedData = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP", },
            privateKey,
            encryptedData
        );
        return new TextDecoder().decode(decryptedData);
    }

    static async getKeyPair() {
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

        //公钥读取后留在程序中随时用来加密
        if (addon.mountPoint.crypto && type == "publicKey") {
            const key = addon.mountPoint.crypto[type];
            return await Cry.importKey(key);
        }
        let path;
        if (!addon.mountPoint.crypto) {
            path = await getCryKeyPath();
            path ? addon.mountPoint.crypto = { path: path } : await Cry.addCryKey();
        }
        path = addon.mountPoint.crypto.path;
        const SSHKEYName = `SSHKEY-${config.addonRef}`;
        if (type == "AESCBC") {
            path = PathUtils.join(path, "AESCBCWraped");
            let key;
            try {
                key = await IOUtils.read(path);
            } catch (e) {
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

        if (type == "publicKey") path = PathUtils.join(path, SSHKEYName + ".pub");
        if (type == 'privateKey') path = PathUtils.join(path, SSHKEYName);
        let key;
        try {
            key = await Zotero.File.getContentsAsync(path);
        } catch (e) {
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
        const wrapedKey: BufferSource = (await Cry.getKey("AESCBC"))!.buffer;
        const privateKey = await Cry.getKey("privateKey") as CryptoKey;
        const AESKey = await window.crypto.subtle.unwrapKey(
            "raw",
            wrapedKey,
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

        const encryptedData = await Cry.encrypt(Cry.getKey("publicKey"), value);
        return uint8ArrayToString(new Uint8Array(encryptedData));
    }
    static async decryptAccount(value: string) {
        //读取私钥，加密的对称秘钥
        const encryptedData = stringToUint8Array(value).buffer;
        return await Cry.decrypt(Cry.getKey("privateKey"), encryptedData);
    }


    static async addCryKey() {

        const keyPair = await Cry.getKeyPair();
        const publicKey = await Cry.exportKey(keyPair.publicKey);
        const privateKey = await Cry.exportKey(keyPair.privateKey);
        const keyName = `SSHKEY-${config.addonRef}`;
        // 公钥私钥 AES 秘钥三者保存在用户指定的同一目录下
        const path = await chooseDirOrFilePath(true, addonDatabaseDir);
        if (!path) return;
        const pathSSH = await ensureNonePath(PathUtils.join(path, keyName));
        await Cry.saveKey(publicKey, pathSSH + ".pub");
        await Cry.saveKey(privateKey, pathSSH);
        const AESKey = await Cry.getAESKey();
        const AESKeyArrayBuffer = await window.crypto.subtle.exportKey("raw", AESKey);
        const iv = window.crypto.getRandomValues(new Uint8Array(16));
        const AESKeyWraped = await window.crypto.subtle.wrapKey("raw", AESKey, keyPair.publicKey, { name: "RSA-OAEP" });
        const AESKeyWrapedUnit8Array = new Uint8Array(AESKeyWraped);
        const pathAES = await ensureNonePath(PathUtils.join(path, "AESCBCWraped"));
        await Cry.saveKey(AESKeyWrapedUnit8Array, pathAES);
        //保存参数到数据库
        addon.mountPoint["crypto"] = {
            publicKey: publicKey,
            path: path,
        };
        const DB = await getDB();
        await DB.executeTransaction(async () => {
            let sql = `SELECT value from settings WHERE key = 'cryptoKeyPath'`;
            const value = await DB.valueQueryAsync(sql);
            if (value && path == value) return;
            if (value) {
                sql = `UPDATE settings SET value = '${path}' WHERE key = 'cryptoKeyPath'`;
            } else {
                sql = `INSERT INTO settings (setting,key,value) VALUES ('addon','cryptoKeyPath','${path}')`;
            };
            await DB.queryAsync(sql);
        });
    }
    // todo 更换 SSHKEY 密钥轮换 保留旧秘钥解码相应密文
    //RSA算法，在使用OAEP填充模式时，每次最多只能加密190字节。
    //非对称密钥加解密的性能相对于对称密钥，差了很多，在这实际的业务流加解密中，无法进行业务落地。
    //因此在实际的工程化上，一般使用非对称密钥进行数据密钥的协商与交换，而使用数据密钥与对称加密算法进行数据流的加解密保护。

}

async function getCryKeyPath() {
    const DB = await getDB();
    const sql = `SELECT value from settings WHERE key = 'cryptoKeyPath'`;
    return await DB.valueQueryAsync(sql);
}