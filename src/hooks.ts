import { config } from "../package.json";
import { TranslateServices } from "./modules/database/dataObjects";
import { DB, compareSQLUpdateDB, getDB } from "./modules/database/database";
import { registerNotifier } from "./modules/notify";
import { listenImageCallback } from "./modules/ocr/trigerOcr";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { initTranslateServices } from "./modules/translate/translateServices";
import { mountMenu } from "./modules/ui/menu";
import { monitorImageItem } from "./modules/ui/monitorImageItem";
import { getString, initLocale } from "./utils/locale";
import {
  registerFn,
  registerShortcutsCache,
  setShortcut,
} from "./utils/shortcut";
import { getPopupWin } from "./utils/tools";
import { createZToolkit } from "./utils/ztoolkit";

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

  ztoolkit.PreferencePane.register({
    pluginID: config.addonID,
    src: rootURI + "chrome/content/preferences.xhtml",
    label: getString("prefs-title"),
    image: `chrome://${config.addonRef}/content/icons/favicon.png`,
    defaultXUL: true,
  });

  //registerShortcuts();
  registerShortcutsCache();

  //registerPrefs();
  await onMainWindowLoad(window);
}

async function onMainWindowLoad(win: Window): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();
  mountMenu();
  window.addEventListener("mouseover", listenImageCallback, false);
  monitorImageItem();
  setShortcut();
  const popupWin = getPopupWin();
  addon.mountPoint['TranslateServices'] = TranslateServices;
  registerFn();
  popupWin
    .createLine({
      text: getString("startup-begin"),
      type: "default",
      progress: 0,
    })
    .show();
  popupWin.startCloseTimer(5000);
  await getDB();
  if (addon.data.env == "development") {
    await compareSQLUpdateDB();
  }
  await initTranslateServices();
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

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onPrefsEvent,
  onShortcuts,
  onDialogEvents,
};
