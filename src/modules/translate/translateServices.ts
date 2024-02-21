import { keysTranslateService, parasArrTranslateService, parasArrTranslateServiceAdd } from "../../utils/constant";
import { arrsToObjs } from "../../utils/tools";
import { getDB } from "../database/database";
import { TranslateService } from "./translateService";

/* function getTranslateServiceFromDB() {
    const sql = "SELECT collectionID, itemID FROM collections "
        + "LEFT JOIN collectionItems USING (collectionID) "
        + "WHERE libraryID=?" + idSQL;;
} */

export async function initTranslateServices() {
    const keys = keysTranslateService;
    const DB = await getDB();
    const serviceNumber = await DB.valueQueryAsync("SELECT COUNT(*) FROM translateServices");
    let parasArr = [];
    !serviceNumber ? parasArr = parasArrTranslateService : parasArr = parasArrTranslateServiceAdd;
    if (!parasArr.length) return;
    await servicesToDB(keys, parasArr);
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

    const options: any = {};
    options.serviceID = serviceID;
    const limit = getLimit(serviceID);
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
function getLimit(serviceID: string) {

    const limit2 = {
        QPS: 0,
        charasPerTime: 0,
        limitMode: "month",
        charasLimit: 0,
        configID: 0
    };
    return limit2;


    /* const DB = await getDB();
    const sql = `SELECT QPS, charasPerTime, limitMode, charasLimit, configID, FROM serviceLimits WHERE serviceID = '${serviceID}'`;
    const result = await DB.queryAsync(sql);
    const limit = {
        QPS: result.QPS || 0,
        charasPerTime: result.charasPerTime || 0,
        limitMode: result.limitMode || "month",
        charasLimit: result.charasLimit || 0,
        configID: result.configID || 0
    };
    return limit; */
}


async function getCommonProperty(serviceID: string) {
    const DB = await getDB();
    const sqlColumns = ["serviceTypeID", "hasSecretKey", "hasToken", "supportMultiParas"];
    const tableName = "translateServices";
    const sql = `SELECT ${sqlColumns.join(", ")} FROM ${tableName} WHERE serviceID = '${serviceID}'`;
    const rows = await DB.queryAsync(sql);
    const rowqq = await DB.rowQueryAsync(sql);
    const tempObj2 = arrsToObjs(sqlColumns)(rowqq);
    const tempObj = {};

    const serviceTypeID = rows.serviceTypeID;
    const hasSecretKey = rows.hasSecretKey;
    const hasToken = rows.hasToken;
    const supportMultiParas = rows.supportMultiParas;
    return {
        serviceTypeID,
        hasSecretKey,
        hasToken,
        supportMultiParas,
    };

}
async function getSecretKeys(serviceID: string) {
    const DB = await getDB();
    const sqlColumns = ["serialNumber", "appID", "secretKey", "isAlive", "charConsum", "dateMarker"];
    const tableName = "accounts";
    const tableName2 = "translateServiceSN";
    const sql = `SELECT ${sqlColumns.join(", ")} FROM ${tableName} JOIN ${tableName2} USING (serviceID) JOIN charConsum USING (serialNumber) WHERE serviceID = '${serviceID}'`;
    const rows = await DB.rowQueryAsync(sql);
    sqlColumns[3] = "usable";
    return arrsToObjs(sqlColumns)(rows);

}
async function getAccessTokens(serviceID: string) {
    const DB = await getDB();
    const sqlColumns = ["serialNumber", "appID", "token", "isAlive", "charConsum", "dateMarker"];
    const tableName = "accessTokens";
    const tableName2 = "translateServiceSN";
    const tableName3 = "charConsum";
    const sql = `SELECT ${sqlColumns.join(", ")} FROM ${tableName} JOIN ${tableName2} USING (serviceID) JOIN ${tableName3} USING (serialNumber) WHERE serviceID = '${serviceID}'`;
    const rows = await DB.rowQueryAsync(sql);
    sqlColumns[3] = "usable";
    return arrsToObjs(sqlColumns)(rows);

}





