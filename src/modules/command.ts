import { getString } from "../utils/locale";
import { showInfo } from "../utils/tools";
import { Cry, decryptAll, decryptAllAccount, decryptAllFiles, deleteRecords } from "./crypto";
import { getDB, getDBSync } from "./database/database";
import { modifyData } from "./ui/dataDialog";
import { getDom, } from "./ui/uiTools";

export class Command {
    static async customKeysFileName(KEYS_NAME?: KEYSNAME) {
        if (!KEYS_NAME) {
            KEYS_NAME = await Cry.getKEYS_NAME();
        }
        const win = addon.data.prefs?.window;
        const data = await modifyData(KEYS_NAME, win);
        if (!data) return;
        await Cry.setKEYS_NAME(data);
        return data;
    }

    static async openCryptoDirectory() {
        const path = await Cry.getPathCryKey();
        await Zotero.File.reveal(path);
    }

    // 打开面板时传入的参数用来设置按钮黄复选框是否显示，同时禁止弹窗
    static async showHiddenEncryptDom(checked?: boolean, onOpenPrefs: boolean = false) {
        const enableEncrypt = getDom('setEnableEncrypt') as XUL.Checkbox;
        const win = enableEncrypt.ownerDocument.defaultView;
        if (!enableEncrypt) return;
        //const idsufix=['deleSourceFile','updateCryptoKey','addOldCryKey','customKeysFileName']

        const deleSourceFile = getDom('deleSourceFile') as XUL.Checkbox;
        const updateCryptoKey = getDom('updateCryptoKey') as XUL.Button;
        const addOldCryKey = getDom('addOldCryKey') as XUL.Button;
        const customKeysFileName = getDom('customKeysFileName') as XUL.Button;
        const labelRun = getDom('cryptoProtectRun') as XUL.Label;
        const openCryptoDirectory = getDom('openCryptoDirectory') as XUL.Button;


        if (checked !== void 0 && checked !== null) enableEncrypt.checked = checked;
        if (!enableEncrypt.checked) {
            if (!onOpenPrefs) {
                win?.alert(getString("info-disableEncrypt"));
                const confirm = win?.confirm(getString("info-Confirm") + "?" + "\n\n" + getString("info-disableEncrypt"));
                if (!confirm) {
                    enableEncrypt.checked = true;
                    return;
                }
            }
            updateCryptoKey.hidden = true;
            addOldCryKey.hidden = true;
            deleSourceFile.hidden = true;
            customKeysFileName.hidden = true;
            labelRun.hidden = true;
            openCryptoDirectory.hidden = true;
        } else {
            if (!onOpenPrefs) {
                win?.alert(getString('info-encryptTip') + "\n" + getString('info-encryptTip1') + "\n" + getString('info-encryptTip2') + "\n" + getString('info-encryptTip3'));
                const confirm = win?.confirm(getString("info-Confirm") + "?\n" + getString("info-enableEncrypt") + "?");
                if (!confirm) {
                    enableEncrypt.checked = false;
                    return;
                }
            }
            updateCryptoKey.hidden = false;
            addOldCryKey.hidden = false;
            deleSourceFile.hidden = false;
            customKeysFileName.hidden = false;
            labelRun.hidden = false;
            openCryptoDirectory.hidden = false;
        }
        Command.checkEnableEncrypt();

    }
    static async checkEnableEncrypt() {
        const enableEncrypt = getDom('setEnableEncrypt') as XUL.Checkbox;
        const deleSourceFile = getDom('deleSourceFile') as XUL.Checkbox;
        if (!enableEncrypt) return;
        if (!enableEncrypt.checked) {
            await decryptAll();
        } else {
            const validKeys = await Cry.checkCryKey();
            if (await Cry.replaceConfirm(validKeys)) {
                await Cry.importCryptoKey();
            } else {
                await Cry.createCryKey();
            }
        }
        //更新本插件数据库中的加密设置项
        const DB = getDBSync();
        await DB.executeTransaction(async () => {
            await updateDBSettings(enableEncrypt.checked, 'enableEncrypt');
            await updateDBSettings(deleSourceFile.checked, 'deleSourceFile');
        });

        async function updateDBSettings(elementChecked: boolean, key: string) {
            const sqlSELECT = `SELECT value FROM settings WHERE setting='addon' AND key='${key}'`;
            const dbValue = await DB.valueQueryAsync(sqlSELECT);
            const sqlINSERT = `INSERT INTO settings (setting,key,value) VALUES ('addon','${key}',${elementChecked})`;
            const sqlUPDATE = `UPDATE settings SET value = ${elementChecked} WHERE key = '${key}'`;
            if (dbValue === false) {
                await DB.queryAsync(sqlINSERT);
            } else {
                if (dbValue == elementChecked) return;
                await DB.queryAsync(sqlUPDATE);
            }
        }

    }
}