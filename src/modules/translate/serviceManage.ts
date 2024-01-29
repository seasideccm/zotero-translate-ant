import { saveJsonToDisk, showInfo } from "../../utils/tools";
import { TranslateService, services } from "./services";
import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import {
  getPluginsPref,
  getPref,
  setPluginsPref,
  setPref,
} from "../../utils/prefs";
import { fullTextTranslateService } from "../../utils/constant";

export const servicesFilename = config.addonName + "_" + "services";
const plugin = "ZoteroPDFTranslate";
const serviceIDHasSwitched: string[] = [];
const secretKeyHasSwitched: string[] = [];
export class serviceManage {
  /**
   * 检查单个秘钥是否可用
   * 消耗字符数大于字符数限制为不可用
   * 不传参数则检查当前使用的秘钥
   * @param serviceID
   * @param key
   */
  static singleSecretKeyUsableCheck(serviceID?: string, key?: string) {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const currentDay = formatter.format(date);
    const reg = /^\d{2}/m;
    const currentMonth = String(date.getMonth() + 1);

    if (serviceID === undefined || serviceID == "" || serviceID == null) {
      serviceID = getSingleServiceUnderUse().serviceID as string;
    }
    if (!services[serviceID].hasSecretKey) {
      return;
    }
    if (key === undefined || key == "" || key == null) {
      //let secrets: object = JSON.parse((getPluginsPref(plugin, "secretObj") as string) || "{}")
      key = getSingleServiceUnderUse().key as string;
    }
    const singleSecretKey = this.getSingleSecretKey(serviceID, key);
    if (!singleSecretKey) {
      return;
    }
    const limitMode = services[serviceID].limitMode;
    let factor = Number(getPref("charasLimitFactor"));
    if (isNaN(factor)) {
      factor = 0.9;
    }
    let charasLimit = services[serviceID].charasLimit;
    if (factor != undefined) {
      charasLimit = services[serviceID].charasLimit * factor;
    }
    if (limitMode == "pay" || limitMode == "noLimit") {
      return true;
    }
    if (limitMode == "total") {
      if (singleSecretKey.charConsum - 100 > charasLimit) {
        singleSecretKey.usable = false;
      } else {
        singleSecretKey.usable = true;
      }
    }
    if (limitMode == "daily" || limitMode == "month") {
      if (
        singleSecretKey.dateMarker === undefined ||
        typeof singleSecretKey.dateMarker != "string" ||
        singleSecretKey.dateMarker.length <= 2
      ) {
        //日期标志错误或未定义
        singleSecretKey.dateMarker = currentDay;
      }
    }
    if (limitMode == "month") {
      let thisMonthMarker;
      const temp = String(singleSecretKey.dateMarker!).match(reg);
      if (temp != null) {
        thisMonthMarker = temp[0].replace("0", "");
      } else {
        singleSecretKey.dateMarker = currentDay;
        thisMonthMarker = currentMonth;
      }
      if (thisMonthMarker != currentMonth) {
        //重置时间标志
        singleSecretKey.dateMarker = currentDay;
        singleSecretKey.charConsum = 0;
      }
    }
    if (limitMode == "daily") {
      if (singleSecretKey.dateMarker != currentDay) {
        //重置时间标志
        singleSecretKey.dateMarker = currentDay;
        singleSecretKey.charConsum = 0;
      }
    }
    if (singleSecretKey.charConsum - 100 > charasLimit) {
      singleSecretKey.usable = false;
    } else {
      singleSecretKey.usable = true;
    }

    updateSingleSecretKey(singleSecretKey, serviceID);
    serviceManage.syncBaiduSecretKey(serviceID);
    return singleSecretKey.usable;
  }

  static allkeyUsableCheck() {
    Object.values(services)
      .filter((e: TranslateService) => e.hasSecretKey)
      .map((t: TranslateService) => {
        if (t.secretKey?.length) {
          for (const singleSecretKey of t.secretKey!) {
            this.singleSecretKeyUsableCheck(t.id, singleSecretKey.key);
          }
        }
      });
  }

  /**
   * 获取单个秘钥对象
   * @param key_singleSecretKey
   * @returns
   */
  static getSingleSecretKey(serviceID: string, key_singleSecretKey: string) {
    if (
      services[serviceID] === undefined ||
      JSON.stringify(services[serviceID]) == "{}"
    ) {
      return;
    }
    if (
      key_singleSecretKey === undefined ||
      key_singleSecretKey == "" ||
      key_singleSecretKey == null
    ) {
      return;
    }
    const singleSecretKey: SecretKey = services[serviceID].secretKey?.filter(
      (e: any) => e.key == key_singleSecretKey,
    )[0] as SecretKey;
    return singleSecretKey;
  }

