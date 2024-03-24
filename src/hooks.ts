import { config } from "../package.json";
import { DB, compareSQLUpdateDB, getDB } from "./modules/database/database";
import { registerNotifier } from "./modules/notify";
import { listenImageCallback } from "./modules/ocr/trigerOcr";
import { registerPrefs, registerPrefsScripts } from "./modules/preferenceScript";
import { translate } from "./modules/translate/translate";
import { initTranslateServices } from "./modules/translate/translateServices";
import { DataDialog } from "./modules/ui/dataDialog";
import { mountMenu } from "./modules/menu";
import { monitorImageItem } from "./modules/ui/monitorImageItem";
import { getString, initLocale } from "./utils/locale";
import {
  onShortcutPan,
  registerPrefsShortcut,
  registerShortcutsCache,
} from "./utils/shortcut";
import { showInfo } from "./utils/tools";
import { createZToolkit } from "./utils/ztoolkit";
import { Cry, encryptState } from "./modules/crypto";
import { Command } from "./modules/command";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);


  /* if (__env__ === "development") {
    // Keep in sync with the scripts/.mjs
    const loadDevToolWhen = `Plugin ${config.addonID} startup`;
    ztoolkit.log(loadDevToolWhen);
  } */

  initLocale();
  registerNotifier();
  //registerShortcuts();  
  registerPrefs();
  //失败
  registerPrefsShortcut();
  await onMainWindowLoad(window);
}

async function onMainWindowLoad(win: Window): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();
  win.addEventListener("mouseover", listenImageCallback, false);


  monitorImageItem();
  //XXX addon.mountPoint['TranslateServices'] = TranslateServices;
  registerShortcutsCache();
  showInfo(getString("startup-begin"));
  await getDB();
  if (__env__ === "production" && await encryptState()) {
    const condition = Services.prefs.getBoolPref('devtools.debugger.enabled') || Services.prefs.getBoolPref('devtools.debugger.remote-enabled');
    if (condition) {
      window.alert(getString("info-debugger"));
      return;
    }
  }
  await Cry.getKEYS_NAME();
  if (addon.data.env == "development") {
    await compareSQLUpdateDB();
  }
  await initTranslateServices();
  mountMenu();
  translate();
}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  window.removeEventListener("mouseover", listenImageCallback, false);
}

async function onShutdown(): Promise<void> {
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  if (addon.mountPoint.database) {
    await (addon.mountPoint.database as DB).closeDatabase();
  }
  // Remove addon object
  addon.data.alive = false;
  delete Zotero[config.addonInstance];
}


/**
 * This function is just an example of dispatcher for Preference UI events.
 * Any operations should be placed in a function to keep this funcion clear.
 * @param type event type
 * @param data event data
 */
async function onPrefsEvent(type: string, data: { [key: string]: any; }) {
  switch (type) {
    case "load":
      await registerPrefsScripts(data.window);
      break;
    case "shortcut":
      onShortcutPan();
      showInfo(data.str);
      break;
    default:
      return;
  }
}

async function onCommand(cmd: string) {
  switch (cmd) {
    case "cmd_setEnableEncrypt":
      await Command.showHiddenEncryptDom();
      break;
    case "cmd_customKeysFileName":
      await Command.customKeysFileName();
      break;

    case "cmd_openCryptoDirectory":
      await Command.openCryptoDirectory();
      break;
    case "cmd_selectRSADirectory":
      await Command.selectRSADirectory();
      break;

    default:
      return;
  }
}

function onShortcuts(type: string) {
  switch (type) {
    case "larger":
      () => { };
      break;
    case "smaller":
      () => { };
      break;
    default:
      break;
  }
}

function onDialogEvents(type: string) {
  switch (type) {
    default:
      break;
  }
}

// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintain.
async function onOpenDataDialog(win: Window) {
  await DataDialog.onOpenDataDialog(win);
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onPrefsEvent,
  onShortcuts,
  onDialogEvents,
  onOpenDataDialog,
  onCommand,
};
