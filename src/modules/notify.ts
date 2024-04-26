import { encryptState } from "./crypto";

export function registerNotifier() {
  const callback = {
    notify: async (
      event: string,
      type: string,
      ids: number[] | string[],
      extraData: { [key: string]: any },
    ) => {
      if (!addon?.data.alive) {
        unregisterNotifier(notifierID);
        return;
      }
      onNotify(event, type, ids, extraData);
    },
  };

  const notifierID = Zotero.Notifier.registerObserver(callback);
  // Unregister callback when the window closes (important to avoid a memory leak)
  window.addEventListener(
    "unload",
    (e: Event) => {
      unregisterNotifier(notifierID);
    },
    false,
  );
}

export function unregisterNotifier(notifierID: string) {
  Zotero.Notifier.unregisterObserver(notifierID);
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  //观察 zotero 通知
  ztoolkit.log(
    "event::",
    event,
    "type::",
    type,
    "ids::",
    ids,
    "extraData::",
    JSON.stringify(extraData, null, 4),
  );
  if (ids[0] == 999999999999) {
    if (!extraData) return;
    for (const account of extraData.data) {
      if (account && account["save"] && typeof account["save"] == "function") {
        await account["save"]();
        if (!(await encryptState())) continue;
        if (
          account["encryptAccount"] &&
          typeof account["encryptAccount"] == "function"
        ) {
          await account["encryptAccount"]();
        }
      }
    }
  }
}

/**
 * This function is just an example of dispatcher for Notify events.
 * Any operations should be placed in a function to keep this funcion clear.
 */
/* async function onNotify(
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
   */