  /**
   *
   * @returns
   */
  static onSwitch(isPreferredSameService?: boolean) {
    /* const servicesHasKeyUsable = Object.values(services).filter(element => {
          element.hasSecretKey && (element.secretKey?.filter((e:any) =>{e.usable}).length)
        }); */
    isPreferredSameService !== undefined
      ? isPreferredSameService
      : (isPreferredSameService = getPref("isPreferredSameService") as boolean);
    const serviceKeyUnderUsed: string =
      (getSingleServiceUnderUse()?.key as string) || "";
    const serviceIDUnderUsed = getSingleServiceUnderUse().serviceID as string;

    let servicesHasKeyUsable: TranslateService[];
    //允许付费则忽略secretKey的usable和已经轮换过的秘钥
    if (getPref("isPay")) {
      servicesHasKeyUsable = Object.values(services).filter(
        (element) => element.hasSecretKey && !element.forbidden,
      );
    } else {
      servicesHasKeyUsable = Object.values(services).filter(
        (element) =>
          element.hasSecretKey &&
          !element.forbidden &&
          element.secretKey?.filter(
            (e: any) =>
              e.usable &&
              e.key != serviceKeyUnderUsed &&
              //除外上轮已经切换过的秘钥
              !secretKeyHasSwitched?.includes(e.key),
          ).length,
      );
    }
    let servicesNoKeyUsable = Object.values(services).filter(
      (element) =>
        !element.hasSecretKey &&
        //除外上轮已经切换过的无秘钥翻译引擎
        //目的主要是避免死循环
        !serviceIDHasSwitched?.includes(element.id),
    );
    if (getPref("isPriority") && servicePriorityWithKey.length) {
      servicesHasKeyUsable = servicePriorityWithKey.map(
        (e) => servicesHasKeyUsable.filter((e2) => e2.id == e)[0],
      );
    }
    if (getPref("isPriority") && servicePriorityWithoutKey.length) {
      servicesNoKeyUsable = servicePriorityWithoutKey.map(
        (e) => servicesNoKeyUsable.filter((e2) => e2.id == e)[0],
      );
    }
    const servicesPriorityArr: string[] = [];
    //优先更换同一翻译引擎的不同秘钥
    if (
      isPreferredSameService &&
      servicesHasKeyUsable.filter((e) => e.id.includes(serviceIDUnderUsed))
        .length
    ) {
      let secretKeyArr = services[serviceIDUnderUsed].secretKey?.map(
        (e: SecretKey) => {
          if (e.usable && e.key != serviceKeyUnderUsed) {
            return e.key;
          }
        },
      );

      secretKeyArr = secretKeyArr?.filter((e) => e !== undefined && e !== null);
      let secretKey;
      if (secretKeyArr?.length && secretKeyArr[0] !== undefined) {
        secretKey = secretKeyArr[0];
      }

      const secretkeyArr2 = services[serviceIDUnderUsed].secretKey?.filter(
        (e) => e.usable && e.key != serviceKeyUnderUsed,
      );
      let secretKey2;
      if (secretkeyArr2?.length) {
        secretKey2 = secretkeyArr2[0].key;
      }

      if (secretKey != "" && secretKey !== undefined && secretKey != null) {
        this.switchServiceKey(secretKey, plugin, serviceIDUnderUsed);
        if (
          serviceKeyUnderUsed != "" &&
          serviceKeyUnderUsed !== undefined &&
          serviceKeyUnderUsed != null
        ) {
          secretKeyHasSwitched.push(serviceKeyUnderUsed);
        }
        return true;
      }
    }
    //更换翻译引擎
    let useArr: TranslateService[] = [];
    if (getPref("isPreferredHasSecretKey")) {
      if (servicesHasKeyUsable.length) {
        useArr = servicesHasKeyUsable;
      } else {
        useArr = servicesNoKeyUsable;
      }
    } else {
      useArr = servicesNoKeyUsable.concat(servicesHasKeyUsable);
    }
    if (!useArr.length) {
      return false;
    }
    useArr = useArr.filter((e) => e.id != serviceIDUnderUsed);
    let serviceID = "";
    if (servicesPriorityArr.length) {
      for (const item of servicesPriorityArr) {
        Object.values(useArr).map((e) => {
          if (e.id == item) {
            serviceID = item;
          }
        });
        if (serviceID != "") {
          //不为空即这轮匹配到了，终止循环后继续
          break;
        }
      }
    } else {
      //优选修改版引擎
      let serviceID;
      const modifyServiceIDArr = useArr.filter((e) => e.id.includes("Modify"));
      if (modifyServiceIDArr.length) {
        serviceID = modifyServiceIDArr[0];
      } else {
        serviceID = useArr[0].id;
      }
    }
    if (serviceID != "" && serviceID !== undefined && serviceID != null) {
      this.switchServiceID(serviceID, plugin);
      serviceIDHasSwitched.push(serviceIDUnderUsed);
    } else {
      return false;
    }

    // 如果有秘钥，予以更换
    const secretKey = (
      useArr[0].secretKey?.filter(
        (e: any) => e.usable && e.key != serviceKeyUnderUsed,
      )[0] as SecretKey
    )?.key;
    if (secretKey != "" && secretKey !== undefined && secretKey != null) {
      this.switchServiceKey(secretKey, plugin, serviceID);
      if (
        serviceKeyUnderUsed != "" &&
        serviceKeyUnderUsed !== undefined &&
        serviceKeyUnderUsed != null
      ) {
        secretKeyHasSwitched.push(serviceKeyUnderUsed);
      }
    }
    return true;
  }

