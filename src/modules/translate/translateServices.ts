import {
  antServices,
  keysTranslateService,
  parasArrTranslateService,
  parasArrTranslateServiceAdd,
} from "../../utils/constant";
import { getString } from "../../utils/locale";
import { getPref } from "../../utils/prefs";
import { arrToObj, arrsToObjs, showInfo } from "../../utils/tools";
import { getCurrentserviceID } from "../addonSetting";
import { fillServiceTypes, getDB, getDBSync } from "../database/database";
import { saveNewAccount } from "../ui/tableSecretKeys";
import { TranslateService, TranslateServiceAccount } from "./translateService";

/**
 * 初始化翻译引擎
 *
 */
export async function initTranslateServices() {
  let parasArr: any[] = [];
  const DB = await getDB();
  const servicesAmount = await DB.valueQueryAsync(
    "SELECT COUNT(*) FROM translateServices",
  );
  if (!servicesAmount) {
    await fillServiceTypes();
    parasArr = parasArrTranslateService;
  }
  if (parasArrTranslateServiceAdd.length) {
    parasArr.push(...parasArrTranslateServiceAdd);
  }
  // 数据库已有翻译引擎记录则已完成初始化，
  // 如果有新添加的翻译引擎，则写入数据库
  if (parasArr.length) {
    await servicesToDB(keysTranslateService, parasArr);
  }
  const services = await getServices();
  const serviceIDs = Object.keys(services);
  parasArr = parasArrTranslateService.filter(
    (arr) => !serviceIDs.includes(arr[0] as string),
  );
  if (parasArr.length) {
    await servicesToDB(keysTranslateService, parasArr);
    return await getServices();
  }
  return services;
}

export async function servicesToDB(keys: string[], parasArr: any[]) {
  const getOptions = arrsToObjs(keys);
  const services: ServiceMap = {};
  for (const paras of parasArr) {
    const serviceID = paras[0] as string;
    if (await hasService(serviceID)) continue;
    const options: any = getOptions(paras)[0];
    const service = new TranslateService(options);
    await service.save();
    services[serviceID] = service;
  }
  return services;
}
export interface ServiceMap {
  [serviceID: string]: TranslateService;
}

export async function getServices() {
  //const plugins = await Zotero.getInstalledExtensions();
  //const pdfTranslate = plugins.find((plugin: string) => plugin.startsWith('Translate for Zotero'));
  let services = addon.mountPoint.services as ServiceMap;
  if (services) {
    //如果百度和百度领域账号不同，则更新两者后从数据库重新读取
    if (!await syncBaiduAndBaidufield(services)) {
      const res = await checkPdfTranslate();
      if (res) return res;
      /* if (!pdfTranslate) {
        const servicesLess = {};
        for (const key of Object.keys(services)) {
          if (!antServices.includes(key)) continue;
          Object.assign(servicesLess, { [key]: services[key] });
        }
        return servicesLess as ServiceMap;
      } */
      return services;
    }
  }
  services = await getServicesFromDB();
  if (!services)
    services = await servicesToDB(
      keysTranslateService,
      parasArrTranslateService,
    );
  if (!services) throw "Database Initial Error";
  addon.mountPoint.services = services;
  await getNextServiceSN();
  //如果百度和百度领域账号不同，则更新两者后从数据库重新读取
  if (await syncBaiduAndBaidufield(services)) {
    services = await getServices();
  }
  const res = await checkPdfTranslate();
  if (res) return res;
  /*  if (!pdfTranslate) {
     const servicesLess = {};
     for (const key of Object.keys(services)) {
       if (!antServices.includes(key)) continue;
       Object.assign(servicesLess, { key: services[key] });
     }
     return servicesLess as ServiceMap;
   } */
  return services;


  async function checkPdfTranslate() {
    const plugins = await Zotero.getInstalledExtensions();
    const pdfTranslate = plugins.find((plugin: string) => plugin.startsWith('Translate for Zotero'));
    if (!pdfTranslate) {
      showInfo([getString("info-zptNone"), getString("info-pdfTranslateInstall")]);
      const servicesLess = {};
      for (const key of Object.keys(services)) {
        if (!antServices.includes(key)) continue;
        Object.assign(servicesLess, { key: services[key] });
      }
      return servicesLess as ServiceMap;
    }
  }
}
export async function syncBaiduAndBaidufield(services: ServiceMap) {
  const acountsBaidu = services["baidu"].accounts;
  const acountsBaidufield = services["baidufield"].accounts;
  const savedAccounts = [];
  if (acountsBaidu?.length !== acountsBaidufield?.length) {
    const accounts = [];
    if (acountsBaidu && acountsBaidu.length) accounts.push(...acountsBaidu);
    if (acountsBaidufield && acountsBaidufield.length) accounts.push(...acountsBaidufield);

    for (const account of accounts) {
      if (acountsBaidu?.some(a => a.appID == account.appID) && acountsBaidufield?.some(a => a.appID == account.appID)) continue;
      const serviceID2 = account.serviceID == "baidu" ? "baidufield" : "baidu";
      const rowData2: any = {};
      rowData2.appID = account.appID;
      rowData2.secretKey = account.secretKey;
      rowData2.usable = account.usable;
      rowData2.charConsum = 0;
      const account2 = saveNewAccount(rowData2, serviceID2);
      await account2.save();
      savedAccounts.push(account2);
    }
  }
  if (savedAccounts.length) return true;
  return false;
}

