import { arrayDiffer, showInfo } from "../utils/tools";
import { Cry } from "./crypto";
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
    if (!arrayDiffer(keys, oldKeys)) return;    // 判断插件面板是否有新增设置项目
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
