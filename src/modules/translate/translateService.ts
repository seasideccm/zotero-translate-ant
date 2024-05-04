import { showInfo } from "../../utils/tools";
import { encryptByAESKey, encryptState, getTableBySN } from "../crypto";
import { getDB, getDBSync } from "../database/database";
import { getSingleServiceUnderUse } from "./serviceManage";

//Zotero.extendClass(DataObject, TranslateServiceItem);
export declare type options = {
  serviceID: string;
  charasPerTime: number;
  QPS: number;
  limitMode: string;
  charasLimit: number;
  supportMultiParas: boolean | number;
  hasSecretKey: boolean | number;
  hasToken: boolean | number;
  //secretKeys?: SecretKey[],
  //accessTokens?: AccessToken[],
  accounts?: TranslateServiceAccount[];
  forbidden?: boolean | number;
  serialNumber?: number;
  configID?: number | undefined;
};

//todo 百度修改版共享百度信息
export class TranslateServiceAccount {
  serialNumber: number;
  serviceID: string;
  usable: boolean | number;
  charConsum: number;
  appID: string;
  secretKey?: string;
  token?: string;
  dateMarker?: string | undefined;
  forbidden?: boolean | number; //用户是否禁用
  changed?: any;
  previousData?: any;
  changedData?: any;
  loaded?: any;
  synced?: boolean | number;
  version?: number;
  saveDeferred?: _ZoteroTypes.DeferredPromise<void>;
  savePromise?: Promise<any>;
  totalCharConsum?: number;

  constructor(option: any) {
    if (["baiduModify", "baidufieldModify"].includes(option.serviceID)) {
      option.serviceID = option.serviceID.replace("Modify", "");
    }

    this.serialNumber = Number(option.serialNumber);
    this.serviceID = option.serviceID;
    this.usable = option.usable || 1;
    this.charConsum = option.charConsum || 0;
    this.appID = option.appID || Zotero.utilities.randomString(8);
    this.secretKey = option.secretKey;
    this.token = option.token;
    this.dateMarker = option.dateMarker;
    this.forbidden = option.forbidden;

  }
  sqlInsertRow(tableName: string, sqlColumns: string[], sqlValues: any[]) {
    return `INSERT INTO ${tableName} (${sqlColumns.join(", ")}) VALUES (${sqlValues.map(() => "?").join()})`; //"?").join() without ","
  }
  async save() {
    if (this.changedData) {
      await this.saveChange();
    }
    for (const key of Object.keys(this)) {
      if (typeof this[key as keyof typeof this] == "string") {
        if ((this[key as keyof typeof this] as string).endsWith("No Data"))
          return;
      }
    }
    if (!this.secretKey && !this.token) return;
    this.saveDeferred = Zotero.Promise.defer();
    this.savePromise = this.saveDeferred.promise;
    const DB = await getDB();
    //新建账号没有 changedData

    await DB.executeTransaction(async () => {
      try {
        let sql = `INSERT INTO translateServiceSN (serialNumber, serviceID ,appID) VALUES (${this.serialNumber},'${this.serviceID}','${this.appID}')`;
        await DB.queryAsync(sql);
        let tableName = this.secretKey ? "accounts" : "accessTokens";
        const secretKeyOrtoken = this.secretKey ? "secretKey" : "token";
        let secretKeyOrtokenValue = this.secretKey
          ? this.secretKey
          : this.token;
        const state = await encryptState();
        if (state) {
          if (
            secretKeyOrtokenValue &&
            !secretKeyOrtokenValue?.includes("encryptAESString")
          ) {
            secretKeyOrtokenValue = await encryptByAESKey(
              secretKeyOrtokenValue,
            );
          }
        }
        const sqlColumns = [
          "serialNumber",
          "serviceID",
          "appID",
          secretKeyOrtoken,
        ];
        const sqlValues = [
          this.serialNumber,
          this.serviceID,
          this.appID,
          secretKeyOrtokenValue,
        ];
        await DB.queryAsync(
          this.sqlInsertRow(tableName, sqlColumns, sqlValues),
          sqlValues,
        );
        tableName = "charConsum";
        sql = `INSERT INTO ${tableName} (serialNumber) VALUES (${this.serialNumber})`;
        await DB.queryAsync(sql);
        tableName = "totalCharConsum";
        sql = `INSERT INTO ${tableName} (serialNumber) VALUES (${this.serialNumber})`;
        await DB.queryAsync(sql);
      } catch (e: any) {
        this.saveDeferred!.reject();
        ztoolkit.log(e);
        showInfo(e);
      }
    });
    this.saveDeferred.resolve();

    return;
  }