export async function updateServices() {
  const services = await getServicesFromDB();
  if (!services) throw "Database Initial Error";
  addon.mountPoint.services = services;
  await getNextServiceSN();
  return services;
}

export async function getTranslateService(serviceID: string) {
  const services = await getServices();
  if (services) return services[serviceID];
}

export async function getServiceBySN(serialNumber: string | number) {
  const services = await getServices();
  let service;
  service = Object.values(services).filter(
    (s) => s.serialNumber == serialNumber,
  )[0];
  if (service) return service;

  //const services = addon.mountPoint.services as ServiceMap;
  const serviceWithAccount = Object.values(services).filter(s => s.accounts && s.accounts.length);
  const accounts = serviceWithAccount.map(s => s.accounts).flat(1).filter(e => e);
  service = accounts.filter(a => a && a.serialNumber == serialNumber)[0];
  if (service) return service;

  const serviceID = await getCurrentserviceID();
  service = Object.values(services).filter(
    (service) => service.serviceID == serviceID,
  )[0];

  if (service && service.accounts && service.accounts.length) {
    const account = service.accounts.find(
      (a) => a.serialNumber == serialNumber,
    );
    if (account) {
      if (account.serviceID == "baidu" || account.serviceID == "baidufield") account.serviceID = serviceID;
      return account;
    }
  }
}



export function getSerialNumberSync(serviceID: string, appID: string) {
  const service = addon.mountPoint.services[serviceID];
  if (!service || !service.accounts) return;
  const account = service.accounts.filter(
    (account: TranslateServiceAccount) => account.appID == appID,
  )[0];
  if (!account) return;
  return account.serialNumber;
}

export function getCharasLimit(serviceUsing: TranslateService) {
  let charasLimit = serviceUsing.charasLimit;
  if (charasLimit == 0) return 100000000;
  let factor = Number(getPref("charasLimitFactor"));
  // 如果不能转为数字，则为 1
  if (isNaN(factor)) {
    factor = 1;
  }
  if (factor) {
    charasLimit = serviceUsing.charasLimit * factor;
  }
  return charasLimit;
}

export async function getSerialNumber(serviceID: string, appID?: any) {
  let sql = `SELECT serialNumber FROM translateServiceSN WHERE serviceID = '${serviceID}'`;
  if (appID) sql += `AND appID = '${appID}'`;
  const DB = await getDB();
  return await DB.valueQueryAsync(sql);
}

export async function deleteAccount(serialNumber: number) {
  const sns = [serialNumber];
  const services = addon.mountPoint.services as ServiceMap;
  const serviceWithAccount = Object.values(services).filter(s => s.accounts && s.accounts.length);
  const accounts = serviceWithAccount.map(s => s.accounts).flat(1).filter(e => e);
  const service = accounts.filter(a => a && a.serialNumber == serialNumber)[0];

  if (service && service instanceof TranslateServiceAccount && service.serviceID.includes("baidu")) {
    const serviceID2 = service.serviceID == "baidu" ? "baidufield" : "baidu";
    const serialNumber2 = services[serviceID2].accounts?.filter(a => a.appID == service.appID)[0].serialNumber;
    if (serialNumber2) sns.push(serialNumber2);

  }
  const DB = getDBSync();
  if (!DB) return;
  for (const sn of sns) {
    await DB.executeTransaction(async () => {
      await DB.queryAsync(
        `DELETE FROM translateServiceSN WHERE serialNumber='${sn}'`,
      );
      await DB.queryAsync(
        `DELETE FROM accounts WHERE serialNumber='${sn}'`,
      );
      await DB.queryAsync(
        `DELETE FROM accessTokens WHERE serialNumber='${sn}'`,
      );
      await DB.queryAsync(
        `DELETE FROM charConsum WHERE serialNumber='${sn}'`,
      );
      await DB.queryAsync(
        `DELETE FROM totalCharConsum WHERE serialNumber='${sn}'`,
      );
    });
  }
  await updateServices();
}

