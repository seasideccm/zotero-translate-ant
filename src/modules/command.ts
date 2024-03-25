import { getString } from "../utils/locale";
import { chooseDirOrFilePath, confirmWin, getPS, showInfo, showThrowInfo } from "../utils/tools";
import { clearSettingsRecord, setSettingsValue, verifyKeyMD5 } from "./addonSetting";
import { Cry, decryptAll, encryptState, getKeyNameByContent } from "./crypto";
import { DB, getDBSync } from "./database/database";
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

    static async selectRSADirectory() {
        const directory = await chooseDirOrFilePath(
            "dir",
            await Cry.getPathCryKey(),
            getString("info-selectRSADirectory")
        );
        if (!directory) return;
        const keyPaths = await verifyKeyMD5(directory);
        if (!keyPaths?.length) {
            const win = addon.data.prefs?.window;
            win?.focus();
            confirmWin(getString("info-noRSAKeys") + getString("info-retry"), "win");
            const domItem = getDom("selectRSADirectory") as HTMLElement;
            if (domItem) {
                domItem.style.backgroundColor = "red";
                domItem.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "start",
                });
            }

            return;
        }
        const domItem = getDom("selectRSADirectory") as HTMLElement;
        if (domItem) domItem.style.backgroundColor = "";
        const mapDBPath = {
            PUBLICKEY_NAME: "publicKeyPath",
            PRIVATEKEY_NAME: "privateKeyPath",
        };
        const KEYS_NAME = await Cry.getKEYS_NAME();
        for (const keyPath of keyPaths) {
            const keyName = await getKeyNameByContent(keyPath) as "PUBLICKEY_NAME" | "PRIVATEKEY_NAME";
            if (!keyName) return;
            KEYS_NAME[keyName] = PathUtils.filename(keyPath);
            const queryValue = mapDBPath[keyName];
            await setSettingsValue(queryValue, keyPath);
        }
        await setSettingsValue('cryptoKeyPath', directory);
        await Cry.setKEYS_NAME(KEYS_NAME);
    }

    static async showHiddenEncryptDom() {
        const enableEncrypt = getDom('setEnableEncrypt') as XUL.Checkbox;
        Command.approveChange(enableEncrypt);
        await Command.checkEnableEncrypt();
        await setHiddenState(enableEncrypt.checked);
    }
    static approveChange(element: XUL.Checkbox) {
        const win = element.ownerDocument.defaultView;
        let info1, info2;
        const checked = element.checked;
        if (!checked) {
            info1 = getString("info-disableEncrypt");
            info2 = getString("info-Confirm") + "?" + "\n\n" + getString("info-disableEncrypt");
        } else {
            info1 = getString('info-encryptTip') + "\n" + getString('info-encryptTip1') + "\n" + getString('info-encryptTip2') + "\n" + getString('info-encryptTip3');
            info2 = getString("info-Confirm") + "?\n" + getString("info-enableEncrypt") + "?";

        }
        win?.alert(info1);
        const confirm = win?.confirm(info2);
        if (!confirm) {
            element.checked = !checked;
            info1 = getString("info-userCancle");
            showInfo(info1);
            throw info1;
        }
    }
    static async checkEnableEncrypt() {
        const state = await encryptState();
        const enableEncrypt = getDom('setEnableEncrypt') as XUL.Checkbox;
        const deleteSourceFile = getDom('deleteSourceFile') as XUL.Checkbox;
        const checked = enableEncrypt.checked;
        if (checked == state) return;
        if (!checked) {
            await decryptAll(true);
        } else {
            const validKeys = await Cry.checkCryKey();//要么没有有效秘钥，要么 RSA 公钥私钥均有效
            if (!validKeys?.length) {
                const info = getString("info-hasNot") + " ARS " + getString("prefs-table-secretKey") + ", " + getString("info-disableCrypto");
                const title = getString("info-multiSelect");
                const opt1 = getString("info-createRSAKeys");
                const opt2 = getString("info-addOldCryKey");
                const opt3 = getString('info-selectRSADirectory');
                const opt4 = getString("info-openDirectory");
                const win = addon.data.prefs?.window;
                const options = [opt1, opt2, opt3, opt4];
                const selectResult: any = {};
                const promptService = getPS();
                const cf = promptService.select(win, title, info, options, selectResult);
                if (!cf) {
                    enableEncrypt.checked = !checked;
                    const info1 = getString("info-userCancle");
                    showInfo(info1);
                    throw info1;
                } else {
                    switch (selectResult.value) {
                        case 0:
                            await Cry.createCryKey();
                            break;
                        case 1:
                            await Cry.importCryptoKey();
                            break;
                        case 2:
                            await Command.selectRSADirectory();
                            break;
                        case 3:
                            try {
                                await Command.openCryptoDirectory();
                            } catch (e: any) {
                                enableEncrypt.checked = !checked;
                                showInfo(getString("info-noDir"));
                                throw e;
                            }
                            break;
                        default:
                            return;
                    }
                }
            }
        }
        //更新本插件数据库中的加密设置项
        const validKeys = await Cry.checkCryKey();
        if (!validKeys?.length) {
            enableEncrypt.checked = !checked;
            showThrowInfo("info-correct");
        }
        await setEncryptState(enableEncrypt.checked);
        await setDeleSourceFileState(deleteSourceFile.checked);
        addon.mountPoint?.tables["translateAnt-secretKeysTable"]?.treeInstance.invalidate();
        //render(); rerender()

    }
}

export async function updateDBSettings(elementChecked: boolean, key: string, DB: DB) {
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

export async function setEncryptState(state: boolean) {
    const DB = getDBSync();
    await DB.executeTransaction(async () => {
        await updateDBSettings(state, 'enableEncrypt', DB);
    });
    if (!state) {
        const cf = confirmWin(getString("info-clearCryptoRecord"));
        if (!cf) return;
        await clearSettingsRecord(["cryptoKeyPath", 'publicKeyMD5', 'privateKeyMD5', "cryptoKeysName", 'importDirectory']);
    }
}

async function setDeleSourceFileState(state: boolean) {
    const DB = getDBSync();
    await DB.executeTransaction(async () => {
        await updateDBSettings(state, 'deleteSourceFile', DB);
    });
}

export async function setHiddenState(state?: boolean) {
    if (!state) {
        state = await encryptState();
        const domItem = getDom('setEnableEncrypt') as XUL.Checkbox;
        if (domItem) domItem.checked = state;
    }
    //'setEnableEncrypt', 始终显示    
    const idsufixs = ['deleteSourceFile', 'updateCryptoKey', 'addOldCryKey', 'customKeysFileName', 'cryptoProtectRun', "openCryptoDirectory", "selectRSADirectory"];
    idsufixs.forEach(idsufix => {
        const domItem = getDom(idsufix) as HTMLElement;
        if (domItem) domItem.hidden = !state;//未启用加密则隐鲹其他按钮
    });
}