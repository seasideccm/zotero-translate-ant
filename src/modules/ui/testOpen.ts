import { config } from "../../../package.json";
export function openWindow() {
       const url = `chrome://${config.addonRef}/content/test.xhtml`;
       window.openDialog(url, '', 'chrome,centerscreen');
};
