import { showInfo } from "../../utils/tools";
import { TranslateService, TranslateServiceAccount } from "./translateService";
import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import {
  getPluginsPref,
  getPref,
  getServiceInfoPDFTranslate,
  setPluginsPref,
} from "../../utils/prefs";
import {
  getCharasLimit,
  getServiceBySN,
  getServices,
} from "./translateServices";
import {
  getCurrentServiceSN,
  getServicesOrder,
  getSettingValue,
  setCurrentService,
} from "../addonSetting";
import { decryptByAESKey } from "../crypto";
import { updateServiceData } from "../ui/tableSecretKeys";

export const servicesFilename = config.addonName + "_" + "services";
const plugin = "ZoteroPDFTranslate";
const serviceIDHasSwitched: string[] = [];
const secretKeyHasSwitched: string[] = [];
export class serviceManage {
  static async secretKeyForPDFTranslate(account: TranslateServiceAccount) {
    const keyStr = account.secretKey || account.token;
    if (!keyStr) return;
    const secretKeyFormat = {
      niutranspro: 1,
      caiyun: 1,
      microsoft: 1,
      chatgpt: 1,
      azuregpt: 1,
      gemini: 1,
      deeplfree: 1,
      deeplpro: 1,
      deeplcustom: 1,
      aliyun: 2,
      baiduModify: 2,
      baidu: 2,
      baidufield: 3, //20201001000577901#jQMdyV80ouaYBnjHXNKs#medicine
      baidufieldModify: 3,
      tencent: 4, //secretId#SecretKey#Region(default ap-shanghai)#ProjectId(default 0)
      youdaozhiyun: 5, //appid#appsecret#vocabid(optional)
    };
    const secretKeyType = {
      KEY: 1,
      APPID_KEY: 2,
      APPID_KEY_FIELD: 3,
      APPID_KEY_REGION_PROJECTID: 4,
      APPID_KEY_VOCABID: 5,
    };

    const secretKey = await decryptKey(keyStr);
    const type =
      secretKeyFormat[account.serviceID as keyof typeof secretKeyFormat];
    const services = await getServices();
    const service = services[account.serviceID];
    if (type == void 0) return;
    const tempArr = [account.appID, secretKey];
    switch (type) {
      case secretKeyType.KEY:
        tempArr.shift();
        break;
      case secretKeyType.APPID_KEY:
        break;
      case secretKeyType.APPID_KEY_FIELD:
        if (service.field) tempArr.push(service.field);
        break;
      case secretKeyType.APPID_KEY_REGION_PROJECTID:
        if (service.region) tempArr.push(service.region);
        if (service.projectID) tempArr.push(service.projectID);
        break;
      case secretKeyType.APPID_KEY_VOCABID:
        if (service.vocabid) tempArr.push(service.vocabid);
        break;
    }
    return tempArr.join("#");
  }
  static async serviceAvailableCheck(
    service: TranslateService | TranslateServiceAccount,
    serialNumber?: string | number,
  ) {
    if (
      service instanceof TranslateService &&
      service.limitMode &&
      service.limitMode == "noLimit"
    ) {
      return true;
    }
    if (["gemini", "azuregpt", "chatgpt"].includes(service.serviceID)) {
      await this.switchServiceID(service.serviceID, plugin);
      if (service instanceof TranslateServiceAccount) {
        const keyStr = service.secretKey || service.token;
        if (keyStr) {
          const keyUsing = await decryptKey(keyStr);
          await this.switchServiceKey(keyUsing, plugin, service.serviceID);
        }
      }
      const result = await Zotero.PDFTranslate.api.translate("hello");
    }
    const services = await getServices();
    if (service instanceof TranslateServiceAccount) {
      const serviceParent = services[service.serviceID];
      if (serviceParent.limitMode && serviceParent.limitMode == "noLimit")
        return true;
    }

    const date = new Date();
    //const formatter = new Intl.DateTimeFormat("en-US", {
    //  day: "2-digit",
    //  month: "2-digit",
    //  year: "numeric",
    //});
    const currentDay = Zotero.Date.dateToSQL(date, false); //"2024-04-25 08:09:30"
    const currentMonth = date.getMonth() + 1;
    const today = date.getDate();
    const serviceID = service.serviceID;
    if (service instanceof TranslateService && !service.accounts) {
      if (service.charasLimit == 0) return true;
      if (service.charConsum && service.charConsum > getCharasLimit(service)) {
        service["usable"] = 0;
      } else {
        service["usable"] = 1;
      }
      await updateServiceData(service, "usable", service["usable"]);
      return service["usable"];
    }
    let singleAccount;
    if (
      service instanceof TranslateService &&
      service.accounts &&
      serialNumber
    ) {
      singleAccount = await getServiceBySN(serialNumber);
    }
    if (service instanceof TranslateService && service.accounts) {
      singleAccount = service.accounts[0];
    }
    if (service instanceof TranslateServiceAccount) singleAccount = service;
    if (!singleAccount) {
      return false;
    }
    const limitMode = services[serviceID].limitMode;
    if (limitMode == "pay" || limitMode == "noLimit") {
      singleAccount.usable = true;
      await updateServiceData(singleAccount, "usable", singleAccount["usable"]);
      return true;
    }

    const charasLimit = getCharasLimit(services[singleAccount.serviceID]);

    if (limitMode == "total") {
      if (
        singleAccount.totalCharConsum &&
        singleAccount.totalCharConsum - 100 > charasLimit
      ) {
        singleAccount.usable = 0;
      } else {
        singleAccount.usable = 1;
      }
      await updateServiceData(singleAccount, "usable", singleAccount["usable"]);
      return singleAccount.usable;
    }
    if (!singleAccount.dateMarker) {
      //日期标志错误或未定义
      singleAccount.dateMarker = currentDay;
      await updateServiceData(
        singleAccount,
        "dateMarker",
        singleAccount["dateMarker"],
      );
      return true;
    }
    if (limitMode == "month") {
      const month = dayOrMonth(singleAccount.dateMarker, "month");
      //跨越记账时间段则自动重置额度
      if (month && month != currentMonth) {
        //重置时间标志
        await reset(singleAccount);
        return true;
      }
    }
    if (limitMode == "daily") {
      const day = dayOrMonth(singleAccount.dateMarker, "day");
      if (day && day != today) {
        //重置时间标志
        await reset(singleAccount);
        return true;
      }
    }
    if (
      singleAccount.charConsum &&
      singleAccount.charConsum - 100 > charasLimit
    ) {
      singleAccount.usable = 0;
    } else {
      singleAccount.usable = 1;
    }
    await updateServiceData(singleAccount, "usable", singleAccount["usable"]);
    return singleAccount.usable;

    function dayOrMonth(dateMarker: string, type: "day" | "month") {
      let date;
      let month;
      let day;
      let result;
      if (
        Zotero.Date.isSQLDateTime(dateMarker) ||
        Zotero.Date.isSQLDate(dateMarker, false)
      ) {
        date = Zotero.Date.sqlToDate(dateMarker, false); // isUTC 设为 false不加 8 ，与 sqlite 一致
        if (date) {
          month = date.getMonth() + 1;
          day = date.getDate();
        }
      } else {
        const tempDate = Zotero.Date.strToDate(dateMarker);
        //@ts-ignore xxx
        month = tempDate.month + 1;
        //@ts-ignore xxx
        day = tempDate.day;
      }
      if (type == "month") {
        return month;
      } else {
        return day;
      }
    }

    async function reset(
      singleAccount: TranslateService | TranslateServiceAccount,
    ) {
      singleAccount.dateMarker = currentDay;
      singleAccount.charConsum = 0;
      singleAccount.usable = true;
      await updateServiceData(
        singleAccount,
        "dateMarker",
        singleAccount["dateMarker"],
      );
      await updateServiceData(
        singleAccount,
        "charConsum",
        singleAccount["charConsum"],
      );
      await updateServiceData(singleAccount, "usable", singleAccount["usable"]);
    }
  }