  async saveChange() {
    if (!this.changedData) return;
    //更新账号
    const sqls: string[] = [];
    const values: any[] = [];
    const keys = Object.keys(this.changedData);
    for (const key of keys) {
      let tableNames: string[] = [];
      switch (key) {
        case "secretKey":
          tableNames = ["accounts"];
          break;
        case "token":
          tableNames = ["accessTokens"];
          break;
        case "charConsum":
        case "dateMarker":
          tableNames = ["charConsum"];
          break;
        case "totalCharConsum":
          tableNames = ["totalCharConsum"];
          break;
        case "usable":
        case "forbidden":
          tableNames = ["translateServiceSN"];
          break;
        case "appID":
          tableNames = ["translateServiceSN"];
          if (this.secretKey) tableNames.push("accounts");
          if (this.token) tableNames.push("accessTokens");
          break;
        case "serialNumber":
          //tableNames = ['translateServiceSN'];
          sqls.push(
            `UPDATE translateServiceSN SET ${key} = ? WHERE appID = ${this.appID} AND serviceID = ${this.serviceID}`,
          );
          values.push(this.changedData[key]);
          break;
      }
      tableNames.forEach((tableName) => {
        const sql = `UPDATE ${tableName} SET ${key} = ? WHERE serialNumber = ${this.serialNumber}`;
        sqls.push(sql);
        values.push(this.changedData[key]);
      });
    }
    const DB = await getDB();
    await DB.executeTransaction(async () => {
      for (let i = 0; i < sqls.length; i++) {
        try {
          await DB.queryAsync(sqls[i], values[i]);
        } catch (e) {
          showInfo("Execute failed: " + sqls[i] + "====" + values[i]);
          throw e;
        }
      }
    });

    this.changedData = null;
  }
  /*  async encryptAccount() {
     const DB = getDBSync();
     const text = this.secretKey ? this.secretKey : this.token;
     if (!text) return;
     const stringEncyptAES = await encryptByAESKey(text);
     //let tableName = "accounts";
     const tableName = await getTableBySN(this.serialNumber);
     if (!tableName) {
       ztoolkit.log("accoun isn't exist: " + this.serialNumber);
       return;
     }
     const fieldName = tableName == "accounts" ? "secretKey" : "token";
     let sql = `SELECT ${fieldName} FROM ${tableName} WHERE serialNumber = ${this.serialNumber}`;
     const content = await DB.valueQueryAsync(sql);
     if (content) {
       sql = `UPDATE ${tableName} SET ${fieldName} = '${stringEncyptAES}' WHERE serialNumber = ${this.serialNumber}`;
       await DB.queryAsync(sql);
     } else {
       sql = `INSERT INTO ${tableName} (${fieldName}) VALUES ('${stringEncyptAES}') WHERE serialNumber = ${this.serialNumber}`;
     }
 
     await DB.executeTransaction(async () => {
       await DB.queryAsync(sql);
       //记录加密条目`SELECT serialNumber FROM encryptAccounts`
       sql = `INSERT INTO encryptAccounts (serialNumber) VALUES ('${this.serialNumber}')`;
       await DB.queryAsync(sql);
     });
     return stringEncyptAES;
   } */
  recoverPrevious() {
    try {
      Zotero.Utilities.Internal.assignProps(this, this.previousData);
    } catch (e: any) {
      showInfo(e);
      ztoolkit.log(e);
    }
  }
}

