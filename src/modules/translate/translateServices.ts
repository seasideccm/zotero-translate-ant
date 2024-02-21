import { keysTranslateService, parasArrTranslateService, parasArrTranslateServiceAdd } from "../../utils/constant";
import { arrToObj, arrsToObjs } from "../../utils/tools";
import { fillServiceTypes, getDB } from "../database/database";
import { TranslateService } from "./translateService";


export async function initTranslateServices() {
    const keys = keysTranslateService;
    const DB = await getDB();
    const serviceNumber = await DB.valueQueryAsync("SELECT COUNT(*) FROM translateServices");
    if (!serviceNumber) await fillServiceTypes();
    let parasArr = [];
    !serviceNumber ? parasArr = parasArrTranslateService : parasArr = parasArrTranslateServiceAdd;
    if (parasArr.length) {
        await servicesToDB(keys, parasArr);
    }

}

export async function servicesToDB(keys: string[], parasArr: any[]) {

    const getOptions = arrsToObjs(keys);
    const services: ServiceMap = {};
    /* const options = {
        serviceID: "baidu",
        charasPerTime: 5000,
        QPS: 10,
        limitMode: "month",
        charasLimit: 1000000,
        supportMultiParas: false,
        hasSecretKey: true,
        hasToken: false,
    }; */
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
    let services = addon.mountPoint.services as ServiceMap;
    if (services) return services;
    services = await getServicesFromDB();
    if (!services) services = await servicesToDB(keysTranslateService, parasArrTranslateService);
    if (!services) throw "Database Initial Error";
    addon.mountPoint.services = services;
    return services;
}


export async function getServicesFromDB() {
    const services: ServiceMap = {};
    const DB = await getDB();
    const serviceIDs = await DB.columnQueryAsync(`SELECT serviceID FROM translateServices`);
    for (const serviceID of serviceIDs) {
        const service = await loadServiceFromDB(serviceID);
        if (!service) continue;
        services[serviceID] = service;
    }
    return services;
}
async function hasService(serviceID: string) {
    const DB = await getDB();
    const hasService = await DB.valueQueryAsync(`SELECT serviceID FROM translateServices WHERE serviceID = '${serviceID}'`);
    return !!hasService;
}

export async function loadServiceFromDB(serviceID: string) {
    const DB = await getDB();
    if (!await hasService(serviceID)) return;
    //生成翻译引擎实例
    const options: any = {};
    options.serviceID = serviceID;
    const limit = await getLimit(serviceID);
    Zotero.Utilities.Internal.assignProps(options, limit);
    const commonProperty = await getCommonProperty(serviceID);
    if (!commonProperty) return;
    Zotero.Utilities.Internal.assignProps(options, commonProperty);
    if (options.hasSecretKey) {
        const secretKeys = await getSecretKeys(serviceID);
        options.secretKeys = secretKeys;
    }
    if (options.hasToken) {
        const accessTokens = await getAccessTokens(serviceID);
        options.secretKeys = accessTokens;
    }
    if (!options.hasToken && !options.hasSecretKey) {
        options.serialNumber = await DB.valueQueryAsync(`SELECT serialNumber FROM freeLoginServices WHERE serviceID = '${serviceID}'`);
    }
    options.forbidden == await DB.valueQueryAsync(`SELECT forbidden FROM translateServiceSN WHERE serviceID = '${serviceID}' AND serialNumber = ${options.serialNumber}`);
    const service = new TranslateService(options);
    return service;
}
async function getLimit(serviceID: string) {
    const tableName = "serviceLimits";
    const sqlColumns = ["QPS", "charasPerTime", "limitMode", "charasLimit", "configID"];
    const conditionField = "serviceID";
    return await getObjectFromDB(sqlColumns, tableName, conditionField, serviceID);
}

async function getObjectFromDB(sqlColumns: string[], tablename: string, conditionField: string, conditionFieldValue: string) {
    const DB = await getDB();
    const sql = `SELECT ${sqlColumns.join(", ")} FROM ${tablename} WHERE ${conditionField} = '${conditionFieldValue}'`;
    const row = await DB.rowQueryAsync(sql);
    const values = sqlColumns.map((column) => row[column]);
    return arrToObj(sqlColumns, values);
}


async function getCommonProperty(serviceID: string) {
    const DB = await getDB();
    const sqlColumns = ["serviceTypeID", "hasSecretKey", "hasToken", "supportMultiParas"];
    const tableName = "translateServices";
    const sql = `SELECT ${sqlColumns.join(", ")} FROM ${tableName} WHERE serviceID = '${serviceID}'`;
    const row = await DB.rowQueryAsync(sql);
    const values = sqlColumns.map((column) => row[column]);
    const tempObj = arrToObj(sqlColumns, values);
    return tempObj;
}
async function getSecretKeys(serviceID: string) {
    const DB = await getDB();
    const sqlColumns = ["accounts.serialNumber", "accounts.appID", "secretKey", "usable", "charConsum", "dataMarker"];
    const tableName = "accounts";
    const tableName2 = "translateServiceSN";
    const sql = `SELECT ${sqlColumns.join(", ")} FROM ${tableName} JOIN ${tableName2} USING (serviceID) JOIN charConsum USING (serialNumber) WHERE serviceID = '${serviceID}'`;
    const rows = await DB.queryAsync(sql);
    sqlColumns[0] = 'serialNumber';
    sqlColumns[1] = "appID";
    const valuesArr = rows.map((row: any) => sqlColumns.map((column) => row[column]));
    //const values = sqlColumns.map((column) => row[column]);
    //sqlColumns[3] = "usable";
    return arrsToObjs(sqlColumns)(valuesArr);

}
async function getAccessTokens(serviceID: string) {
    const DB = await getDB();
    const sqlColumns = ["serialNumber", "appID", "token", "usable", "charConsum", "dateMarker"];
    const tableName = "accessTokens";
    const tableName2 = "translateServiceSN";
    const tableName3 = "charConsum";
    const sql = `SELECT ${sqlColumns.join(", ")} FROM ${tableName} JOIN ${tableName2} USING (serviceID) JOIN ${tableName3} USING (serialNumber) WHERE serviceID = '${serviceID}'`;
    const rows = await DB.queryAsync(sql);
    const valuesArr = rows.map((row: any) => sqlColumns.map((column) => row[column]));
    return arrsToObjs(sqlColumns)(valuesArr);

}