  static async allkeyUsableCheck() {
    const services = await getServices();
    /*  Object.values(services)
       .filter((e: TranslateService) => e.accounts)
       .map((t: TranslateService) => {
         if (t.accounts?.length) {
           for (const singleAccount of t.accounts!) {
             const key = singleAccount.secretKey || singleAccount.token;
             this.singleAccountUsableCheck(t.serviceID, key);
           }
         }
       }); */

    for (const e of Object.values(services)) {
      const accounts = e.accounts;
      if (!accounts || !accounts.length) continue;
      for (const singleAccount of accounts) {
        await this.serviceAvailableCheck(singleAccount);
      }
    }
  }

  /**
   * 获取单个秘钥对象
   * @param key_singleAccount
   * @returns
   */
  static async getAccount(
    serviceID: string,
    key_singleAccount?: string,
    serialNumber?: string | number,
  ) {
    const services = await getServices();

    const accounts = services[serviceID].accounts;
    if (!accounts || !accounts.length) return;
    for (const account of accounts) {
      if (serialNumber) {
        if (account.serialNumber == serialNumber) {
          return account;
        }
      } else if (key_singleAccount) {
        let key = account.secretKey || account.token;
        if (!key) continue;
        if (!key_singleAccount.includes("encryptAESString")) {
          key = await decryptKey(key);
        }
        if (key_singleAccount.includes(key)) {
          return account;
        }
      }
    }
  }

