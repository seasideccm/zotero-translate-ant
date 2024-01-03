import { config } from "../../../package.json";
export const addonStorageDir = PathUtils.join(Zotero.getStorageDirectory().path, config.addonName);
export const { OS } = Components.utils.import("resource://gre/modules/osfile.jsm");