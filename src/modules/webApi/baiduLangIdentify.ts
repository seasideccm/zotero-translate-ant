import { utf8Encode } from "../../utils/tools";

export async function langIdentify(query: string, secretKey: string) {
  const q = utf8Encode(query);
  const urlBase = "https://fanyi-api.baidu.com/api/trans/vip/language";
  const params = secretKey.split("#");
  const appid = params[0];
  const key = params[1];
  const salt = new Date().getTime();
  const sign = makeSign([appid, q, salt, key]);
  const option = {
    q,
    salt,
    sign,
    appid,
  };
  const url = makeUrl(urlBase, option);
  const xhr = await Zotero.HTTP.request("GET", url, {
    responseType: "json",
  });
  if (xhr?.status !== 200) {
    throw `Request error: ${xhr?.status}`;
  }
  // Parse
  if (xhr.response.error_code) {
    throw `Service error: ${xhr.response.error_code}:${xhr.response.error_msg}`;
  }

  return xhr.response.data.src;

  /**
   * 签名,按顺序传参
   */
  function makeSign(args: any[]) {
    const signStr = args.join("");
    return Zotero.Utilities.Internal.md5(signStr);
  }

  function makeQueryString(option: any) {
    return Object.entries(option)
      .map(
        ([k, v]) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`,
      )
      .join("&");
  }

  function makeUrl(urlPrefix: string, option: any) {
    /* Object.keys(option).forEach((key: string) => {
            urlTail += `${key}=${option[key]}&`;
        });
        urlTail.replace(/&$/m, ''); */
    return urlPrefix + "?" + makeQueryString(option);
  }
  const langSupport = {
    zh: "中文",
    en: "英语",
    jp: "日语",
    kor: "韩语",
    th: "泰语",
    vie: "越南语",
    ru: "俄语",
  };
  const code = {
    0: "成功",
    52001: "请求超时",
    52002: "系统错误",
    52003: "未授权用户",
    54000: "必填参数为空",
    54001: "签名错误",
    54003: "访问频率受限",
    54004: "账户余额不足",
    54009: "语种检测失败",
    58000: "客户端IP非法",
    58002: "服务当前已关闭",
  };
}