export class TranslateService {
  serviceID: string;
  charasPerTime: number;
  QPS: number;
  limitMode: string;
  charasLimit: number;
  charConsum?: number; //无需秘钥，限制用量
  dateMarker?: string | undefined;
  supportMultiParas: boolean | number;
  charasLimitFactor?: number;
  hasSecretKey: boolean | number;
  //secretKeys?: SecretKey[];
  hasToken: boolean | number;
  //accessTokens?: AccessToken[];
  accounts?: TranslateServiceAccount[];
  accountsDelete?: TranslateServiceAccount[];
  forbidden?: boolean | number;
  usable?: boolean | number;
  serialNumber?: number;
  configID?: number | undefined;
  changed?: any;
  previousData?: any;
  changedData?: any;
  loaded?: any;
  objectType?: string;
  serviceTypeID?: number;
  synced?: boolean | number;
  version?: number;
  saveDeferred?: _ZoteroTypes.DeferredPromise<void>;
  savePromise?: Promise<any>;
  totalCharConsum?: number;
  field?: string;
  region?: string;
  projectID?: string;
  vocabid?: string;

  constructor(options: {
    serviceID: string;
    charasPerTime: number;
    QPS: number;
    limitMode: string;
    charasLimit: number;
    supportMultiParas: boolean | number;
    hasSecretKey: boolean | number;
    hasToken: boolean | number;
    accounts?: TranslateServiceAccount[];
    forbidden?: boolean | number;
    serialNumber?: number;
    charasLimitFactor?: number;
    configID?: number | undefined;
    dateMarker?: string | undefined;
    field?: string | undefined;
    region?: string | undefined;
    projectID?: string | undefined;
    vocabid?: string | undefined;
  }) {
    // ["serviceID", "charasPerTime", "QPS", "limitMode", "charasLimit", "supportMultiParas", "hasSecretKey", "hasToken"]
    /*     if (["baiduModify", "baidufieldModify"].includes(options.serviceID)) {
          options.serviceID = options.serviceID.replace("Modify", "");
        } */
    this.serviceID = options.serviceID;
    this.charasPerTime = options.charasPerTime;
    this.QPS = options.QPS;
    this.limitMode = options.limitMode;
    this.charasLimit = options.charasLimit;
    this.supportMultiParas = options.supportMultiParas || false;
    this.hasSecretKey = options.hasSecretKey;
    this.hasToken = options.hasToken;
    this.dateMarker = options.dateMarker;
    this.accounts = options.accounts;
    this.forbidden = options.forbidden;
    this.serialNumber = options.serialNumber;
    this.configID = options.configID || 0;
    this.field = options.field;
    this.region = options.region;
    this.projectID = options.projectID;
    this.vocabid = options.vocabid;
    this.charasLimitFactor = options.charasLimitFactor || 1.0;
    this.serviceTypeID = this.getServiceTypeID();

    //this.ObjectsClass = addon.mountPoint['TranslateServices'];
  }

