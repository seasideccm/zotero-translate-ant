import { chooseDirOrFilePath, ensureNonePath, showInfo, stringToArrayBuffer, stringToUint8Array, uint8ArrayToString } from "./tools";
import { config } from "../../package.json";

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
            ["encrypt", "decrypt"]
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
        let keyUsage: "decrypt" | "encrypt" = "decrypt";
        const type = pem.includes(PRIVATE) ? PRIVATE : PUBLIC;
        format = type == PRIVATE ? "pkcs8" : "spki";
        keyUsage = type == PRIVATE ? "decrypt" : "encrypt";
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
            [keyUsage],
        );
    }

    static async saveKey(key: any, path: string) {
        if (!key || !path || await IOUtils.exists(path)) { showInfo("not save"); return; }
        //btoa 字节转字母
        //const keyBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(key) as any));
        await IOUtils.writeUTF8(path, key);
        return path;
    }

    static async getSingleKey() {
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
    static async encryptSingleKey(data: BufferSource, secretKey: CryptoKey, iv: any) {
        return await window.crypto.subtle.encrypt(
            { name: 'AES-CBC', iv, },
            secretKey,
            data,
        );
    }

    static async decryptSingleKey(data: BufferSource, secretKey: CryptoKey, iv: Uint8Array) {
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

    wrapKey = window.crypto.subtle.wrapKey;
    unwrapKey = window.crypto.subtle.unwrapKey;


    static async getKey(type: "publicKey" | 'privateKey') {
        let key;
        if (addon.mountPoint.crypto && addon.mountPoint.crypto[type]) {
            key = addon.mountPoint.crypto[type];

        } else {
            let path;
            if (addon.mountPoint.crypto && addon.mountPoint.crypto.path) {
                path = addon.mountPoint.crypto.path;
            } else {
                await this.addAddonSSHKEY();
                path = addon.mountPoint.crypto.path;
            }

            path += type == "publicKey" ? ".pub" : "";
            key = await Zotero.File.getContentsAsync(path);
            addon.mountPoint.crypto[type] = key;
        }
        return await this.importKey(key);
    }
    static async encryptAccount(value: string) {
        const encryptedData = await this.encrypt(this.getKey("publicKey"), value);
        return uint8ArrayToString(new Uint8Array(encryptedData));
    }
    static async decryptAccount(value: string) {
        const encryptedData = stringToUint8Array(value).buffer;
        return await this.decrypt(this.getKey("privateKey"), encryptedData);
    }

    static async addAddonSSHKEY() {
        const keyPair = await this.getKeyPair();
        const publicKey = await this.exportKey(keyPair.publicKey);
        const privateKey = await this.exportKey(keyPair.privateKey);
        const keyName = `SSHKEY-${config.addonRef}`;
        let path = PathUtils.join(await chooseDirOrFilePath(), keyName);
        path = await ensureNonePath(path);
        await Cry.saveKey(publicKey, path + ".pub");
        await Cry.saveKey(privateKey, path);
        addon.mountPoint["crypto"] = {
            publicKey: publicKey,
            privateKey: privateKey,
            path: path,
        };
    }
    // todo 更换 SSHKEY 密钥轮换 保留旧秘钥解码相应密文
    //RSA算法，在使用OAEP填充模式时，每次最多只能加密190字节。
    //非对称密钥加解密的性能相对于对称密钥，差了很多，在这实际的业务流加解密中，无法进行业务落地。
    //因此在实际的工程化上，一般使用非对称密钥进行数据密钥的协商与交换，而使用数据密钥与对称加密算法进行数据流的加解密保护。

}

