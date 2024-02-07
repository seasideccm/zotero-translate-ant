import { addonDir } from "../../utils/constant";
import { saveJsonToDisk, zipFile } from "../../utils/tools";

class Datasync {
    collectionName: string;
    itemTitle: string;
    constructor() {
        this.collectionName = this.getCollectionName() || "addonDatabase";
        this.itemTitle = this.getItemTitle() || "sqliteDatabase01";

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
            collections
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
        collection = new Zotero.Collection;
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
        const collection = allCollections.filter((c: Zotero.Collection) => c.name == this.collectionName)[0];
        return collection;
    }
    async getSyncItem(itemTitle?: string) {
        const collection = await this.getCollection();
        const items = collection.getChildItems();
        const item = items.filter((i: Zotero.Item) => i.getField('title') == this.itemTitle)[0];
        return item;
    }


    getUnsyncObj() {
        const obj = {
            test: "zip"
        };
        return obj;
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

    addZip() {


    }

    upload(option: any) {
        this.syncWebDav();
        this.syncZFS();
    }
    download(option: any) {

    }

    syncWebDav() {

    }
    syncZFS() {

    }
    jsonFromZip(zipFile: string) {

        return JSON.stringify({
            test: "zip"
        });
    }
    jsonDownload() {

    }

    saveData() {

    }

}

export const DBsync = new Datasync();
export async function jsonTofileTest() {
    await DBsync.attachJson();
}