  /**
   * 针对 PDF Translate 更换引擎
   * @param serviceID
   * @param plugin
   */
  static switchServiceID(serviceID: string, plugin: string) {
    saveSingleServiceUnderUse(serviceID);
    if (serviceID.includes("Modify")) {
      serviceID = serviceID.replace("Modify", "");
    }
    if (serviceID == "tencentTransmart") {
      return;
    }
    const keyField = "translateSource";
    setPluginsPref(plugin, keyField, serviceID);
    if (Zotero.PDFTranslate.data.alive) {
      Zotero.PDFTranslate.hooks.onReaderTabPanelRefresh();
    }
    showInfo(
      getString("info-switchServiceID") + getSingleServiceUnderUse().serviceID,
      3000,
    );
  }

  static switchTranslateLang(langFrom: string, langTo: string) {
    setPluginsPref("ZoteroPDFTranslate", "sourceLanguage", langFrom);
    setPluginsPref("ZoteroPDFTranslate", "targetLanguage", langTo);
  }

  /**
   * 针对 PDF Translate 更换秘钥
   * @param secretKey
   * @param plugin
   */
  static switchServiceKey(
    secretKey: string,
    plugin: string,
    serviceID?: string,
  ) {
    if (secretKey === undefined || secretKey == "") {
      return;
    }
    if (serviceID === undefined || serviceID == "" || serviceID == null) {
      serviceID = getSingleServiceUnderUse()?.serviceID as string;
    }
    if (serviceID === undefined || serviceID == "" || serviceID == null) {
      serviceID = getPluginsPref(plugin, "translateSource") as string;
    }
    saveSingleServiceUnderUse(serviceID, secretKey);
    if (serviceID == "tencentTransmart") {
      return;
    }
    if (serviceID.includes("Modify")) {
      serviceID = serviceID.replace("Modify", "");
    }
    const secrets = JSON.parse(
      (getPluginsPref(plugin, "secretObj") as string) || "{}",
    );
    secrets[serviceID] = secretKey;
    setPluginsPref(plugin, "secretObj", JSON.stringify(secrets));
    showInfo(getString("info-switchServiceKey") + ": " + serviceID, 3000);
  }
  /*   static ServiceValidator(){
    
      } */
  //
  /**
   * service CRUD ( create, read, update, delete)
   * 翻译引擎增删改查
   * create 输入参数添加一个翻译引擎
   * read 依次给定翻译引擎ID和属性，
   * update 依次给定翻译引擎ID、属性、属性值，更新一项属性，
   * delete 删除一个翻译引擎
   * saveAll 将多个翻译引擎对象组成的对象转为json，写入硬盘文件中
   * @param action CRUD type ( 'create', 'read', 'update', 'delete','saveAll')
   * @param serviceID translateor ID
   * @param property service id，charasPerTime，QPS，limitMode，charasLimit，isMultiParas，hasSecretKey，secretKey?:
   * @param value data to update (string|number|boolean|object[])
   */
  static serviceCRUD(action: string): any {
    function updateServiceProperty<T extends keyof TranslateService>(
      service: TranslateService,
      property: T,
      value: TranslateService[T],
    ): void {
      service[property] = value;
    }
    switch (action) {
      case "create":
        //返回一个函数
        return (
          serviceID: string,
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
        ) => {
          services[serviceID] = new TranslateService(
            serviceID,
            charasPerTime,
            QPS,
            limitMode,
            charasLimit,
            isMultiParas,
            hasSecretKey,
            secretKey,
          );
          return;
        };
        break;
      case "read":
        // 如果没有结果就返回最后传入的参数字符串
        return (serviceID: string) => {
          const service = services[serviceID];
          if (!service) {
            return;
          }
          return (property: string) => {
            return service[property as keyof typeof service];
          };
        };
        break;
      //如为秘钥能更新一个或多个
      //注意只是更新内存中对象的值，并未写入prefs中，如果prefs限制大小，可写入磁盘
      case "update":
        return (serviceID: string) => {
          const service: TranslateService = services[serviceID];
          if (service === undefined) return;
          return (property: keyof TranslateService): Services => {
            return <T extends keyof TranslateService>(
              value: TranslateService[T] | SecretKey | SecretKey[],
            ) => {
              //<T extends keyof TranslateService>(value: TranslateService[T]|TranslateService[T][])
              //如果秘钥为空则将秘钥的值以数组形式赋值
              //如果已有秘钥，则push新秘钥到原有数组
              if (property == "secretKey") {
                //value: secretKey | secretKey[]
                if (!(value instanceof Array)) {
                  value = [value as SecretKey];
                }

                if (
                  !service["secretKey"]?.length ||
                  service[property as keyof typeof service] === undefined
                ) {
                  service["secretKey"] = value as SecretKey[];
                } else {
                  //判断原有的多个key是否有传入的多个key
                  /* service[property]?.map((e: any) => e.key as string)
                                      .some(key => (value as secretKey[]).map((secretKey: secretKey) => secretKey.key
                                      ).includes(key)) */

                  const oldKeys = service[property]?.map(
                    (e: any) => e.key as string,
                  );
                  const newKeys = value.map((e) => e.key);
                  const isHas = oldKeys?.some((e) => newKeys.includes(e));
                  const secretKey: SecretKey[] = service["secretKey"];
                  if (isHas) {
                    const temp: SecretKey[] = [];
                    // 如果输入的秘钥和原有秘钥一致，则将输入的秘钥复制给原秘钥
                    secretKey.filter((e) => {
                      (value as SecretKey[]).map((e2) => {
                        if (e.key == e2.key) {
                          if (e2.charConsum != undefined) {
                            e.charConsum = e2.charConsum;
                          }
                          if (e2.dateMarker != undefined) {
                            e.dateMarker = e2.dateMarker;
                          }
                          if (e2.usable != undefined) {
                            e.usable = e2.usable;
                          }
                        } else {
                          if (!oldKeys?.includes(e2.key)) {
                            temp.push(e2);
                          }
                        }
                      });
                    });
                    if (temp.length) {
                      secretKey.push(...temp);
                    }
                    //秘钥是引用类型，无需再赋值
                    //service["secretKey"] = secretKey;
                    //先删除旧secretKey，然后再更新，避免重复
                    /* secretKey = secretKey.filter(e => !(value as secretKey[]).map((e2) => e2.key).includes(e.key));
                                        secretKey = secretKey.concat(value as secretKey[]);
                                        service["secretKey"] = secretKey; */
                  } else {
                    secretKey.push(...(value as SecretKey[]));
                  }
                }
                //同步百度秘钥
                serviceManage.syncBaiduSecretKey(serviceID);
              } else {
                updateServiceProperty(service, property, value as any);
              }
            };
          };
        };
        break;
      //返回清理后的翻译引擎总对象
      case "delete":
        return (serviceID: string) => {
          delete services[serviceID];
        };
        break;
      case "saveAll":
        //setPref('servicesPref', JSON.stringify(services));
        saveJsonToDisk(services, servicesFilename);
        break;
      default:
        break;
    }
  }

