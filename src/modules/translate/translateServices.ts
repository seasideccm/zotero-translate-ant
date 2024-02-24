import { keysTranslateService, parasArrTranslateService, parasArrTranslateServiceAdd } from "../../utils/constant";
import { arrToObj, arrsToObjs } from "../../utils/tools";
import { fillServiceTypes, getDB } from "../database/database";
import { TranslateService, TranslateServiceAccount } from "./translateService";


export async function initTranslateServices() {
    const keys = keysTranslateService;
    const DB = await getDB();
    const serviceNumber = await DB.valueQueryAsync("SELECT COUNT(*) FROM translateServices");
    if (!serviceNumber) await fillServiceTypes();
    let parasArr = [];
    serviceNumber ? parasArr = parasArrTranslateServiceAdd : parasArr = parasArrTranslateService;
    if (parasArr.length) {
        await servicesToDB(keys, parasArr);
    }

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

const vstring = (value: string) => {
    if (typeof value != "string") return false;
    const reg = /^\s+$/m;
    if (value.match(reg)) return false;
    return true;
};
const vboolean = (value: string) => {
    return ["0", '1', "true", "false"].includes(value.toLocaleLowerCase());
};
const vNumber = (value: string) => {
    return !isNaN(Number(value));
};
export const validata = {
    "appID": vstring,
    "secretKey": vstring,
    "usable": vboolean,
    "charConsum": vNumber,
};






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

export async function getTranslateService(serviceID: string) {
    const services = await getServices();
    if (services) return services[serviceID];

}

export async function getServiceAccount(serviceID: string, serialNumber: number) {
    const service = await getTranslateService(serviceID);
    if (!service) return;
    return service.getServiceAccount(serialNumber);

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
        options.serialNumber = await DB.valueQueryAsync(`SELECT serialNumber FROM freeLoginServices WHERE serviceID = '${serviceID}'`);
        options.forbidden == await DB.valueQueryAsync(`SELECT forbidden FROM translateServiceSN WHERE serviceID = '${serviceID}' AND serialNumber = ${options.serialNumber}`);
    }
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
async function getAccounts(serviceID: string, tableName: string) {
    const DB = await getDB();
    const sqlColumns = [`${tableName}.serialNumber`, `${tableName}.appID`];
    tableName == "accounts" ? sqlColumns.push("secretKey") : sqlColumns.push("token");
    sqlColumns.push("usable", "charConsum", "dataMarker", "forbidden");

    const tableName2 = "translateServiceSN";
    const sql = `SELECT ${sqlColumns.join(", ")} FROM ${tableName} JOIN ${tableName2} USING (serviceID) JOIN charConsum USING (serialNumber) WHERE serviceID = '${serviceID}'`;
    const rows = await DB.queryAsync(sql);
    const accuntOptionsArr = dbRowsToObjs(rows, sqlColumns);
    const accounts = accuntOptionsArr?.map((accuntOptions: any) => {
        accuntOptions.serviceID = serviceID;
        return new TranslateServiceAccount(accuntOptions);
    });
    return accounts;

}


async function getAccessTokens(serviceID: string) {
    const DB = await getDB();
    const sqlColumns = ["accessTokens.serialNumber", "accessTokens.appID", "token", "usable", "charConsum", "dateMarker"];
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

function dbRowsToObjs(rows: any[], sqlColumns: string[]) {
    if (!rows.length) return;
    const keys = sqlColumns.map((colum) => colum.split(".").pop()) as string[];
    const valuesArr = rows.map((row: any) => keys.map((column) => row[column]));
    return arrsToObjs(keys)(valuesArr);
}





