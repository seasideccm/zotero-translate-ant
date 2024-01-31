import { getDB, DB } from '../database/database';

/**
 * 翻译引擎
 * serialNumber对应数据库
 */
export class TranslateService {
  id: string;
  charasPerTime: number;
  QPS: number;
  limitMode: string;
  charasLimit: number;
  isMultiParas: boolean;
  hasSecretKey: boolean;
  secretKey?: {
    key: string;
    usable: boolean;
    charConsum: number;
    dateMarker?: string;
  }[];
  forbidden?: boolean;
  serialNumber?: number;
  /**
   *
   * @param id
   * @param charasPerTime
   * @param QPS
   * @param limitMode
   * @param charasLimit
   * @param isMultiParas
   * @param hasSecretKey
   * @param secretKey
   */
  constructor(
    id: string,
    charasPerTime: number,
    QPS: number,
    limitMode: string,
    charasLimit: number,
    isMultiParas: boolean,
    hasSecretKey: boolean,
    secretKey?: {
      key: string;
      usable: boolean;
      charConsum: number;
    }[],
    forbidden?: boolean,
    serialNumber?: number
  ) {
    this.id = id;
    this.charasPerTime = charasPerTime;
    this.QPS = QPS;
    this.limitMode = limitMode;
    this.charasLimit = charasLimit;
    this.isMultiParas = isMultiParas;
    this.hasSecretKey = hasSecretKey;
    this.secretKey = secretKey;
    this.forbidden = forbidden;
    this.serialNumber = serialNumber;
  }

  //个人数据保存至 database，

  /*  initSave = Zotero.Promise.coroutine(function* (env) { });
   saveData = Zotero.Promise.coroutine(function* (env: any) {
     const DB: DB = yield getDB();
     DB.requireTransaction();
     const isNew = env.isNew;
     const options = env.options;
 
     //translateService;
 
 
     if () {
       env.sqlColumns.push('itemTypeID');
       env.sqlValues.push({ int: itemTypeID });
     }
 
     if (isNew || (this._changed.primaryData && this._changed.primaryData.dateAdded)) {
       env.sqlColumns.push('dateAdded');
       env.sqlValues.push(this.dateAdded ? this.dateAdded : DB.transactionDateTime);
     }
 
     if (!this.dateModified
       || ((!this._changed.primaryData || !this._changed.primaryData.dateModified)
         && !options.skipDateModifiedUpdate)) {
       env.sqlColumns.push('dateModified');
       env.sqlValues.push(DB.transactionDateTime);
     }
     // Otherwise, if a new Date Modified was provided, use that. (This would also work when
     // skipDateModifiedUpdate was passed and there's an existing value, but in that case we
     // can just not change the field at all.)
     else if (this._changed.primaryData && this._changed.primaryData.dateModified) {
       env.sqlColumns.push('dateModified');
       env.sqlValues.push(this.dateModified);
     }
     const serviceID = this._id = this.id ? this.id : Zotero.ID.get('serviceID');
     if (env.sqlColumns.length) {
       if (isNew) {
         env.sqlColumns.unshift('serviceID');
         env.sqlValues.unshift(parseInt(serviceID));
 
         const sql = "INSERT INTO items (" + env.sqlColumns.join(", ") + ") "
           + "VALUES (" + env.sqlValues.map(() => "?").join() + ")";
         yield DB.queryAsync(sql, env.sqlValues);
 
         if (!env.options.skipNotifier) {
           Zotero.Notifier.queue('add', 'item', itemID, env.notifierData, env.options.notifierQueue);
         }
       }
       else {
         const sql = "UPDATE items SET " + env.sqlColumns.join("=?, ") + "=? WHERE itemID=?";
         env.sqlValues.push(parseInt(itemID));
         yield DB.queryAsync(sql, env.sqlValues);
 
         if (!env.options.skipNotifier) {
           Zotero.Notifier.queue('modify', 'item', itemID, env.notifierData, env.options.notifierQueue);
         }
       }
     }
 
 
   });
 
 
   //数据保存完成之后的操作
   finalizeSave = Zotero.Promise.coroutine(function* (env) {
 
     if (this._changed.relations) {
       let toAdd, toRemove;
       // Convert to individual JSON objects, diff, and convert back
       if (this._previousData.relations) {
         const oldRelationsJSON = this._previousData.relations.map(x => JSON.stringify(x));
         const newRelationsJSON = this._relations.map(x => JSON.stringify(x));
         toAdd = Zotero.Utilities.arrayDiff(newRelationsJSON, oldRelationsJSON)
           .map(x => JSON.parse(x));
         toRemove = Zotero.Utilities.arrayDiff(oldRelationsJSON, newRelationsJSON)
           .map(x => JSON.parse(x));
       }
       else {
         toAdd = this._relations;
         toRemove = [];
       }
 
       if (toAdd.length) {
         const sql = "INSERT INTO " + this._objectType + "Relations "
           + "(" + this._ObjectsClass.idColumn + ", predicateID, object) VALUES ";
         // Convert predicates to ids
         for (let i = 0; i < toAdd.length; i++) {
           toAdd[i][0] = yield Zotero.RelationPredicates.add(toAdd[i][0]);
           env.relationsToRegister.push([toAdd[i][0], toAdd[i][1]]);
         }
         yield Zotero.Utilities.Internal.forEachChunkAsync(
           toAdd,
           Math.floor(DB.MAX_BOUND_PARAMETERS / 3),
           async function (chunk) {
             await DB.queryAsync(
               sql + chunk.map(x => "(?, ?, ?)").join(", "),
               chunk.map(x => [this.id, x[0], x[1]])
                 .reduce((x, y) => x.concat(y))
             );
           }.bind(this)
         );
       }
 
       if (toRemove.length) {
         for (let i = 0; i < toRemove.length; i++) {
           const sql = "DELETE FROM " + this._objectType + "Relations "
             + "WHERE " + this._ObjectsClass.idColumn + "=? AND predicateID=? AND object=?";
           yield DB.queryAsync(
             sql,
             [
               this.id,
               (yield Zotero.RelationPredicates.add(toRemove[i][0])),
               toRemove[i][1]
             ]
           );
           env.relationsToUnregister.push([toRemove[i][0], toRemove[i][1]]);
         }
       }
     }
 
     if (env.isNew) {
       if (!env.skipCache) {
         // Register this object's identifiers in Zotero.DataObjects. This has to happen here so
         // that the object exists for the reload() in objects' finalizeSave methods.
         this.ObjectsClass.registerObject(this);
       }
       // If object isn't being reloaded, disable it, since its data may be out of date
       else {
         this._disabled = true;
       }
     }
     else if (env.skipCache) {
       Zotero.logError("skipCache is only for new objects");
     }
 
   }); */

