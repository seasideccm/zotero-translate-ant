
export class DataObjects {
    [key: string]: any;
    constructor() {
        this._objectCache = {};
        this._objectKeys = {};
        this._objectIDs = {};
        this._loadPromise = null;
    }


    unload(...args: any[]) {
        const ids = Zotero.flattenArguments(args);
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const { libraryID, key } = this.getLibraryAndKeyFromID(id) as any;
            if (key) {
                delete this._objectIDs[libraryID][key];
                delete this._objectKeys[id];
            }
            delete this._objectCache[id];
        }
    }
    getLibraryAndKeyFromID(id: any) {
        const lk = this._objectKeys[id];
        return lk ? { libraryID: lk[0], key: lk[1] } : false;
    }

    registerObject(obj: any) {
        const id = obj.id;
        const libraryID = obj.libraryID;
        const key = obj.key;
        if (!this._objectIDs[libraryID]) {
            this._objectIDs[libraryID] = {};
        }
        this._objectIDs[libraryID][key] = id;
        this._objectKeys[id] = [libraryID, key];
        this._objectCache[id] = obj;
        obj._inCache = true;
    }
}

export const TranslateServices = new DataObjects()

