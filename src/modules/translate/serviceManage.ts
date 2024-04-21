import { saveJsonToDisk, showInfo } from "../../utils/tools";
import { TranslateService, TranslateServiceAccount } from "./translateService";
import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import {
  getPluginsPref,
  getPref,
  setPluginsPref,
  setPref,
} from "../../utils/prefs";
import { getSerialNumber, getServiceBySN, getServices } from "./translateServices";
import { getCurrentServiceSN, setCurrentServiceSN } from "../addonSetting";
import { decryptByAESKey, encryptState } from "../crypto";
import { getDom } from "../ui/uiTools";



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
  static async singleAccountUsableCheck(serviceID?: string, key?: string) {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const currentDay = formatter.format(date);//'04/20/2024'
    const reg = /^\d{2}/m;
    const currentMonth = String(date.getMonth() + 1);

    if (serviceID === undefined || serviceID == "" || serviceID == null) {
      const service = await getSingleServiceUnderUse();
      if (!service) {
        return;
      }
      serviceID = service.serviceID as string;
    }
    const services = await getServices();
    if (!services[serviceID].hasSecretKey) {
      return;
    }
    if (key === undefined || key == "" || key == null) {
      //key = getSingleServiceUnderUse().key as string;

      const service = await getSingleServiceUnderUse();
      if (!service) {
        return;
      }
      key = service.key as string;
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
        const key = singleAccount.secretKey || singleAccount.token;
        await this.singleAccountUsableCheck(e.serviceID, key);
      }
    }

  }

  /**
   * 获取单个秘钥对象
   * @param key_singleAccount
   * @returns
   */
  static async getAccount(serviceID: string, key_singleAccount: string) {
    const services = await getServices();

    if (
      services[serviceID] === undefined ||
      JSON.stringify(services[serviceID]) == "{}"
    ) {
      return;
    }
    if (
      key_singleAccount === undefined ||
      key_singleAccount == "" ||
      key_singleAccount == null
    ) {
      return;
    }

    const accounts = services[serviceID].accounts;
    if (!accounts || !accounts.length) return;
    for (const account of accounts) {
      let key = account.secretKey || account.token;
      if (!key) continue;
      key = await decryptKey(key);
      if (key_singleAccount.includes(key))
        return account;
    }

    /*   const singleAccount = services[serviceID].accounts?.filter(
        (e: TranslateServiceAccount) => e.secretKey == key_singleAccount || e.token == key_singleAccount
      )[0];
  
  
  
      return singleAccount; */
  }


  /* static async getAccount() {

  } */


  /**
   *
   * @returns
   */
  static async onSwitch(isPreferredSameService?: boolean) {
    await this.switchServiceKey(secretKey, plugin, serviceIDUnderUsed);

    isPreferredSameService !== undefined
      ? isPreferredSameService
      : (isPreferredSameService = getPref("isPreferredSameService") as boolean);
    const service = await getSingleServiceUnderUse();
    if (!service) return;
    const serviceKeyUnderUsed: string = service.key || "";
    const serviceIDUnderUsed = service.serviceID;

    let servicesHasKeyUsable: TranslateService[];
    const services = await getServices();
    //允许付费则忽略secretKey的usable和已经轮换过的秘钥
    if (getPref("isPay")) {
      servicesHasKeyUsable = Object.values(services).filter(
        (element) => (element.hasSecretKey || element.hasToken) && !element.forbidden,
      );
    } else {
      const servicesWithSN = Object.values(services).filter((element) => element.hasSecretKey || element.hasToken);
      servicesHasKeyUsable = [];
      const acountsUsable = [];
      for (const service of servicesWithSN) {
        if (!service.accounts || !service.accounts.length) continue;
        for (const account of service.accounts) {
          let key = account.secretKey || account.token;
          key = await decryptKey(key!);
          if (!account.usable || account.forbidden) continue;
          if (!serviceKeyUnderUsed.includes(key)) continue;//除外本轮已经切换过的秘钥
          if (!secretKeyHasSwitched.includes(key)) continue;//除外上轮已经切换过的秘钥
          servicesHasKeyUsable.push(service);
          acountsUsable.push(account);
        }
      }

      /*  servicesHasKeyUsable = Object.values(services).filter(
         (element) =>
           (element.hasSecretKey || element.hasToken) &&
           !element.forbidden &&
           element.accounts?.filter(
             (e: any) =>
               e.usable &&
               (e.secretKey || e.token) != serviceKeyUnderUsed &&
               //除外上轮已经切换过的秘钥
               !secretKeyHasSwitched?.includes(e.key),
           ).length,
       ); */
    }
    let servicesNoKeyUsable = Object.values(services).filter(
      (element) =>
        !element.hasSecretKey && !element.hasToken &&
        //除外上轮已经切换过的无秘钥翻译引擎
        //目的主要是避免死循环
        !serviceIDHasSwitched?.includes(element.serviceID),
    );
    if (getPref("isPriority") && servicePriorityWithKey.length) {
      servicesHasKeyUsable = servicePriorityWithKey.map(
        (e) => servicesHasKeyUsable.filter((e2) => e2.serviceID == e)[0],
      );
    }
    if (getPref("isPriority") && servicePriorityWithoutKey.length) {
      servicesNoKeyUsable = servicePriorityWithoutKey.map(
        (e) => servicesNoKeyUsable.filter((e2) => e2.serviceID == e)[0],
      );
    }
    const servicesPriorityArr: string[] = [];
    //优先更换同一翻译引擎的不同秘钥
    if (
      isPreferredSameService &&
      servicesHasKeyUsable.filter((e) => e.serviceID.includes(serviceIDUnderUsed))
        .length
    ) {
      const secretKeyArr: string[] = [];
      const accounts = services[serviceIDUnderUsed].accounts;
      if (!accounts || !accounts.length) return;
      for (const account of accounts) {
        let key = account.secretKey || account.token;
        if (!key) continue;
        key = await decryptKey(key!);
        if (!account.usable || account.forbidden) continue;
        if (serviceKeyUnderUsed.includes(key)) continue;
        secretKeyArr.push(account.appID + "#" + key);
      }

      /* let secretKeyArr = services[serviceIDUnderUsed].accounts?.map(e => {
        if (e.usable && e.secretKey != serviceKeyUnderUsed) {
          return e.secretKey;
        }
      },
      ); */

      const secretKey = secretKeyArr.filter(e => e)[0];




      if (secretKey != "" && secretKey !== undefined && secretKey != null) {
        await this.switchServiceKey(secretKey, plugin, serviceIDUnderUsed);
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
    useArr = useArr.filter((e) => e.serviceID != serviceIDUnderUsed);
    let serviceID = "";
    if (servicesPriorityArr.length) {
      for (const item of servicesPriorityArr) {
        Object.values(useArr).map((e) => {
          if (e.serviceID == item) {
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
      const modifyServiceIDArr = useArr.filter((e) => e.serviceID.includes("Modify"));
      if (modifyServiceIDArr.length) {
        serviceID = modifyServiceIDArr[0];
      } else {
        serviceID = useArr[0].serviceID;
      }
    }
    if (serviceID != "" && serviceID !== undefined && serviceID != null) {
      await this.switchServiceID(serviceID, plugin);
      serviceIDHasSwitched.push(serviceIDUnderUsed);
    } else {
      return false;
    }

    // 如果有秘钥，予以更换
    const secretKey = (
      useArr[0].accounts?.filter(
        (e: any) => e.usable && e.key != serviceKeyUnderUsed,
      )[0] as SecretKey
    )?.secretKey;
    if (secretKey != "" && secretKey !== undefined && secretKey != null) {
      await this.switchServiceKey(secretKey, plugin, serviceID);
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
  static async switchServiceID(serviceID: string, plugin: string) {
    await saveSingleServiceUnderUse(serviceID);
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
    const service = await getSingleServiceUnderUse();
    if (!service) return;
    showInfo(
      getString("info-switchServiceID") + service.serviceID,
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
  static async switchServiceKey(
    secretKey: string,
    plugin: string,
    serviceID?: string,
  ) {
    if (secretKey === undefined || secretKey == "") {
      return;
    }
    if (serviceID === undefined || serviceID == "" || serviceID == null) {
      const service = await getSingleServiceUnderUse();
      if (!service) return;
      serviceID = service.serviceID as string;
    }
    if (serviceID === undefined || serviceID == "" || serviceID == null) {
      serviceID = getPluginsPref(plugin, "translateSource") as string;
    }
    await saveSingleServiceUnderUse(serviceID, secretKey);
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
    showInfo(getString("info-switchServiceKey") + ": " + serviceID);
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
  static async serviceCRUD(action: string): Promise<any> {
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
                  /* service[property]?.map((e: any) => e.key as string)
                                      .some(key => (value as secretKey[]).map((secretKey: secretKey) => secretKey.key
                                      ).includes(key)) */

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
                    /* secretKey = secretKey.filter(e => !(value as secretKey[]).map((e2) => e2.key).includes(e.key));
                                        secretKey = secretKey.concat(value as secretKey[]);
                                        service["secretKey"] = secretKey; */
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
  }

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

/**
 *
 * @param serviceID
 * @param key
 */
export async function saveSingleServiceUnderUse(serviceID?: string, key?: string) {

  if (serviceID === undefined || serviceID == null || serviceID == "") {
    const service = await getSingleServiceUnderUse();
    if (!service) return;
    serviceID = service.serviceID;
    key = service.key;
  }

  const sn = await getSerialNumberByIDAndKey(serviceID, key);
  if (sn) await setCurrentServiceSN(sn.toString());

}




export async function getSerialNumberByIDAndKey(serviceID: string, key?: string) {
  const services = await getServices();
  const service = services[serviceID];
  if (!key) {
    if (service.serialNumber) return service.serialNumber;
  }
  const account = service.accounts?.filter(a => a.secretKey == key || a.token == key)[0];
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

  const serialNumber = await getCurrentServiceSN();
  const service = await getServiceBySN(serialNumber);
  if (service) {
    const serviceID = service.serviceID;
    if (!service.hasSecretKey && !service.hasToken) {
      return {
        serviceID: serviceID,
        key: undefined,
        serialNumber: serialNumber
      };
    }
    const account = service.accounts?.filter(e => e.serialNumber == serialNumber)[0];
    if (!account) return await getOne();
    const key = account.secretKey || account.token;
    const keyString = await decryptKey(key!);


    return {
      serviceID: serviceID,
      key: account?.appID + "#" + keyString,
      serialNumber: serialNumber
    };

  } else {
    return await getOne();
  }

  async function getOne() {
    const serviceOne = (await getAvilabelService("all"))!;
    const serialNumber = serviceOne.serialNumber;
    const serviceID = serviceOne.serviceID;
    let key = undefined;
    if (serviceOne instanceof TranslateServiceAccount) {
      const keyString = serviceOne.secretKey || serviceOne.token;
      if (keyString) key = await decryptKey(keyString!);

    }

    return {
      serviceID,
      key: key,
      serialNumber: serialNumber
    };
  }


}

async function decryptKey(key: string) {
  if (!key.includes('encryptAESString')) return key;
  return await decryptByAESKey(key);
  //const state = await encryptState();
  // const enableEncrypt = (getDom('setEnableEncrypt') as XUL.Checkbox).checked;
}

export async function getAvilabelService(type: "hasSN" | "noSN" | "all") {
  //const isPay = (getDom("isPay") as XUL.Checkbox).checked;
  //const isPreferredSameService = (getDom("isPreferredSameService") as XUL.Checkbox).checked;
  //const isPreferredHasSecretKey = (getDom("isPreferredHasSecretKey") as XUL.Checkbox).checked;
  //const isPriority = (getDom("isPriority") as XUL.Checkbox).checked;
  const services = await getServices();
  const avilabeleServices = Object.values(services).filter(s => !s.forbidden);
  const avilabeleServicesWhithoutSN = avilabeleServices.filter(s => !(s.hasSecretKey || s.hasToken));
  const avilabeleServiceAccounts = avilabeleServices.filter(s => s.accounts && s.accounts.length)
    .map(s => s.accounts?.filter(a => a.usable && !a.forbidden)).flat();
  const numbers = avilabeleServicesWhithoutSN.length + avilabeleServiceAccounts.length;
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