  //从 github（共享）更新翻译引擎数据，保存到 database
  updateRemoteService = Zotero.Promise.coroutine(function* (env) { });

}

const baidu = new TranslateService(
  "baidu",
  5000,
  10,
  "month",
  1000000,
  false,
  true,
);
const baidufield = new TranslateService(
  "baidufield",
  5000,
  10,
  "month",
  500000,
  false,
  true,
);
const tencent = new TranslateService(
  "tencent",
  5000,
  5,
  "month",
  5000000,
  true,
  true,
);
const niutranspro = new TranslateService(
  "niutranspro",
  5000,
  50,
  "daily",
  200000,
  true,
  true,
);
const caiyun = new TranslateService(
  "caiyun",
  5000,
  50,
  "month",
  1000000,
  false,
  true,
);
const youdaozhiyun = new TranslateService(
  "youdaozhiyun",
  5000,
  200,
  "total",
  500000,
  false,
  true,
);
const cnki = new TranslateService("cnki", 1000, 5, "noLimit", 0, false, false);
const googleapi = new TranslateService(
  "googleapi",
  5000,
  5,
  "noLimit",
  0,
  true,
  false,
);
const google = new TranslateService(
  "google",
  5000,
  5,
  "noLimit",
  0,
  true,
  false,
);
const deeplfree = new TranslateService(
  "deeplfree",
  3000,
  3,
  "month",
  500000,
  true,
  true,
);
const deeplx = new TranslateService(
  "deeplx",
  3000,
  3,
  "month",
  500000,
  true,
  false,
);
const microsoft = new TranslateService(
  "microsoft",
  50000,
  10,
  "month",
  2000000,
  false,
  true,
);
const gpt = new TranslateService("gpt", 800, 2, "money", 0, false, true);
const baiduModify = new TranslateService(
  "baiduModify",
  5000,
  10,
  "month",
  1000000,
  true,
  true,
);
const baidufieldModify = new TranslateService(
  "baidufieldModify",
  5000,
  10,
  "month",
  500000,
  true,
  true,
);
const tencentTransmart = new TranslateService(
  "tencentTransmart",
  5000,
  20,
  "noLimit",
  0,
  false,
  false,
);
const haici = new TranslateService(
  "haici",
  600,
  10,
  "noLimit",
  0,
  false,
  false,
);
const youdao = new TranslateService(
  "youdao",
  2000,
  5,
  "noLimit",
  0,
  false,
  false,
);

export interface ServiceMap {
  [serviceID: string]: TranslateService;
}

const servicesDefault: ServiceMap = {
  baidu,
  baidufield,
  tencent,
  niutranspro,
  caiyun,
  youdaozhiyun,
  cnki,
  googleapi,
  google,
  deeplfree,
  deeplx,
  microsoft,
  gpt,
  baiduModify,
  baidufieldModify,
  tencentTransmart,
  haici,
  youdao,
};

const services = servicesDefault;
export { services };