  /**
   * 百度和修改版百度秘钥相等
   * @param serviceID
   */
  static syncBaiduSecretKey(serviceID: string) {
    if (serviceID.includes("baidu")) {
      let serviceID2 = "";
      if (serviceID.includes("Modify")) {
        serviceID2 = serviceID.replace("Modify", "");
      } else {
        serviceID2 = serviceID + "Modify";
      }
      // eslint-disable-next-line no-prototype-builtins
      if (services.hasOwnProperty(serviceID2)) {
        services[serviceID2].secretKey = services[serviceID].secretKey;
      }
    }
  }
  /**
   * 秘钥合并去重
   * @param serviceID
   */
  static mergeAndRemoveDuplicates(serviceID: string) {
    const secretkeys: SecretKey[] = [];
    const s1 = services[serviceID].secretKey;
    if (s1?.length) {
      //数组倒置，得以保留新秘钥
      s1.reverse();
      secretkeys.push(...s1);
    }
    /*  借助对象的key不可重复
        reduce() 第一个参数是函数 ()=>{}，第二个三叔是空数组 [] as secretKey[]
        函数第一个参数total，初始值即为reduce()的第二个参数空数组，用于每次循环接收结果
        循环结束 return total，即为循环结果
        next是每次循环从secretkeys取出的元素
        函数体首先判断 if (!obj[next.key])，如果秘钥不存在，进入执行语句
        对开头定义的对象 const obj = {} as any，设置一个key即秘钥，其值为 true
        然后将元素 next 放到 total数组中。
        反之，如果秘钥已经是对象的key，则进入下一次循环判断
        最终total不会有重复的值 
      */
    const obj = {} as any;
    const secretkeysingle = secretkeys.reduce((total, next) => {
      if (!obj[next.key]) {
        obj[next.key] = true;
        total.push(next);
      }
      return total;
    }, [] as SecretKey[]);
    services[serviceID]["secretKey"] = secretkeysingle.reverse();
  }
}

