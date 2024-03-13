import { getString } from "../utils/locale";
import { getPS, showInfo } from "../utils/tools";
import { Cry } from "./crypto";
import { getDom, makeId } from "./ui/uiTools";

export class Command {
    static async setEnableEncrypt() {
        const doc = addon.data.prefs?.window.document;
        if (!doc) return;
        const enableEncrypt = getDom('setEnableEncrypt') as XUL.Checkbox;
        const addNewCryKey = getDom('addNewCryKey') as XUL.Button;
        const addOldCryKey = getDom('addOldCryKey') as XUL.Button;
        if (!enableEncrypt.checked) {
            addNewCryKey.hidden = true;
            addOldCryKey.hidden = true;
            addon.data.prefs?.window.alert(getString("info-disableEncrypt"));
            return;
        }
        showInfo(getString('info-encryptTip'));
        addNewCryKey.hidden = false;
        addOldCryKey.hidden = false;
        const result = await Cry.checkCryKey(true);
        if (result === true) {
            await Cry.addCryKey();
        }
    }
}