import { config } from "../package.json";
import { DB, getDB } from "./modules/database";
import { listenImageCallback } from "./modules/ocr/trigerOcr";
import { registerPrefs, registerPrefsScripts } from "./modules/preferenceScript";
import { monitorImageItem } from "./modules/ui/monitorImageItem";
import { mountButtonEndMenubar } from "./modules/ui/toolbarButton";
import { getString, initLocale } from "./utils/locale";
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
  registerPrefs();
  await onMainWindowLoad(window);
}

async function onMainWindowLoad(win: Window): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();
  mountButtonEndMenubar();
  window.addEventListener("mouseover", listenImageCallback, false);
  monitorImageItem();
  const popupWin = new ztoolkit.ProgressWindow(config.addonName, {
    closeOnClick: true,
    closeTime: -1,
  });
  addon.mountPoint.popupWin = popupWin;
  popupWin.createLine({
    text: getString("startup-begin"),
    type: "default",
    progress: 0,
  }).show();
  popupWin.startCloseTimer(5000);
  await getDB();
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
 * This function is just an example of dispatcher for Notify events.
 * Any operations should be placed in a function to keep this funcion clear.
 */
async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any; },
) {
  // You can add your code to the corresponding notify type
  ztoolkit.log("notify", event, type, ids, extraData);
  if (
    event == "select" &&
    type == "tab" &&
    extraData[ids[0]].type == "reader"
  ) {
    //BasicExampleFactory.exampleNotifierCallback();
    () => { };
  } else {
    return;
  }
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
      registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

function onShortcuts(type: string) {
  switch (type) {

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
  onNotify,
  onPrefsEvent,
  onShortcuts,
  onDialogEvents,
};
