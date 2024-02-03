import { tablesTranslation } from '../../utils/constant';
import { showInfo } from '../../utils/tools';
import { DataObjects } from '../database/dataObjects';
import { getDB, DB } from '../database/database';

/**
 * 翻译引擎
 * serialNumber对应数据库
 */
export class TranslateService {
  [key: string]: any;
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
  _changed?: any;
  _previousData?: any;
  _changedData?: any;
  _dataTypesToReload?: any;
  _itemData?: any;
  _loaded?: any;
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
    serialNumber?: number,

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
    this.editable = true;
    this._objectType = "item";
    this.serviceTypeID = this.getServiceTypeID();
    //this.ObjectsClass = addon.mountPoint['TranslateServices'];
  }

  //个人数据保存至 database，
  getServiceTypeID(serviceType?: string) {
    const objectType = ["item", "collection", "dataObject", "search", "feedItem"];
    const serviceTypes = ["translate", "ocr", "ocrTranslate", "languageIdentification"];
    const translateServices = ["baidu", "baidufield", "tencent", "niutranspro", "caiyun", "youdaozhiyun", "cnki", "googleapi", "google", "deeplfree", "deeplx", "microsoft", "gpt", "baiduModify", "baidufieldModify", "tencentTransmart", "haici", "youdao",];
    const ocrServices = ["baiduOCR"];
    const ocrTranslateServices = ["baiduPictureTranslate"];
    const languageIdentificationServices = [""];
    const serviceCategory = {
      translate: translateServices,
      ocr: ocrServices,
      ocrTranslate: ocrTranslateServices,
      languageIdentification: languageIdentificationServices,
    };
    if (serviceType) return serviceTypes.indexOf(serviceType);
    for (const k in serviceCategory) {
      if (serviceCategory[k as keyof typeof serviceCategory].indexOf(this.id) > -1) return serviceTypes.indexOf(k);
    }
  }
  _requireData(dataType: string) {
    if (this._loaded[dataType] === undefined) {
      throw new Error(dataType + " is not a valid data type for " + "TranslateService" + " objects");
    }

    if (!this._loaded[dataType]) {
      throw new Error(`${dataType} not loaded for TranslateService ${this.id}`);
    }
  }

  hasChanged() {
    const changed = Object.keys(this._changed).filter(dataType => this._changed[dataType])
      .concat(Object.keys(this._changedData));
    if (changed.length == 1
      && changed[0] == 'primaryData'
      && Object.keys(this._changed.primaryData).length == 1
      && this._changed.primaryData.synced
      && this._previousData.synced == this._synced) {
      return false;
    }
    return !!changed.length;
  }

  _clearChanged(dataType: string) {
    if (dataType) {
      delete this._changed[dataType];
      delete this._previousData[dataType];
      delete this._changedData[dataType];
    }
    else {
      this._changed = {};
      this._previousData = {};
      this._changedData = {};
      this._dataTypesToReload = new Set();
    }
  }

  async _setChanged(dataType: string) {
    if (!this._changed.itemData) {
      this._changed.itemData = {};
    }
    const DB = await getDB();
    const fieldID = await DB.getFieldID(dataType);
    this._changed.itemData[fieldID] = true;
  }
  //fieldID 字段编号，所有字段统一编号
  //_itemData 以字段序号为键，存储条目字段对应的值
  async setItemData(field: string) {
    const DB = await getDB();
    const fieldID = await DB.getFieldID(field);
    this._itemData[fieldID] = this[field as keyof typeof this];
  }


  save: any = Zotero.Promise.coroutine(function* (this: any, options = {}): any {
    const env: any = {
      options: Object.assign({}, options),
      transactionOptions: {}
    };

    const DB = yield getDB();

    if (env.options.skipAll) {
      [
        'skipDateModifiedUpdate',
        'skipClientDateModifiedUpdate',
        'skipSyncedUpdate',
        'skipEditCheck',
        'skipNotifier',
        'skipSelect'
      ].forEach(x => env.options[x] = true);
    }

    const proceed = yield this._initSave(env);
    if (!proceed) return false;

    if (env.isNew) {
      ztoolkit.log('Saving data for new ' + this._objectType + ' to database');
    }
    else {
      ztoolkit.log('Updating database with new ' + this._objectType + ' data');
    }

    try {

      env.notifierData = {};
      // Pass along any 'notifierData' values, which become 'extraData' in notifier events
      if (env.options.notifierData) {
        Object.assign(env.notifierData, env.options.notifierData);
      }
      if (env.options.skipSelect) {
        env.notifierData.skipSelect = true;
      }
      // Pass along event-level notifier options, which become top-level extraData properties
      for (const option of Zotero.Notifier.EVENT_LEVEL_OPTIONS) {
        if (env.options[option] !== undefined) {
          env.notifierData[option] = env.options[option];
        }
      }
      if (!env.isNew) {
        env.changed = this._previousData;
      }

      // Create transaction
      let result;
      if (!DB.inTransaction()) {
        result = yield DB.executeTransaction(async function (this: any) {
          this._saveData.call(this, env);
          await this.saveData(env);
          await this._finalizeSave.call(this, env);
          return this.finalizeSave(env);
        }.bind(this), env.transactionOptions);
      }
      // Use existing transaction
      else {
        DB.requireTransaction();
        this._saveData.call(this, env);
        yield this._saveData(env);
        yield this._finalizeSave.call(this, env);
        result = this._finalizeSave(env);
      }
      this._postSave(env);
      return result;
    }
    catch (e) {
      return this._recoverFromSaveError(env, e)
        .catch(function (e2: any) {
          ztoolkit.log(e2, 1);
        })
        .then(function () {
          if (env.options.errorHandler) {
            env.options.errorHandler(e);
          }
          else {
            ztoolkit.log(e);
          }
          throw e;
        });
    }
  });

  /* saveTx(options?: any) {
    options = options ? options : {};
    options = Object.assign({}, options);
    options.tx = true;
    return this.save(options);
  } */


  _recoverFromSaveError = Zotero.Promise.coroutine(function* (this: any, env: any) {
    yield this.reload(null, true);
    this._clearChanged();
  });

  _postSave(env: any) {
    ztoolkit.log("save finished. todo else something.");
  };

  async _initSave(this: any, env: any) {
    if (!this.serviceTypeID) {
      throw new Error("Item type must be set before saving");
    }
    env.isNew = !this.serialNumber;

    if (!this.hasChanged()) {
      ztoolkit.log(this.id + ' has not changed');
      return false;
    }
    if (!env.options.skipEditCheck) {
      if (!this.editable) {
        throw new Error("Cannot edit " + this._objectType + this.id);
      }
    }
    // Undo registerObject() on failure
    if (env.isNew) {
      const func = function (this: any) {
        this.ObjectsClass.unload(this._id);
      }.bind(this);




      if (env.options.tx) {
        env.transactionOptions.onRollback = func;
      }
      else {
        (await getDB()).addCurrentCallback("rollback", func);
      }
    }

    return true;

  };

  /*   if(this._changed.itemData) {
      let del = [];
  
      let valueSQL = "SELECT valueID FROM itemDataValues WHERE value=?";
      let insertValueSQL = "INSERT INTO itemDataValues VALUES (?,?)";
      let replaceSQL = "REPLACE INTO itemData VALUES (?,?,?)";
  
      for (let fieldID in this._changed.itemData) {
        fieldID = parseInt(fieldID);
        let value = this.getField(fieldID, true);
  
        // If field changed and is empty, mark row for deletion
        if (value === '') {
          del.push(fieldID);
          continue;
        }
  
        if (Zotero.ItemFields.getID('accessDate') == fieldID
          && (this.getField(fieldID)) == 'CURRENT_TIMESTAMP') {
          value = DB.transactionDateTime;
        }
  
        let valueID = yield DB.valueQueryAsync(valueSQL, [value], { debug: true });
        if (!valueID) {
          valueID = Zotero.ID.get('itemDataValues');
          yield DB.queryAsync(insertValueSQL, [valueID, value], { debug: false });
        }
  
        yield DB.queryAsync(replaceSQL, [itemID, fieldID, valueID], { debug: false });
      }
  
      // Delete blank fields
      if (del.length) {
        sql = 'DELETE from itemData WHERE itemID=? AND '
          + 'fieldID IN (' + del.map(() => '?').join() + ')';
        yield DB.queryAsync(sql, [itemID].concat(del));
      }
    }
   */
  _saveData(env: any) {
    const libraryID = env.libraryID = this.libraryID || Zotero.Libraries.userLibraryID;
    const key = env.key = this._key = this.key ? this.key : this._generateKey();

    env.sqlColumns = [];
    env.sqlValues = [];

    if (env.isNew) {
      env.sqlColumns.push(
        'libraryID',
        'key'
      );
      env.sqlValues.push(
        libraryID,
        key
      );
    }

    if (this._changed.primaryData && this._changed.primaryData.version) {
      env.sqlColumns.push('version');
      env.sqlValues.push(this.version || 0);
    }

    if (this._changed.primaryData && this._changed.primaryData.synced) {
      env.sqlColumns.push('synced');
      env.sqlValues.push(this.synced ? 1 : 0);
    }
    // Set synced to 0 by default
    else if (!env.isNew && !env.options.skipSyncedUpdate) {
      env.sqlColumns.push('synced');
      env.sqlValues.push(0);
    }

    if (env.isNew || !env.options.skipClientDateModifiedUpdate) {
      env.sqlColumns.push('clientDateModified');
      env.sqlValues.push(Zotero.DB.transactionDateTime);
    }

    if (!env.options.skipNotifier && this._changedData.deleted !== undefined) {
      Zotero.Notifier.queue('refresh', 'trash', this.libraryID, { autoSyncDelay: {}, skipAutoSync: {} }, env.options.notifierQueue);
      if (!env.isNew && this._changedData.deleted) {
        Zotero.Notifier.queue('trash', this._objectType, [this.id], { autoSyncDelay: {}, skipAutoSync: {} }, env.options.notifierQueue);
      }
    }
  }

  saveData = Zotero.Promise.coroutine(function* (this: any, env: any): any {
    const DB: DB = yield getDB();
    DB.requireTransaction();

    const { isNew } = env;
    const options = env.options;
    const sqlValues = [''];
    const table = "translation";
    const sqlColumns = tablesTranslation[table as keyof typeof tablesTranslation];
    //translateService;



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

    let sn = yield DB.getNextID(table, 'serialNumber');
    sn = typeof sn === 'string' ? parseInt(sn) : sn;
    const serialNumber = this.serialNumber ? this.serialNumber : sn;

    if (!sqlColumns.length) return;
    if (isNew) {
      sqlColumns.unshift('serialNumber');
      sqlValues.unshift(serialNumber);
      const sql = `INSERT INTO ${table} (${sqlColumns.join(", ")}) VALUES (${sqlValues.map(() => "?").join()})`;
      yield DB.queryAsync(sql, sqlValues);
    }
    else {
      const sql = `UPDATE ${table} SET ${sqlColumns.join("=?, ")}=? WHERE serialNumber=?`;
      sqlValues.push(serialNumber);
      yield DB.queryAsync(sql, sqlValues);
    }
    if (!options.skipNotifier) {
      //Zotero.Notifier.queue('modify', 'item', itemID, env.notifierData, env.options.notifierQueue);
      const msg = (isNew ? "新增" : "更新") + "翻译引擎：" + serialNumber;
      showInfo(msg);
    }

    this._clearChanged();

  }.bind(this));

  _finalizeSave(this: any, env: any) {

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
      ztoolkit.log("skipCache is only for new objects");
    }
  };

  //数据保存完成之后的操作
  finalizeSave = Zotero.Promise.coroutine(function* (this: any, env: any) {
    if (!env.skipCache) {
      yield this.loadPrimaryData(true);
      yield this.reload();
      // If new, there's no other data we don't have, so we can mark everything as loaded
      if (env.isNew) {
        this._markAllDataTypeLoadStates(true);
      }
    }

    return env.isNew ? this.id : true;

  });

  loadPrimaryData = Zotero.Promise.coroutine(function* (this: any, reload, failOnMissing): any {
    if (this._loaded.primaryData && !reload) return;
    //return;

    const id = this._id;
    const key = this._key;

    if (!id && !key) {
      throw new Error('ID or key not set in Zotero.' + this._ObjectType + '.loadPrimaryData()');
    }

    const columns = [], join = [], where: any[] = [];
    const primaryFields = this.ObjectsClass.primaryFields;
    const idField = this.ObjectsClass.idColumn;
    for (let i = 0; i < primaryFields.length; i++) {
      const field = primaryFields[i];
      // If field not already set
      if (field == idField || this['_' + field] === null || reload) {
        columns.push(this.ObjectsClass.getPrimaryDataSQLPart(field));
      }
    }
    if (!columns.length) {
      return;
    }

    // This should match Zotero.*.primaryDataSQL, but without
    // necessarily including all columns
    let sql = "SELECT " + columns.join(", ") + this.ObjectsClass.primaryDataSQLFrom;
    let params;
    if (id) {
      sql += " AND O." + idField + "=? ";
      params = id;
    }
    else {
      sql += " AND O.key=? AND O.libraryID=? ";
      params = [key];
    }
    sql += (where.length ? ' AND ' + where.join(' AND ') : '');
    const row = yield Zotero.DB.rowQueryAsync(sql, params);

    if (!row) {
      if (failOnMissing) {
        throw new Error(this._ObjectType + " " + (id ? id : key)
          + " not found in " + this._ObjectType + ".loadPrimaryData()");
      }

      // If object doesn't exist, mark all data types as loaded
      this._markAllDataTypeLoadStates(true);

      return;
    }

    this.loadFromRow(row, reload);
  });

  loadFromRow(row: any, reload: any) {
    // If necessary or reloading, set the type and reinitialize this._itemData
    if (reload || (!this._serviceTypeID && row.serviceTypeID)) {
      this.setType(row.serviceTypeID, true);
    }

    this._parseRowData(row);
    this._finalizeLoadFromRow(row);
  }

  //从 github（共享）更新翻译引擎数据，保存到 database
  updateFromService = Zotero.Promise.coroutine(function* (env) { });

}



export function makebaidu() {
  const baidu = new TranslateService(
    "baidu",
    5000,
    10,
    "month",
    1000000,
    false,
    true,
  );
  return baidu;
}
const baidu = makebaidu();
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


export function testsss() {
  baidu.save();
}

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