  getServiceTypeID(serviceType?: string) {
    const objectType = [
      "item",
      "collection",
      "dataObject",
      "search",
      "feedItem",
    ];
    const serviceTypes = [
      "translate",
      "ocr",
      "ocrTranslate",
      "languageIdentification",
    ];
    const translateServices = [
      "baidu",
      "baidufield",
      "tencent",
      "niutranspro",
      "caiyun",
      "youdaozhiyun",
      "cnki",
      "googleapi",
      "google",
      "deeplfree",
      "deeplpro",
      "deeplcustom",
      "deeplx",
      "microsoft",
      "gpt",
      "baiduModify",
      "baidufieldModify",
      "tencentTransmart",
      "haici",
      "youdao",
      "chatgpt",
      "azuregpt",
      "gemini",
      "aliyun",
    ];
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
      if (
        serviceCategory[k as keyof typeof serviceCategory].indexOf(
          this.serviceID,
        ) > -1
      )
        return serviceTypes.indexOf(k);
    }
  }

  recoverPrevious() {
    try {
      Zotero.Utilities.Internal.assignProps(this, this.previousData);
    } catch (e: any) {
      showInfo(e);
      ztoolkit.log(e);
    }
  }

  sqlInsertRow(tableName: string, sqlColumns: string[], sqlValues: any[]) {
    return `INSERT INTO ${tableName} (${sqlColumns.join(", ")}) VALUES (${sqlValues.map(() => "?").join()})`; //"?").join() without ","
  }

  async saveChange() {
    if (!this.changedData) return;
    const sqls: string[] = [];
    const values: any[] = [];
    const keys = Object.keys(this.changedData);
    for (const key of keys) {
      let sql;
      let tableName: string = "";
      switch (key) {
        case "charConsum":
          tableName = "charConsum";
          break;
        case "field":
        case "region":
        case "projectID":
        case "vocabid":
          tableName = "settings";
          break;
        case "dateMarker":
          tableName = "charConsum";
          break;
        case "totalCharConsum":
          tableName = "totalCharConsum";
          break;
        case "serialNumber":
        case "usable":
        case "forbidden":
          tableName = "translateServiceSN";
          break;
        case "QPS":
        case "charasPerTime":
        case "limitMode":
        case "charasLimit":
        case "configID":
        case "charasLimitFactor":
          tableName = "serviceLimits";
          break;
      }
      if (tableName == "") continue;
      if (tableName == "settings") {
        sql = `INSERT OR REPLACE INTO ${tableName} (setting, key, value) VALUES ('${this.serviceID}', '${key}', ? )`;
      } else if (tableName == "charConsum") {
        sql = `INSERT OR REPLACE INTO ${tableName} (serialNumber, charConsum) VALUES (${this.serialNumber}, ?)`;
      } else {
        sql = `UPDATE ${tableName} SET ${key} = ? WHERE serviceID = '${this.serviceID}'`;
      }
      sqls.push(sql);
      values.push(this.changedData[key]);
    }
    const DB = await getDB();
    await DB.executeTransaction(async () => {
      for (let i = 0; i < sqls.length; i++) {
        try {
          await DB.queryAsync(sqls[i], values[i]);
        } catch (e) {
          showInfo("Execute failed: " + sqls[i] + "====" + values[i]);
          throw e;
        }
      }
    });
    this.changedData = null;
  }
  async save() {
    if (this.changedData) {
      await this.saveChange();
    }
    const DB = await getDB();
    this.saveDeferred = Zotero.Promise.defer();
    this.savePromise = this.saveDeferred.promise;
    //const serialNumber = await this.getSerialNumber(this.serviceID);
    if (this.serialNumber) {
      const doSave = async () => { };
      await DB.executeTransaction(doSave.bind(this));
      //update
      return;
    }
    const doSave = async () => {
      const DB = await getDB();
      const serialNumber = await DB.getNextID(
        "translateServiceSN",
        "serialNumber",
      );

      let tableName = "translateServices";
      let sqlColumns = [
        "serviceID",
        "serviceTypeID",
        "hasSecretKey",
        "hasToken",
        "supportMultiParas",
      ];
      let sqlValues = [
        this.serviceID,
        this.serviceTypeID,
        Number(this.hasSecretKey),
        Number(this.hasToken),
        Number(this.supportMultiParas),
      ];
      await DB.queryAsync(
        this.sqlInsertRow(tableName, sqlColumns, sqlValues),
        sqlValues,
      );

      tableName = "serviceLimits";
      sqlColumns = [
        "serviceID",
        "QPS",
        "charasPerTime",
        "limitMode",
        "charasLimit",
        "charasLimitFactor",
        "configID",
      ];
      sqlValues = [
        this.serviceID,
        this.QPS,
        this.charasPerTime,
        this.limitMode,
        this.charasLimit,
        this.charasLimitFactor,
        this.configID,
      ];
      await DB.queryAsync(
        this.sqlInsertRow(tableName, sqlColumns, sqlValues),
        sqlValues,
      );
      //freeLoginServices
      if (!this.hasSecretKey && !this.hasToken) {
        tableName = "translateServiceSN";
        sqlColumns = ["serialNumber", "serviceID"];
        sqlValues = [serialNumber, this.serviceID];
        await DB.queryAsync(
          this.sqlInsertRow(tableName, sqlColumns, sqlValues),
          sqlValues,
        );

        tableName = "freeLoginServices";
        sqlColumns = ["serialNumber", "serviceID"];
        sqlValues = [serialNumber, this.serviceID];
        await DB.queryAsync(
          this.sqlInsertRow(tableName, sqlColumns, sqlValues),
          sqlValues,
        );
        return;
      }
      //without account info
      if (!this.accounts || !this.accounts.length) {
        return;
      }

      if (this.accounts.length) {
        for (const account of this.accounts) {
          sqlColumns = [
            "serialNumber",
            "serviceID",
            "appID",
            "usable",
            "forbidden",
          ];
          sqlValues = [
            serialNumber,
            this.serviceID,
            account.appID,
            account.usable,
            account.forbidden,
          ];
          tableName = "translateServiceSN";
          await DB.queryAsync(
            this.sqlInsertRow(tableName, sqlColumns, sqlValues),
            sqlValues,
          );

          sqlColumns = ["serialNumber", "serviceID", "appID"];
          sqlValues = [serialNumber, this.serviceID, account.appID];
          if (account.secretKey) {
            sqlColumns.push("secretKey");
            sqlValues.push(account.secretKey);
            tableName = "accounts";
            await DB.queryAsync(
              this.sqlInsertRow(tableName, sqlColumns, sqlValues),
              sqlValues,
            );
          }
          if (account.token) {
            sqlColumns.push("token");
            sqlValues.push(account.token);
            tableName = "accessTokens";
            await DB.queryAsync(
              this.sqlInsertRow(tableName, sqlColumns, sqlValues),
              sqlValues,
            );
          }
          tableName = "charConsum";
          sqlColumns = ["serialNumber", "charConsum"];
          sqlValues = [serialNumber, account.charConsum];
          await DB.queryAsync(
            this.sqlInsertRow(tableName, sqlColumns, sqlValues),
            sqlValues,
          );
          tableName = "totalCharConsum";
          sqlColumns = ["serialNumber"];
          sqlValues = [serialNumber];
          await DB.queryAsync(
            this.sqlInsertRow(tableName, sqlColumns, sqlValues),
            sqlValues,
          );
        }
        return;
      }
    };
    await DB.executeTransaction(doSave.bind(this));
  }

  saveold: any = Zotero.Promise.coroutine(function* (
    this: any,
    options = {},
  ): any {
    const env: any = {
      options: Object.assign({}, options),
      transactionOptions: {},
    };

    const DB = yield getDB();

    if (env.options.skipAll) {
      [
        "skipDateModifiedUpdate",
        "skipClientDateModifiedUpdate",
        "skipSyncedUpdate",
        "skipEditCheck",
        "skipNotifier",
        "skipSelect",
      ].forEach((x) => (env.options[x] = true));
    }

    const proceed = yield this._initSave(env);
    if (!proceed) return false;

    if (env.isNew) {
      ztoolkit.log("Saving data for new " + this._objectType + " to database");
    } else {
      ztoolkit.log("Updating database with new " + this._objectType + " data");
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
        result = yield DB.executeTransaction(
          async function (this: any) {
            this._saveData.call(this, env);
            await this.saveData(env);
            await this._finalizeSave.call(this, env);
            return this.finalizeSave(env);
          }.bind(this),
          env.transactionOptions,
        );
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
    } catch (e) {
      return this._recoverFromSaveError(env, e)
        .catch(function (e2: any) {
          ztoolkit.log(e2, 1);
        })
        .then(function () {
          if (env.options.errorHandler) {
            env.options.errorHandler(e);
          } else {
            ztoolkit.log(e);
          }
          throw e;
        });
    }
  });

  getServiceAccount(serialNumber: number) {
    if (!this.accounts) return;
    return this.accounts.filter(
      (account: TranslateServiceAccount) =>
        account.serialNumber == serialNumber,
    )[0];
  }
}