  /**
   *
   * @returns
   */
  static async onSwitch(forceSwith: boolean = false) {
    const info = "无可用引擎和账号";
    let service = await getSingleServiceUnderUse();
    if (!service) {
      showInfo(info);
      return false;
    }
    if (!(await this.serviceAvailableCheck(service)) || forceSwith) {
      const serviceNew = await switchOne(service);
      if (!serviceNew) {
        showInfo(info);
        return false;
      }
      service = serviceNew;
      setCurrentService(serviceNew.serviceID, serviceNew.serialNumber!);
    }
    await this.switchPDFTranslate(service);
    return true;

    async function switchOne(
      service: TranslateService | TranslateServiceAccount,
    ) {
      let keyStr;
      if (service instanceof TranslateServiceAccount) {
        keyStr = service.secretKey || service.token;
      }

      let servicesHasKeyUsable: TranslateService[] = [];
      const services = await getServices();
      // 允许付费时可用的引擎（需要秘钥）
      //允许付费则忽略 secretKey 的 usable 和已经轮换过的秘钥
      servicesHasKeyUsable = Object.values(services).filter(
        (element) =>
          (element.hasSecretKey || element.hasToken) && !element.forbidden,
      );
      // 禁用付费时可用的引擎（需要秘钥）
      if (!getPref("isPay")) {
        const temp = [];
        const acountsUsable = [];
        for (const service of servicesHasKeyUsable) {
          if (!service.accounts || !service.accounts.length) continue;
          for (const account of service.accounts) {
            const key = account.secretKey || account.token;
            if (!key) continue;
            if (!account.usable || account.forbidden) continue;
            if (keyStr && keyStr == key) continue; //除外本轮已经切换过的秘钥
            if (!secretKeyHasSwitched.includes(key)) continue; //除外上轮已经切换过的秘钥
            temp.push(service);
            acountsUsable.push(account);
          }
        }
        servicesHasKeyUsable = temp;
      }

      // 无秘钥引擎
      let servicesNoKeyUsable = Object.values(services).filter(
        (element) =>
          !element.hasSecretKey &&
          !element.hasToken &&
          //除外上轮已经切换过的无秘钥翻译引擎
          //目的主要是避免死循环
          !serviceIDHasSwitched?.includes(element.serviceID),
      );

      if (getPref("isPriority")) {
        // 带秘钥引擎按优先顺序排列
        const servicePriorityWithKey = await getServicesOrder();
        if (servicePriorityWithKey && servicePriorityWithKey.length) {
          servicesHasKeyUsable = servicePriorityWithKey.map(
            (e) => servicesHasKeyUsable.filter((e2) => e2.serviceID == e)[0],
          );
        }
        // 无秘钥引擎按优先顺序排列
        const servicePriorityWithoutKey = await getServicesOrder(false);
        if (servicePriorityWithoutKey && servicePriorityWithoutKey.length) {
          servicesNoKeyUsable = servicePriorityWithoutKey.map(
            (e) => servicesNoKeyUsable.filter((e2) => e2.serviceID == e)[0],
          );
        }
      }
      //优先更换同一翻译引擎的不同秘钥
      const IDUsing = service.serviceID;
      const sames = servicesHasKeyUsable.filter((e) =>
        e.serviceID.includes(IDUsing),
      ).length;
      if (getPref("isPreferredSameService") && sames) {
        const accountFilters = [];
        const accounts = services[service.serviceID].accounts;
        if (!accounts || !accounts.length) return;
        for (const account of accounts) {
          const key = account.secretKey || account.token;
          if (!key) continue;
          if (!account.usable || account.forbidden) continue;
          if (keyStr && keyStr == key) continue;
          accountFilters.push(account);
        }
        const account = accountFilters.filter((e) => e)[0];
        if (account) {
          return account;
        } else {
          showInfo("当前引擎无其他可用账号，切换为其他引擎");
        }
      }

      //更换翻译引擎
      let availableServices: TranslateService[] = [];
      if (getPref("isPreferredHasSecretKey")) {
        // 优先选择带秘钥的引擎
        if (servicesHasKeyUsable.length) {
          availableServices = servicesHasKeyUsable;
        } else {
          availableServices = servicesNoKeyUsable;
        }
      } else {
        availableServices = servicesNoKeyUsable.concat(servicesHasKeyUsable);
      }
      availableServices = availableServices.filter(
        (e) => e.serviceID != service.serviceID,
      );
      if (!availableServices.length) {
        showInfo("无可用引擎");
        return false;
      }
      return availableServices[0];
    }
  }

