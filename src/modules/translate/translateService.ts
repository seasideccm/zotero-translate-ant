
import { getDB } from '../database/database';


export class TranslateServiceAccount {
  serialNumber: number;
  serviceID: string;
  secretKey?: SecretKey;
  accessToken?: AccessToken;
  forbidden?: boolean; //用户是否禁用  
  changed?: any;
  previousData?: any;
  changedData?: any;
  loaded?: any;
  synced?: boolean;
  version?: number;

  constructor(option: any) {
    this.serialNumber = option.serialNumber;
    this.serviceID = option.serviceID;
    this.secretKey = option.secretKey;
    Zotero.Utilities.Internal.assignProps(this, option, ['forbidden', 'token']);
  }

}
//Zotero.extendClass(DataObject, TranslateServiceItem);

export class TranslateService {
  serviceID: string;
  charasPerTime: number;
  QPS: number;
  limitMode: string;
  charasLimit: number;
  supportMultiParas: boolean;
  hasSecretKey: boolean;
  secretKeys?: SecretKey[];
  hasToken: boolean;
  accessTokens?: AccessToken[];
  account?: TranslateServiceAccount;
  forbidden?: boolean;
  serialNumber?: number;
  configID?: number | undefined;
  changed?: any;
  previousData?: any;
  changedData?: any;
  loaded?: any;
  objectType?: string;
  serviceTypeID?: number;
  synced?: boolean;
  version?: number;

  constructor(options: {
    serviceID: string,
    charasPerTime: number,
    QPS: number,
    limitMode: string,
    charasLimit: number,
    supportMultiParas: boolean,
    hasSecretKey: boolean,
    hasToken: boolean,
    secretKeys?: SecretKey[],
    accessTokens?: AccessToken[],
    account?: TranslateServiceAccount,
    forbidden?: boolean,
    serialNumber?: number,
    configID?: number | undefined,
  }

  ) {
    this.serviceID = options.serviceID;

    this.charasPerTime = options.charasPerTime;
    this.QPS = options.QPS;
    this.limitMode = options.limitMode;
    this.charasLimit = options.charasLimit;
    this.supportMultiParas = options.supportMultiParas;
    this.hasSecretKey = options.hasSecretKey;
    this.hasToken = options.hasToken;
    this.secretKeys = options.secretKeys;
    this.accessTokens = options.accessTokens;
    this.account = options.account;
    this.forbidden = options.forbidden;
    this.serialNumber = options.serialNumber;
    this.configID = options.configID;
    this.objectType = "item";
    this.serviceTypeID = this.getServiceTypeID();
    //this.ObjectsClass = addon.mountPoint['TranslateServices'];
  }
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
      if (serviceCategory[k as keyof typeof serviceCategory].indexOf(this.serviceID) > -1) return serviceTypes.indexOf(k);
    }
  }
  async getSerialNumber(serviceID: string, row?: any) {
    let sql = `SELECT serialNumber FROM translateServiceSN WHERE serviceID = '${serviceID}'`;
    if (row) sql += `AND appID = '${row.appID}'`;
    const DB = await getDB();
    return await DB.valueQueryAsync(sql);
  }

  async save() {
    const DB = await getDB();
    let serialNumber = await this.getSerialNumber(this.serviceID);
    if (serialNumber) {
      //update
      return;
    }
    const todo = async () => {
      serialNumber = await DB.getNextID("translateServiceSN", "serialNumber");
      let sql = "INSERT INTO translateServiceSN (serialNumber, serviceID";
      if (row.appID) {
        sql += ", appID" + ") VALUES ('" + serialNumber + "','" + this.serviceID + "','" + row.appID + "')";
      } else {
        sql += ") VALUES ('" + serviceID + "','" + serialNumber + "')";
      }
      await DB.queryAsync(sql);

      const keys = Object.keys(row);
      if (keys.includes("token")) {
        const tableName = "accessTokens";
        const sqlColumns = ["serialNumber", "serviceID", "appID", "token"];
        const sqlValues = [serialNumber, serviceID, row.appID, row.token];
        //sql = "INSERT INTO " + tableName + " (" + sqlColumns.join(", ") + ") "                            + "VALUES (" + sqlValues.join(", ") + ")";
        sql = "INSERT INTO " + tableName + " (" + sqlColumns.join(", ") + ") " + "VALUES (" + sqlValues.map(() => "?").join() + ")";
        await DB.queryAsync(sql, sqlValues);
      } else {
        const tableName = "accounts";
        const sqlColumns = ["serialNumber", "serviceID", "appID", "secretKey"];
        const sqlValues = [serialNumber, serviceID, row.appID, row.secretKey];
        sql = "INSERT INTO " + tableName + " (" + sqlColumns.join(", ") + ") " + "VALUES (" + sqlValues.map(() => "?").join() + ")";
        await DB.queryAsync(sql, sqlValues);
      }
      let tableName = "charConsum";
      sql = `INSERT INTO ${tableName} (serialNumber) VALUES (${serialNumber})`;
      await DB.queryAsync(sql);
      tableName = "totalCharConsum";
      sql = `INSERT INTO ${tableName} (serialNumber) VALUES (${serialNumber})`;
      await DB.queryAsync(sql);

    };

    await DB.executeTransaction();

  }
  saveold: any = Zotero.Promise.coroutine(function* (this: any, options = {}): any {
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
}

/**
 * 翻译引擎
 * serialNumber对应数据库
 */
export class TranslateServiceOld {
  serviceID: string;
  charasPerTime: number;
  QPS: number;
  limitMode: string;
  charasLimit: number;
  supportMultiParas: boolean;
  hasSecretKey: boolean;
  secretKeys?: {
    appID: string;
    secretKey: string;
    usable: boolean;
    charConsum: number;
    dateMarker?: string;
  }[];
  forbidden?: boolean;
  serialNumber?: number;

  changed?: any;
  previousData?: any;
  changedData?: any;
  loaded?: any;
  objectType?: string;
  serviceTypeID?: number;

  synced?: boolean;
  key?: string;
  version?: number;


  /**
   * 
   * @param id 
   * @param charasPerTime 
   * @param QPS 
   * @param limitMode 
   * @param charasLimit 
   * @param supportMultiParas 
   * @param hasSecretKey 
   * @param secretKey 
   * @param forbidden 
   * @param serialNumber 
   */
  constructor(
    serviceID: string,
    charasPerTime: number,
    QPS: number,
    limitMode: string,
    charasLimit: number,
    supportMultiParas: boolean,
    hasSecretKey: boolean,
    secretKeys?: {
      appID: string;
      secretKey: string;
      usable: boolean;
      charConsum: number;
      dateMarker?: string;
    }[],
    forbidden?: boolean,
    serialNumber?: number,

  ) {
    this.serviceID = serviceID;
    this.charasPerTime = charasPerTime;
    this.QPS = QPS;
    this.limitMode = limitMode;
    this.charasLimit = charasLimit;
    this.supportMultiParas = supportMultiParas;
    this.hasSecretKey = hasSecretKey;
    this.secretKeys = secretKeys;
    this.forbidden = forbidden;
    this.serialNumber = serialNumber;
    this.objectType = "item";
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
      if (serviceCategory[k as keyof typeof serviceCategory].indexOf(this.serviceID) > -1) return serviceTypes.indexOf(k);
    }
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
}








