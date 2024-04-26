import { addonDir } from "../../utils/constant";
import { saveJsonToDisk, zipFile } from "../../utils/tools";
import { getDB } from "./database";

class Datasync {
  collectionName: string;
  itemTitle: string;
  markObjectAsSynced: () => Promise<void>;
  markObjectAsUnsynced: () => Promise<void>;
  constructor() {
    this.markObjectAsSynced = Zotero.Promise.method(function (obj: any) {
      obj.synced = true;
      return obj.saveTx({ skipAll: true });
    });
    this.markObjectAsUnsynced = Zotero.Promise.method(function (obj: any) {
      obj.synced = false;
      return obj.saveTx({ skipAll: true });
    });
    this.collectionName = this.getCollectionName() || "addonDatabase";
    this.itemTitle = this.getItemTitle() || "sqliteDatabase01";
  }
  getNextTitleSN() {
    return "01";
  }
  async attachJson() {
    const itemSync = await this.getSyncItem();
    const file = await this.jsonTofile();
    const libraryID = Zotero.Libraries.userLibraryID;
    const fileBaseName = undefined;
    const parentItemID = itemSync.id;
    const collections = undefined;

    const attachment = await Zotero.Attachments.importFromFile({
      file,
      libraryID,
      fileBaseName,
      parentItemID,
      collections,
    });
  }
  getCollectionName() {
    return Zotero.Prefs.get("collectionNameDatasync") as string;
  }
  getItemTitle() {
    return Zotero.Prefs.get("itemTitleDatasync") as string;
  }
  async getCollection() {
    let collection = this.getCollectionByName(this.collectionName);
    if (collection) {
      return collection;
    }
    collection = new Zotero.Collection();
    collection.libraryID = Zotero.Libraries.userLibraryID;
    collection.name = this.collectionName;
    await collection.saveTx();
    return collection;
  }
  getCollectionByName(collectionName?: string) {
    /* let collection = Zotero.Collections.getByLibraryAndKey(libraryID, key);
        var collection = Zotero.nextCollection();
        let collection = ZoteroPane.getSelectedCollection(); */
    const libraryID = Zotero.Libraries.userLibraryID;
    const allCollections = Zotero.Collections.getByLibrary(libraryID);
    const collection = allCollections.filter(
      (c: Zotero.Collection) => c.name == this.collectionName,
    )[0];
    return collection;
  }
  async getSyncItem(itemTitle?: string) {
    itemTitle = itemTitle || this.itemTitle;
    if (!itemTitle) return;
    const collection = await this.getCollection();
    const items = collection.getChildItems();
    const item = items.filter((i: Zotero.Item) =>
      i.getField("title").includes(itemTitle!),
    )[0];
    return item;
  }

  async getUnsyncObj() {
    const DB = await getDB();
    const ids = await DB.columnQueryAsync(
      "SELECT translateID FROM sync WHERE synced=0 AND deleted=0",
    );
    const objs = Zotero.items.get(ids);
    const deletedIDs = await DB.columnQueryAsync(
      "SELECT translateID FROM deleteLog WHERE synced=0",
    );
    return {
      objs,
      deletedIDs,
    };
  }

  async getDeleted() {
    const DB = await getDB();
    const sql = "SELECT key FROM syncDeleteLog ";
    return DB.columnQueryAsync(sql);
  }

  async jsonTofile() {
    //根据同步时间获取未同步对象
    const obj = this.getUnsyncObj();
    const dir = PathUtils.join(addonDir, "sync");
    const fileName = String(new Date().getTime());
    const path = await saveJsonToDisk(obj, fileName, dir);
    return path;
  }

  async zipJson() {
    //根据同步时间获取未同步对象
    const obj = this.getUnsyncObj();
    const dir = PathUtils.join(addonDir, "sync");
    const fileName = String(new Date().getTime());
    const path = await saveJsonToDisk(obj, fileName, dir);
    const zipPath = PathUtils.join(dir, fileName + ".zip");

    const zipUnsync = zipFile(path, zipPath);
  }

  addZip() {}

  upload(option: any) {
    this.syncWebDav();
    this.syncZFS();
  }
  download(option: any) {}

  syncWebDav() {}
  syncZFS() {}
  jsonFromZip(zipFile: string) {
    return JSON.stringify({
      test: "zip",
    });
  }
  jsonDownload() {}

  saveData() {}
}

export const DBsync = new Datasync();
export async function jsonTofileTest() {
  await DBsync.attachJson();
}
