declare const _globalThis: {
  [key: string]: any;
  Zotero: _ZoteroTypes.Zotero;
  ZoteroPane: _ZoteroTypes.ZoteroPane;
  Zotero_Tabs: typeof Zotero_Tabs;
  window: Window;
  document: Document;
  ztoolkit: ZToolkit;
  addon: typeof addon;
};

declare type ZToolkit = ReturnType<
  typeof import("../src/utils/ztoolkit").createZToolkit
>;

declare const ztoolkit: ZToolkit;

declare const rootURI: string;

declare const addon: import("../src/addon").default;

declare const __env__: "production" | "development";

declare class Localization { }

declare namespace XUL {
  interface MenuPopup {
    state: string;
    anchorNode: nsIDOMElement;
    triggerNode: nsIDOMNode;
    openPopup(anchor: nsIDOMElement, position: string, x: number, y: number, isContextMenu: boolean, attributesOverride: boolean, triggerEvent: Event): void;
  }
}

declare type SecretKey = {
  key: string;
  usable: boolean;
  charConsum: number;
  dateMarker?: string;
};

declare type Services = {
  [key: string]: typeof TranslateService;
};








