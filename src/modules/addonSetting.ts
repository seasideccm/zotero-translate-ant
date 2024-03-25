import { arrayUtils, getFiles, showInfo } from "../utils/tools";
import { Cry, deleteRecords, isRSAKey } from "./crypto";
import { getDB } from './database/database';
import { getElementValueByElement } from "./ui/uiTools";


export async function addonSetting() {
    const doc = addon.data.prefs?.window.document;
    if (!doc) return;
    //元素 id 包含 "-setting-"
    const settingItems = doc.querySelectorAll('[id*="-setting-"]');
    showInfo(`插件 prefs 面板中id 包含 "-setting-" 的元素数量：` + settingItems.length.toString());
    const keys = [];
    for (const item of Array.from(settingItems)) {
        const match = item.id.match(/-setting-(.*)/);
        if (match) keys.push(match[1]);
    }
    if (!addon.mountPoint.settings) addon.mountPoint.settings = {};
    const settings = addon.mountPoint.settings;
    const oldKeys = Object.keys(settings);
    if (!arrayUtils.isDiffer(keys, oldKeys)) return;    // 判断插件面板是否有新增设置项目
    await setAddon(keys);

}

/**
 * - 从数据库读取插件设置参数
 * - 写入addon.mountPoint.settings中
 * - 新增设置项目写入数据库
 * @param keys 
 * @returns 
 */
async function setAddon(keys: string[]) {
    const doc = addon.data.prefs?.window.document;
    if (!doc) return;
    const DB = await getDB();
    const settings = addon.mountPoint.settings;
    const newSettings: string[] = [];
    DB.executeTransaction(async () => {
        for (const key of keys) {
            const sql = "SELECT value FROM settings WHERE key='" + key + "'";
            const value = await DB.valueQueryAsync(sql);
            if (!value) {
                newSettings.push(key);
                continue;
            }
            if (settings[key] && settings[key] == value) continue;
            settings[key] = value;
        }
    });
    DB.executeTransaction(async () => {
        for (const key of newSettings) {
            const settingItem = doc.querySelector(`[id$="-setting-${key}"]`);
            if (!settingItem) continue;
            const value = getElementValueByElement(settingItem);
            if (!value) {
                showInfo("请检查取值自元素的哪个属性");
                continue;
            }
            //VALUES的类型是文本
            //布尔值会出错，sqlite 参数解析非数组不考虑布尔值
            try {
                await DB.queryAsync(
                    `INSERT INTO settings (setting, key, value) VALUES ('addon', '${key}', ?)`,
                    typeof value == "boolean" ? Number(value) : value
                );
                settings[key] = value;
            } catch (e: any) {
                const message = e.message;
                if (message) showInfo(e.message);
                throw e;
            }
        }
    });

}


export async function setSettingsValue(queryValue: string, setValue: string) {
    const DB = await getDB();
    const values = [];
    let sql = `SELECT value from settings WHERE key = '${queryValue}'`;
    const result = await DB.valueQueryAsync(sql);
    if (result && result == setValue) return;
    await DB.executeTransaction(async () => {
        result ? sql = `UPDATE settings SET value = '${setValue}' WHERE key = '${queryValue}'`
            : sql = `INSERT INTO settings (setting,key,value) VALUES ('addon','${queryValue}','${setValue}')`;
        await DB.queryAsync(sql);
    });
}

export async function clearSettingsRecord(queryValue: string | string[]) {
    if (!Array.isArray(queryValue)) queryValue = [queryValue];
    const DB = await getDB();
    await DB.executeTransaction(async () => {
        for (const value of queryValue) {
            const sql = `DELETE FROM settings WHERE key = '${value}'`;
            await DB.queryAsync(sql);
        }
    });

}

export async function verifyKeyMD5(path: string) {
    if (!await IOUtils.exists(path)) return;
    const keysMD5 = await getRSAMD5();
    if (!keysMD5?.length) return;
    const temp = await getFiles(path);//不含子文件夹    
    const keyPaths: string[] = [];
    for (const path of temp) {
        const md5 = await Zotero.Utilities.Internal.md5Async(path);
        if (!keyPaths.includes(path) && await isRSAKey(path) && keysMD5.includes(md5)) {
            keyPaths.push(path);
        }
    }
    if (keyPaths.length == keysMD5.length) {
        return keyPaths;//所需元素均已包含才能返回
    }
}

export async function getRSAMD5() {
    const DB = await getDB();
    const keysmd5 = [];
    const keyValues = ['publicKeyMD5', 'privateKeyMD5'];
    for (const value of keyValues) {
        const sql = `SELECT value from settings WHERE key = '${value}'`;
        const md5 = await DB.valueQueryAsync(sql) as string;
        if (!md5) return;
        keysmd5.push(md5);
    }
    if (keysmd5.length == keyValues.length) return keysmd5;


}