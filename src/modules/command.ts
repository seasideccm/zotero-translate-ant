import { getString } from "../utils/locale";
import { getPS, showInfo } from "../utils/tools";
import { Cry, decryptAllAccount, decryptAllFiles } from "./crypto";
import { getDB } from "./database/database";
import { getDom, makeId } from "./ui/uiTools";

export class Command {
    static async checkSetEnableEncrypt() {
        const win = addon.data.prefs?.window;
        const doc = addon.data.prefs?.window.document;
        if (!win || !doc) return;
        const enableEncrypt = getDom('setEnableEncrypt') as XUL.Checkbox;
        const deleSourceFile = getDom('deleSourceFile') as XUL.Checkbox;
        const addNewCryKey = getDom('addNewCryKey') as XUL.Button;
        const addOldCryKey = getDom('addOldCryKey') as XUL.Button;
        if (!enableEncrypt.checked) {
            addNewCryKey.hidden = true;
            addOldCryKey.hidden = true;
            deleSourceFile.hidden = true;
            win.alert(getString("info-disableEncrypt"));
            await decryptAllAccount();
            await decryptAllFiles();
            win.alert(getString("info-finishedDecrypt"));

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

        const DB = await getDB();
        const enableEncryptDBValue = await DB.valueQueryAsync(
            "SELECT value FROM settings WHERE setting='addon' AND key='enableEncrypt'",
        );
        const deleSourceFileDBValue = await DB.valueQueryAsync(
            "SELECT value FROM settings WHERE setting='addon' AND key='deleSourceFile'",
        );
        if (enableEncrypt.checked != enableEncryptDBValue) {


        }
        if (deleSourceFile.checked != deleSourceFileDBValue) {

        }
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
}