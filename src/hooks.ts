import { config } from "../package.json";
import { compareSQLUpdateDB, getDB } from "./modules/database/database";
import { registerNotifier } from "./modules/notify";
import { listenImage, listenImageCallback } from "./modules/ocr/trigerOcr";
import {
  registerPrefs,
  registerPrefsScripts,
} from "./modules/preferenceScript";
import { Translator } from "./modules/translate/translate";
import { initTranslateServices } from "./modules/translate/translateServices";
import { DataDialog } from "./modules/ui/dataDialog";
import { mountMenu, rightClickMenuItem } from "./modules/menu";
import { monitorImageItem } from "./modules/ui/monitorImageItem";
import { getString, initLocale } from "./utils/locale";
import { onShortcutPan, registerPrefsShortcut } from "./utils/shortcut";
import { showInfo } from "./utils/tools";
import { createZToolkit } from "./utils/ztoolkit";
import { checkEncryptAccounts, encryptState } from "./modules/crypto";
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
  registerPrefs();
  await onMainWindowLoad(window);
}

async function onMainWindowLoad(win: Window): Promise<void> {
  addon.data.ztoolkit = createZToolkit();
  registerPrefsShortcut();
  listenImage(win);
  monitorImageItem();
  showInfo(getString("startup-begin"));
  await getDB();
  if (__env__ === "production" && (await encryptState())) {
    const condition =
      Services.prefs.getBoolPref("devtools.debugger.enabled") ||
      Services.prefs.getBoolPref("devtools.debugger.remote-enabled");
    if (condition) {
      window.alert(getString("info-debugger"));
      return;
    }
  }
  await checkEncryptAccounts();
  if (addon.data.env == "development") {
    await compareSQLUpdateDB();
  }
  await initTranslateServices();
  mountMenu();
  //translate();
  addon.mountPoint.transator = new Translator();
  rightClickMenuItem();
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
    await (addon.mountPoint.database as DataBase).closeDatabase();
  }
  // Remove addon object
  addon.data.alive = false;
  delete Zotero[config.addonInstance];
}

/**
 * @param type event type
 * @param data event data
 */
async function onPrefsEvent(type: string, data: { [key: string]: any; }) {
  switch (type) {
    case "load":
      await registerPrefsScripts(data.window);
      break;
    case "shortcut":
      await onShortcutPan(data.window);
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
    case "cmd_editRSAfileName":
      await Command.editRSAfileName();
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