  static async switchPDFTranslate(
    service: TranslateService | TranslateServiceAccount,
  ) {
    //如果 PDFTranslate 账号与当前设置不一致，予以切换账号
    const IDUsing = service.serviceID;
    let keyUsing;
    const serviceInfoPDFTranslate = getServiceInfoPDFTranslate();
    const keyPDFTranslate = serviceInfoPDFTranslate.key;

    if (IDUsing != serviceInfoPDFTranslate.serviceID) {
      await this.switchServiceID(IDUsing, plugin);
    }
    // 如果 PDFTranslate 秘钥与当前设置不一致，予以切换秘钥
    if (service instanceof TranslateServiceAccount) {
      keyUsing = await this.secretKeyForPDFTranslate(service);
      if (keyUsing && keyPDFTranslate && keyUsing != keyPDFTranslate) {
        await this.switchServiceKey(keyUsing, plugin, IDUsing);
      }
    }
  }

  /**
   * 针对 PDF Translate 更换引擎
   * @param serviceID
   * @param plugin
   */
  static async switchServiceID(serviceID: string, plugin: string) {
    if (serviceID.includes("Modify")) {
      serviceID = serviceID.replace("Modify", "");
    }
    if (serviceID == "tencentTransmart") {
      return;
    }
    const keyField = "translateSource";
    const result = setPluginsPref(plugin, keyField, serviceID);
    if (Zotero.PDFTranslate.data.alive) {
      Zotero.PDFTranslate.hooks.onReaderTabPanelRefresh();
    }
    showInfo(getString("info-switchServiceID") + serviceID);
    return true;
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
  static async switchServiceKey(
    secretKey: string | undefined,
    plugin: string,
    serviceID: string,
  ) {
    if (serviceID == "tencentTransmart" || serviceID.includes("Modify")) {
      return;
    }
    if (!secretKey) {
      this.switchServiceID(serviceID, plugin);
      showInfo(getString("info-switchServiceKey") + ": " + serviceID);
      return true;
    }

    const secrets = JSON.parse(
      (getPluginsPref(plugin, "secretObj") as string) || "{}",
    );
    secrets[serviceID] = secretKey;
    setPluginsPref(plugin, "secretObj", JSON.stringify(secrets));
    showInfo(getString("info-switchServiceKey") + ": " + serviceID);
    return true;
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
   * @param property service id，charasPerTime，QPS，limitMode，charasLimit，supportMultiParas，hasSecretKey，secretKey?:
   * @param value data to update (string|number|boolean|object[])
   */
  /*   static async serviceCRUD(action: string): Promise<any> {
      const services = await getServices();
  
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
          return (option: any) => {
            return new TranslateService(option);
  
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
                value: TranslateService[T] | TranslateServiceAccount | TranslateServiceAccount[],
              ) => {
                //<T extends keyof TranslateService>(value: TranslateService[T]|TranslateService[T][])
                //如果秘钥为空则将秘钥的值以数组形式赋值
                //如果已有秘钥，则push新秘钥到原有数组
                if (property == "accounts") {
                  //value: secretKey | secretKey[]
                  if (!(value instanceof Array)) {
                    value = [value as TranslateServiceAccount];
                  }
  
                  if (
                    !service["accounts"]?.length ||
                    service[property as keyof typeof service] === undefined
                  ) {
                    service["accounts"] = value as TranslateServiceAccount[];
                  } else {
                    //判断原有的多个key是否有传入的多个key
                   // service[property]?.map((e: any) => e.key as string)
                   //                     .some(key => (value as secretKey[]).map((secretKey: secretKey) => secretKey.key
                   //                     ).includes(key))
  
                    const oldSecretKeys = service[property]?.map(
                      (e: TranslateServiceAccount) => e.secretKey as string,
                    );
                    const newKeys = value.map((e) => e.secretKey);
                    const isHas = oldSecretKeys?.some((e) => newKeys.includes(e));
                    const accounts: TranslateServiceAccount[] = service["accounts"];
                    if (isHas) {
                      const temp: TranslateServiceAccount[] = [];
                      // 如果输入的秘钥和原有秘钥一致，则将输入的秘钥复制给原秘钥
                      accounts.filter((e) => {
                        (value as TranslateServiceAccount[]).map((e2) => {
                          if (e.secretKey == e2.secretKey) {
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
                            if (e2.secretKey && !oldSecretKeys?.includes(e2.secretKey)) {
                              temp.push(e2);
                            }
                          }
                        });
                      });
                      if (temp.length) {
                        accounts.push(...temp);
                      }
                      //秘钥是引用类型，无需再赋值
                      //service["secretKey"] = secretKey;
                      //先删除旧secretKey，然后再更新，避免重复
                     //  secretKey = secretKey.filter(e => !(value as secretKey[]).map((e2) => e2.key).includes(e.key));
                     //                      secretKey = secretKey.concat(value as secretKey[]);
                     //                      service["secretKey"] = secretKey;
                    } else {
                      accounts.push(...(value));
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
    } */

  /**
   * 百度和修改版百度秘钥相等
   * @param serviceID
   */
  static async syncBaiduSecretKey(serviceID: string) {
    if (serviceID.includes("baidu")) {
      let serviceID2 = "";
      if (serviceID.includes("Modify")) {
        serviceID2 = serviceID.replace("Modify", "");
      } else {
        serviceID2 = serviceID + "Modify";
      }
      const services = await getServices();
      // eslint-disable-next-line no-prototype-builtins
      if (services.hasOwnProperty(serviceID2)) {
        services[serviceID2].accounts = services[serviceID].accounts;
      }
    }
  }
  /**
   * 秘钥合并去重
   * @param serviceID
   */
  static async mergeAndRemoveDuplicates(serviceID: string) {
    const secretkeys: TranslateServiceAccount[] = [];
    const services = await getServices();

    const s1 = services[serviceID].accounts;
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
      if (!obj[next.secretKey!]) {
        obj[next.secretKey!] = true;
        total.push(next);
      }
      return total;
    }, [] as any);
    services[serviceID]["accounts"] = secretkeysingle.reverse();
  }
}