export async function getServiceAccount(
  serviceID: string,
  serialNumber: number,
) {
  const service = await getTranslateService(serviceID);
  if (!service) return;
  return service.getServiceAccount(serialNumber);
}

export function getServiceAccountSync(serviceID: string, serialNumber: number) {
  const service = addon.mountPoint.services[serviceID];
  if (!service || !service.accounts) return;
  return service.accounts.filter(
    (account: TranslateServiceAccount) => (account.serialNumber = serialNumber),
  )[0] as TranslateServiceAccount;
}

export async function getNextServiceSN() {
  const DB = await getDB();
  addon.mountPoint.nextServiceSN = await DB.getNextID(
    "translateServiceSN",
    "serialNumber",
  );
}

export function getNextServiceSNSync() {
  return addon.mountPoint.nextServiceSN++;
}

export async function getServicesFromDB() {
  const services: ServiceMap = {};
  const DB = await getDB();
  const serviceIDs = await DB.columnQueryAsync(
    `SELECT serviceID FROM translateServices`,
  );
  for (const serviceID of serviceIDs) {
    const service = await loadServiceFromDB(serviceID);
    if (!service) continue;
    services[serviceID] = service;
  }
  return services;
}
async function hasService(serviceID: string) {
  const DB = await getDB();
  const hasService = await DB.valueQueryAsync(
    `SELECT serviceID FROM translateServices WHERE serviceID = '${serviceID}'`,
  );
  return !!hasService;
}

export async function loadServiceFromDB(serviceID: string) {
  const DB = await getDB();
  if (!(await hasService(serviceID))) return;
  //生成翻译引擎实例
  const options: any = {};
  options.serviceID = serviceID;
  const limit = await getLimit(serviceID);
  Zotero.Utilities.Internal.assignProps(options, limit);
  const setting = await getSetting(serviceID);
  if (setting) {
    Zotero.Utilities.Internal.assignProps(options, setting);
  }

  const commonProperty = await getCommonProperty(serviceID);
  if (!commonProperty) return;
  Zotero.Utilities.Internal.assignProps(options, commonProperty);
  let accountTableName;
  if (options.hasSecretKey) {
    accountTableName = "accounts";
  }
  if (options.hasToken) {
    accountTableName = "accessTokens";
  }
  if (accountTableName) {
    const accounts = await getAccounts(serviceID, accountTableName);
    options.accounts = accounts;
  }

  if (!options.hasToken && !options.hasSecretKey) {
    options.serialNumber = await DB.valueQueryAsync(
      `SELECT serialNumber FROM freeLoginServices WHERE serviceID = '${serviceID}'`,
    );
    options.forbidden ==
      (await DB.valueQueryAsync(
        `SELECT forbidden FROM translateServiceSN WHERE serviceID = '${serviceID}' AND serialNumber = ${options.serialNumber}`,
      ));
  }
  const service = new TranslateService(options);
  return service;
}
async function getLimit(serviceID: string) {
  const tableName = "serviceLimits";
  const sqlColumns = [
    "QPS",
    "charasPerTime",
    "limitMode",
    "charasLimit",
    "configID",
  ];
  const conditionField = "serviceID";
  return await getObjectFromDB(
    sqlColumns,
    tableName,
    conditionField,
    serviceID,
  );
}

async function getSetting(serviceID: string) {
  const DB = await getDB();
  const sql = `SELECT key, value FROM settings WHERE setting = '${serviceID}'`;
  const rows = await DB.queryAsync(sql);
  if (!rows) return;
  const keys = rows.map((row: any) => row["key"]);
  const values = rows.map((row: any) => row["value"]);
  return arrToObj(keys, values);
}

async function getObjectFromDB(
  sqlColumns: string[],
  tablename: string,
  conditionField: string,
  conditionFieldValue: string,
) {
  const DB = await getDB();
  const sql = `SELECT ${sqlColumns.join(", ")} FROM ${tablename} WHERE ${conditionField} = '${conditionFieldValue}'`;
  const row = await DB.rowQueryAsync(sql);
  const values = sqlColumns.map((column) => row[column]);
  return arrToObj(sqlColumns, values);
}

