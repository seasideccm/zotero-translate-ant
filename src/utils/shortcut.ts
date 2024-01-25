import { config } from "../../package.json";





export function registerShortcuts() {


    //e, {        keyboard: currentShortcut,        type: "keyup",    }
    // Register an event key for Alt+L
    ztoolkit.Keyboard.register((ev, keyOptions) => {
        ztoolkit.log(ev, keyOptions.keyboard);
        if (keyOptions.keyboard.equals("shift,l")) {
            addon.hooks.onShortcuts("larger");
        }
        if (ev.shiftKey && ev.key === "S") {
            addon.hooks.onShortcuts("smaller");
        }
    });

    new ztoolkit.ProgressWindow(config.addonName)
        .createLine({
            text: "Example Shortcuts: Alt+L/S/C",
            type: "success",
        })
        .show();
}


export function exampleShortcutLargerCallback() {
    new ztoolkit.ProgressWindow(config.addonName)
        .createLine({
            text: "Larger!",
            type: "default",
        })
        .show();

    ztoolkit.Keyboard.register((ev, keyOptions) => {
        ztoolkit.log(ev, keyOptions.keyboard);
        if (keyOptions.keyboard.equals("shift,l")) {
            addon.hooks.onShortcuts("larger");
        }
        if (ev.shiftKey && ev.key === "S") {
            addon.hooks.onShortcuts("smaller");
        }
    });

}

export function exampleShortcutSmallerCallback() {
    new ztoolkit.ProgressWindow(config.addonName)
        .createLine({
            text: "Smaller!",
            type: "default",
        })
        .show();
}