export async function getSerialNumberByIDAndKey(
  serviceID: string,
  key?: string,
) {
  const services = await getServices();
  const service = services[serviceID];
  if (!key) {
    if (service.serialNumber) return service.serialNumber;
  }
  const account = service.accounts?.filter(
    (a) => a.secretKey == key || a.token == key,
  )[0];
  if (account && account.serialNumber) return account.serialNumber;
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
 * 如果是 PDFTranslate 插件的翻译引擎，返回其 prefs 相关信息
 * 否则返回本插件的 prefs 相关信息
 * @returns
 */
export async function getSingleServiceUnderUse() {
  let serialNumber = await getCurrentServiceSN();

  if (serialNumber === false) {
    const serviceOne = (await getAvilabelService("all"))!;
    serialNumber = serviceOne.serialNumber;
  }
  if (serialNumber === false || serialNumber === void 0) return;
  return (await getServiceBySN(serialNumber))!;
  /* if (service instanceof TranslateService) {
    const serviceID = service.serviceID;
    return {
      serviceID,
      serialNumber,
      service
    };
  }
  if (service instanceof TranslateServiceAccount) {
    const key = service.secretKey || service.token;
    if (key) {
      //const keyString = await decryptKey(key);
      return {
        serviceID: service.serviceID,
        secretKey: key,//可能加密
        serialNumber,
        account: service
      };
    }
  }
 */
}

export async function decryptKey(key: string) {
  if (!key.includes("encryptAESString")) return key;
  return await decryptByAESKey(key);
  //const state = await encryptState();
  // const enableEncrypt = (getDom('setEnableEncrypt') as XUL.Checkbox).checked;
}

export async function getAvilabelService(type: "hasSN" | "noSN" | "all") {
  const services = await getServices();
  const avilabeleServices = Object.values(services).filter((s) => !s.forbidden);
  const avilabeleServicesWhithoutSN = avilabeleServices.filter(
    (s) => !(s.hasSecretKey || s.hasToken),
  );
  const avilabeleServiceAccounts = avilabeleServices
    .filter((s) => s.accounts && s.accounts.length)
    .map((s) => s.accounts?.filter((a) => a.usable && !a.forbidden))
    .flat();
  const numbers =
    avilabeleServicesWhithoutSN.length + avilabeleServiceAccounts.length;
  const all = [...avilabeleServicesWhithoutSN, ...avilabeleServiceAccounts];
  const r = Math.floor(Math.random() * numbers);
  switch (type) {
    case "all":
      return all[r];
    case "noSN":
      return avilabeleServicesWhithoutSN[0];
    case "hasSN":
      return avilabeleServiceAccounts[0];
    default:
      return all[0];
  }
}


export async function getLang() {
  if (addon.mountPoint.langPaire) return addon.mountPoint.langPaire;

  const defaultSourceLang = await getSettingValue(
    "defaultSourceLang",
    "translate",
  );
  const defaultTargetLang = await getSettingValue(
    "defaultTargetLang",
    "translate",
  );

  const langPaire = {
    targetLang: defaultTargetLang?.split("-")[0] || "zh",
    sourceLang: defaultSourceLang?.split("-")[0] || "en",
  };
  if (!addon.mountPoint.langPaire) addon.mountPoint.langPaire = langPaire;
  return langPaire;
}


/* export function updateSingleSecretKey(
  secretKey: SecretKey,
  serviceID?: string,
) {
  if (!serviceID) {
    serviceID = getSingleServiceUnderUse()?.serviceID;
  }
  serviceManage.serviceCRUD("update")(serviceID)("secretKey")(secretKey);
  serviceManage.mergeAndRemoveDuplicates(serviceID);
} */

/* let servicePriorityWithKey: string[] = [];
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
export { servicePriorityWithoutKey }; */

/**
 * 检查单个秘钥是否可用
 * 消耗字符数大于字符数限制为不可用
 * 不传参数则检查当前使用的秘钥
 * @param serviceID
 * @param key
 */
/*   static async singleAccountUsableCheck(serviceID?: string, key?: string, serialNumber?: string | number) {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const currentDay = formatter.format(date);//'04/20/2024'
    const reg = /^\d{2}/m;
    const currentMonth = String(date.getMonth() + 1);

    if (!serviceID || serviceID == "") {
      const service = await getSingleServiceUnderUse();
      if (!service) {
        return;
      }
      serviceID = service.serviceID as string;
      if (service instanceof TranslateServiceAccount) {
        key = service.secretKey || service.token;
      }
    }
    const services = await getServices();
    const service = services[serviceID];
    if (service.hasSecretKey && !service.hasToken) {
      if (service.charasLimit == 0) return true;
      if (service.charConsum && service.charConsum > getCharasLimit(service)) return false;
      return true;
    }

    if (!key || key == "") {
      const service = await getSingleServiceUnderUse();
      if (!service) {
        return;
      }
      key = service.key || service.to;
    }
    const singleAccount = await this.getAccount(serviceID, key);
    if (!singleAccount) {
      return;
    }
    const usableOld = singleAccount.usable;
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
      singleAccount.usable = true;
      return true;
    }
    if (limitMode == "total") {
      if (singleAccount.charConsum - 100 > charasLimit) {
        singleAccount.usable = false;
      } else {
        singleAccount.usable = true;
      }
    }
    if (limitMode == "daily" || limitMode == "month") {
      if (
        singleAccount.dateMarker === undefined ||
        typeof singleAccount.dateMarker != "string" ||
        singleAccount.dateMarker.length <= 2
      ) {
        //日期标志错误或未定义
        singleAccount.dateMarker = currentDay;
      }
    }
    if (limitMode == "month") {
      let thisMonthMarker;
      const temp = String(singleAccount.dateMarker!).match(reg);
      if (temp != null) {
        thisMonthMarker = temp[0].replace("0", "");
      } else {
        singleAccount.dateMarker = currentDay;
        thisMonthMarker = currentMonth;
      }
      //跨越记账时间段则自动重置额度
      if (thisMonthMarker != currentMonth) {
        //重置时间标志
        singleAccount.dateMarker = currentDay;
        singleAccount.charConsum = 0;
      }
    }
    if (limitMode == "daily") {
      if (singleAccount.dateMarker != currentDay) {
        //重置时间标志
        singleAccount.dateMarker = currentDay;
        singleAccount.charConsum = 0;
      }
    }
    if (singleAccount.charConsum - 100 > charasLimit) {
      singleAccount.usable = false;
    } else {
      singleAccount.usable = true;
    }

    const usableNew = singleAccount.usable;
    if (usableOld != usableNew) {
      singleAccount.changedData.usable = singleAccount.usable;
      await singleAccount.save();
    }

    //updateSingleSecretKey(singleAccount, serviceID);
    // 百度修改版 直接调用百度账号信息
    //serviceManage.syncBaiduSecretKey(serviceID);
    return singleAccount.usable;
  } */