async function getCommonProperty(serviceID: string) {
  const DB = await getDB();
  const sqlColumns = [
    "serviceTypeID",
    "hasSecretKey",
    "hasToken",
    "supportMultiParas",
  ];
  const tableName = "translateServices";
  const sql = `SELECT ${sqlColumns.join(", ")} FROM ${tableName} WHERE serviceID = '${serviceID}'`;
  const row = await DB.rowQueryAsync(sql);
  const values = sqlColumns.map((column) => row[column]);
  const tempObj = arrToObj(sqlColumns, values);
  return tempObj;
}

async function getAccounts(serviceID: string, tableName: string) {
  if (["baiduModify", "baidufieldModify"].includes(serviceID)) {
    serviceID = serviceID.replace("Modify", "");
  }
  const DB = await getDB();
  const sqlColumns = [`${tableName}.serialNumber`, `${tableName}.appID`];
  tableName == "accounts"
    ? sqlColumns.push("secretKey")
    : sqlColumns.push("token");
  sqlColumns.push("usable", "charConsum", "dateMarker", "forbidden");
  const tableName2 = "translateServiceSN";
  const sql = `SELECT DISTINCT ${sqlColumns.join(", ")} FROM ${tableName} JOIN ${tableName2} USING (serviceID) JOIN charConsum USING (serialNumber) WHERE serviceID = '${serviceID}'`;
  //todo 删除重复账号
  const rows = await DB.queryAsync(sql);
  if (rows.length == 0) {
    //showInfo("There are no " + serviceID + " accounts in the database.");
    const sql2 = `SELECT serialNumber FROM ${tableName}  WHERE serviceID = '${serviceID}'`;
    const rowsMisMatch = await DB.queryAsync(sql2);
    if (rowsMisMatch.length) {
      showInfo(
        `There are least one serialNumber in the ${tableName} table. We will delete it in ${tableName}, charConsum and totalCharConsum.`,
      );
      // 清理 account 或 accessTokens
      const sql3 = `DELETE FROM ${tableName} WHERE serviceID = '${serviceID}'`;
      let res = await DB.queryAsync(sql3);
      // 清理 charConsum totalCharConsum
      const sql4 = `DELETE FROM charConsum  WHERE serialNumber not in (SELECT serialNumber FROM translateServiceSN)`;
      res = await DB.queryAsync(sql4);
      const sql5 = `DELETE FROM totalCharConsum  WHERE serialNumber not in (SELECT serialNumber FROM translateServiceSN)`;
      res = await DB.queryAsync(sql5);
    }
    return;
  }
  const accuntOptionsArr = dbRowsToObjs(rows, sqlColumns);
  const accounts = accuntOptionsArr?.map((accuntOptions: any) => {
    accuntOptions.serviceID = serviceID;
    return new TranslateServiceAccount(accuntOptions);
  });
  return accounts;
}

async function getAccessTokens(serviceID: string) {
  const DB = await getDB();
  if (!DB) return;
  const sqlColumns = [
    "accessTokens.serialNumber",
    "accessTokens.appID",
    "token",
    "usable",
    "charConsum",
    "dateMarker",
  ];
  const tableName = "accessTokens";
  const tableName2 = "translateServiceSN";
  const tableName3 = "charConsum";
  const sql = `SELECT ${sqlColumns.join(", ")} FROM ${tableName} JOIN ${tableName2} USING (serviceID) JOIN ${tableName3} USING (serialNumber) WHERE serviceID = '${serviceID}'`;
  const rows = await DB.queryAsync(sql);
  return dbRowsToObjs(rows, sqlColumns);
  /* const keys = sqlColumns.map((colum) => colum.split(".").pop()) as string[];
    const valuesArr = rows.map((row: any) => keys.map((column) => row[column]));
    return arrsToObjs(keys)(valuesArr); */
}

export function dbRowsToObjs(rows: any[], sqlColumns: string[]) {
  if (!rows.length) return;
  //表名和列字段组合时的分隔符为 “.”
  const keys = sqlColumns.map((colum) => colum.split(".").pop()) as string[];
  const valuesArr = rows.map((row: any) => keys.map((column) => row[column]));
  return arrsToObjs(keys)(valuesArr);
}

export function dbRowsToArray(rows: any[], sqlColumns: string[]) {
  const keys = sqlColumns.map((colum) => colum.split(".").pop()) as string[];
  const valuesArr = rows.map((row: any) => keys.map((column) => row[column]));
  return valuesArr;
}


