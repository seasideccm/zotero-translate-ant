import { getString } from "../utils/locale";
import { showInfo } from "../utils/tools";
import { Cry, decryptAllAccount, decryptAllFiles } from "./crypto";
import { getDBSync } from "./database/database";
import { modifyData } from "./ui/dataDialog";
import { getDom, } from "./ui/uiTools";

export class Command {
    static async customKeysFileName() {
        const KEYS_NAME = await Cry.getKEYS_NAME();
        const data = modifyData(KEYS_NAME);
        if (!data) return;
        await Cry.setKEYS_NAME(data);
        return data;
    }

    // 打开面板时传入的参数用来设置按钮黄复选框是否显示，同时禁止弹窗
    static async showHiddenEncryptDom(checked?: boolean, onOpenPrefs: boolean = false) {
        const enableEncrypt = getDom('setEnableEncrypt') as XUL.Checkbox;
        const win = enableEncrypt.ownerDocument.defaultView;
        if (!enableEncrypt) return;
        //const idsufix=['deleSourceFile','addNewCryKey','addOldCryKey','customKeysFileName']

        const deleSourceFile = getDom('deleSourceFile') as XUL.Checkbox;
        const addNewCryKey = getDom('addNewCryKey') as XUL.Button;
        const addOldCryKey = getDom('addOldCryKey') as XUL.Button;
        const customKeysFileName = getDom('customKeysFileName') as XUL.Button;
        const labelRun = getDom('cryptoProtectRun') as XUL.Label;


        if (checked !== void 0 && checked !== null) enableEncrypt.checked = checked;
        if (!enableEncrypt.checked) {
            if (!onOpenPrefs) {
                win?.alert(getString("info-disableEncrypt"));
                const confirm = win?.confirm(getString("info-disableEncrypt") + "\n" + getString("info-Confirm") + "?");
                if (!confirm) {
                    enableEncrypt.checked = true;
                    return;
                }
            }
            addNewCryKey.hidden = true;
            addOldCryKey.hidden = true;
            deleSourceFile.hidden = true;
            customKeysFileName.hidden = true;
            labelRun.hidden = true;
        } else {
            if (!onOpenPrefs) {
                win?.alert(getString('info-encryptTip'));
                const confirm = win?.confirm(getString("info-Confirm") + "?\n" + getString("info-enableEncrypt") + "?");
                if (!confirm) {
                    enableEncrypt.checked = false;
                    return;
                }
            }
            addNewCryKey.hidden = false;
            addOldCryKey.hidden = false;
            deleSourceFile.hidden = false;
            customKeysFileName.hidden = false;
            labelRun.hidden = false;
        }
        Command.checkStateEnableEncrypt();

    }
    static async checkStateEnableEncrypt() {
        const enableEncrypt = getDom('setEnableEncrypt') as XUL.Checkbox;
        const deleSourceFile = getDom('deleSourceFile') as XUL.Checkbox;
        const win = enableEncrypt.ownerDocument.defaultView;
        if (!enableEncrypt || !win || !deleSourceFile) return;
        if (!enableEncrypt.checked) {
            const numberAccount = await decryptAllAccount();
            let numbers = await decryptAllFiles();
            if (numberAccount != void 0) numbers = numberAccount.length + (numbers || 0);
            if (numbers) showInfo(getString("info-finishedDecrypt"));
        } else {
            const validKeys = await Cry.checkCryKey();
            await Cry.replaceConfirm(validKeys) && await Cry.addCryKey();
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