/**
 *
 * @param serviceID
 * @param key
 */
export function saveSingleServiceUnderUse(serviceID?: string, key?: string) {
  if (serviceID === undefined || serviceID == null || serviceID == "") {
    const obj = getSingleServiceUnderUse();
    serviceID = obj.serviceID;
    key = obj.key;
  }
  const singleServiceUnderUse = {
    serviceID: serviceID,
    key: key,
  };
  const json = JSON.stringify(singleServiceUnderUse);
  setPref("singleServiceUnderUse", json);
}
/**
 * 从prefs获取翻译引擎总对象 services
 * @returns
 */
export function getServicesInfo() {
  const json: string = getPref("servicesPref") as string;
  if (!json) {
    return;
  }
  const servicesPref: object = JSON.parse(json);
  return servicesPref;
}
/**
 * 获取当前使用的引擎对象
 * 如果是pdfTranslate的翻译引擎，返回其prefs相关信息
 * 否则返回本插件prefs的相关信息
 * @returns
 */
export function getSingleServiceUnderUse() {
  const json: string = getPref("singleServiceUnderUse") as string;

  const secrets: object = JSON.parse(
    (getPluginsPref("ZoteroPDFTranslate", "secretObj") as string) || "{}",
  );
  const serviceID = getPluginsPref(
    "ZoteroPDFTranslate",
    "translateSource",
  ) as string;
  const key = secrets[serviceID as keyof typeof secrets];
  if (!json) {
    return { serviceID: serviceID, key: key };
  }
  const singleServiceUnderUse: { serviceID: string; key?: string } =
    JSON.parse(json);
  if (fullTextTranslateService.includes(singleServiceUnderUse.serviceID)) {
    return singleServiceUnderUse;
  } else {
    return { serviceID: serviceID, key: key };
  }
}

export function updateSingleSecretKey(
  secretKey: SecretKey,
  serviceID?: string,
) {
  if (!serviceID) {
    serviceID = getSingleServiceUnderUse()?.serviceID;
  }
  serviceManage.serviceCRUD("update")(serviceID)("secretKey")(secretKey);
  serviceManage.mergeAndRemoveDuplicates(serviceID);
}

let servicePriorityWithKey: string[] = [];
let servicePriorityWithoutKey: string[] = [];
let spw = [];
let spwo = [];
const spwjson = getPref("servicePriorityWithKey") as string;
const spwojson = getPref("servicePriorityWithoutKey") as string;
if (spwjson !== undefined && spwjson != "undefined" && spwjson != "") {
  spw = JSON.parse(spwjson);
  spw = spw.filter((e: any) => e !== undefined && e != null);
}
if (spwojson !== undefined && spwojson != "undefined" && spwojson != "") {
  spwo = JSON.parse(spwojson);
  spwo = spwo.filter((e: any) => e !== undefined && e != null);
}
if (spw.length) {
  servicePriorityWithKey = spw;
}
if (spwo.length) {
  servicePriorityWithoutKey = spwo;
}
export { servicePriorityWithKey };
export { servicePriorityWithoutKey };