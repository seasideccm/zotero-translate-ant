import { getString } from "../utils/locale";
import { showInfo } from "../utils/tools";
import { Cry, decryptAllAccount, decryptAllFiles } from "./crypto";
import { getDBSync } from "./database/database";
import { getDom, } from "./ui/uiTools";

export class Command {
    static async setEnableEncrypt() {
        Command.showHiddenEncryptDom();
        Command.checkSetEnableEncrypt();
    }

    static async showHiddenEncryptDom(isEncrypt?: boolean) {
        const enableEncrypt = getDom('setEnableEncrypt') as XUL.Checkbox;
        if (!enableEncrypt) return;
        const deleSourceFile = getDom('deleSourceFile') as XUL.Checkbox;
        const addNewCryKey = getDom('addNewCryKey') as XUL.Button;
        const addOldCryKey = getDom('addOldCryKey') as XUL.Button;
        if (isEncrypt !== void 0 && isEncrypt !== null) enableEncrypt.checked = isEncrypt;
        if (!enableEncrypt.checked) {
            addNewCryKey.hidden = true;
            addOldCryKey.hidden = true;
            deleSourceFile.hidden = true;
        } else {
            addNewCryKey.hidden = false;
            addOldCryKey.hidden = false;
            deleSourceFile.hidden = false;
        }

    }
    static async checkSetEnableEncrypt() {
        const enableEncrypt = getDom('setEnableEncrypt') as XUL.Checkbox;
        const deleSourceFile = getDom('deleSourceFile') as XUL.Checkbox;
        if (!enableEncrypt) return;
        const win = enableEncrypt.ownerDocument.defaultView;
        if (!win) return;
        if (!enableEncrypt.checked) {
            const confirm = win.confirm(getString("info-disableEncrypt"));
            if (!confirm) return;
            const numberAccount = await decryptAllAccount();
            let numbers = await decryptAllFiles();
            if (numberAccount != void 0) numbers = numberAccount.length + (numbers || 0);
            if (numbers) showInfo(getString("info-finishedDecrypt"));

        } else {
            showInfo(getString('info-encryptTip'));
            const result = await Cry.checkCryKey(true);
            if (result === true) await Cry.addCryKey();

        }
        const DB = getDBSync();
        await DB.executeTransaction(async () => {
            await updateDBSettings(enableEncrypt.checked, 'enableEncrypt');
            await updateDBSettings(deleSourceFile.checked, 'deleSourceFile');
        });
        async function updateDBSettings(elementChecked: boolean, key: string) {
            const sqlSELECT = `SELECT value FROM settings WHERE setting='addon' AND key='${key}'`;
            const dbValue = await DB.valueQueryAsync(sqlSELECT);
            const sqlINSERT = `INSERT INTO settings (setting,key,value) VALUES ('addon','${key}',${elementChecked})`;
            const sqlUPDATE = `UPDATE settings SET value = '${elementChecked}' WHERE key = '${key}'`;
            if (dbValue === false) {
                await DB.queryAsync(sqlINSERT);
            } else {
                if (dbValue == elementChecked) return;
                await DB.queryAsync(sqlUPDATE);
            }
        }

    }
    /* static async checkSetEnableEncryptold(isEncrypt?: boolean) {
        const win = addon.data.prefs?.window;
        const doc = addon.data.prefs?.window.document;
        if (!win || !doc) return;
        const enableEncrypt = getDom('setEnableEncrypt') as XUL.Checkbox;
        const deleSourceFile = getDom('deleSourceFile') as XUL.Checkbox;
        const addNewCryKey = getDom('addNewCryKey') as XUL.Button;
        const addOldCryKey = getDom('addOldCryKey') as XUL.Button;
        if (isEncrypt !== void 0 && isEncrypt !== null) enableEncrypt.checked = isEncrypt;
        if (!enableEncrypt.checked) {
            addNewCryKey.hidden = true;
            addOldCryKey.hidden = true;
            deleSourceFile.hidden = true;
            const confirm = win.confirm(getString("info-disableEncrypt"));
            if (!confirm) return;
            const numberAccount = await decryptAllAccount();
            let numbers = await decryptAllFiles();
            if (numberAccount != void 0) numbers = numberAccount.length + (numbers || 0);
            if (numbers) {
                showInfo(getString("info-finishedDecrypt"));
            }
        } else {
            showInfo(getString('info-encryptTip'));
            addNewCryKey.hidden = false;
            addOldCryKey.hidden = false;
            deleSourceFile.hidden = false;
            const result = await Cry.checkCryKey(true);
            if (result === true) {
                await Cry.addCryKey();
            }
        }
        const DB = getDBSync();
        await DB.executeTransaction(async () => {
            await updateDBSettings(enableEncrypt.checked, 'enableEncrypt');
            await updateDBSettings(deleSourceFile.checked, 'deleSourceFile');
        });
        async function updateDBSettings(elementChecked: boolean, key: string) {
            const sqlSELECT = `SELECT value FROM settings WHERE setting='addon' AND key='${key}'`;
            const dbValue = await DB.valueQueryAsync(sqlSELECT);
            const sqlINSERT = `INSERT INTO settings (setting,key,value) VALUES ('addon','${key}',${elementChecked})`;
            const sqlUPDATE = `UPDATE settings SET value = '${elementChecked}' WHERE key = '${key}'`;
            if (dbValue === false) {
                await DB.queryAsync(sqlINSERT);
            } else {
                if (dbValue == elementChecked) return;
                await DB.queryAsync(sqlUPDATE);
            }
        }

    } */
}