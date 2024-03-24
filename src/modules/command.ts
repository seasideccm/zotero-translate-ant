import { getString } from "../utils/locale";
import { chooseDirOrFilePath, confirmWin, getPS } from "../utils/tools";
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

    // 打开面板时传入的参数用来设置按钮黄复选框是否显示，同时禁止弹窗
    static async showHiddenEncryptDom(checked?: boolean) {
        const enableEncrypt = getDom('setEnableEncrypt') as XUL.Checkbox;
        if (!enableEncrypt) return;
        const win = enableEncrypt.ownerDocument.defaultView;


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
            setHiddenState(true);
        } else {
            if (!onOpenPrefs) {
                win?.alert(getString('info-encryptTip') + "\n" + getString('info-encryptTip1') + "\n" + getString('info-encryptTip2') + "\n" + getString('info-encryptTip3'));
                const confirm = win?.confirm(getString("info-Confirm") + "?\n" + getString("info-enableEncrypt") + "?");
                if (!confirm) {
                    enableEncrypt.checked = false;
                    return;
                }
            }
            setHiddenState(false);
        }
        Command.checkEnableEncrypt(onOpenPrefs);
    }
    static async checkEnableEncrypt(onOpenPrefs: boolean = false) {
        const state = await encryptState();
        const enableEncrypt = getDom('setEnableEncrypt') as XUL.Checkbox;
        const deleSourceFile = getDom('deleSourceFile') as XUL.Checkbox;
        if (!enableEncrypt) return;
        if (!enableEncrypt.checked) {
            if (!onOpenPrefs) await decryptAll();
        } else {
            const validKeys = await Cry.checkCryKey();//没有有效秘钥，或 RSA 公钥私钥
            if (!validKeys?.length) {
                const info = getString("into-cryptoDir") + ", " + getString("info-hasNot") + " ARS " + getString("prefs-table-secretKey") + ", " + getString("info-disableCrypto");
                const title = getString("info-multiSelect");
                const opt1 = getString("info-openDirectory");
                const opt2 = getString("info-addOldCryKey");
                const opt3 = getString('info-selectRSADirectory');
                const opt4 = getString("info-createRSAKeys");

                const win = addon.data.prefs?.window;
                const options = [opt1, opt2, opt3, opt4];
                const selectResult: any = {};
                const promptService = getPS();
                const cf = promptService.select(win, title, info, options, selectResult);
                if (!cf) {
                    return;
                } else {
                    switch (selectResult.value) {
                        case 0:
                            await Command.openCryptoDirectory();
                            break;
                        case 1:
                            await Cry.importCryptoKey();
                            break;
                        case 2:
                            await Command.selectRSADirectory();
                            break;
                        case 3:
                            await Cry.createCryKey();
                            break;
                        default:
                            return;
                    }
                }
            }
        }
        //更新本插件数据库中的加密设置项
        await setEncryptState(enableEncrypt.checked);
        await setDeleSourceFileState(deleSourceFile.checked);
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
        await updateDBSettings(state, 'deleSourceFile', DB);
    });
}

export function setHiddenState(state: boolean) {
    const idsufixs = ['setEnableEncrypt', 'deleSourceFile', 'updateCryptoKey', 'addOldCryKey', 'customKeysFileName', 'cryptoProtectRun', "openCryptoDirectory", "selectRSADirectory"];
    idsufixs.forEach(idsufix => {
        const domItem = getDom(idsufix) as HTMLElement;
        if (domItem) domItem.hidden = state;
    });
}