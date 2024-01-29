import { addonStorageDir } from "../../utils/constant";
import { getString } from "../../utils/locale";
import {
  base64ToBlob,
  fileToblob,
  readImage,
  saveImage,
} from "../../utils/tools";

export {
  baiduOcr,
  baiduOauth,
  baiduOcrAccurate,
  baiduPictureTranslate,
  LanguageType,
  BaiduOcrPictureTr,
  BaiduOcrAccurateBasic,
};

/**
 * -请使用百度 Ocr 账号
 * -image, url, pdf_file, ofd_file 四选一
 * -url 网络地址
 * -image为 base64 编码
 * -pdf_file, ofd_file 文件均需 base64 编码
 * -函数内处理 urlencode 编码
 * @param option image, url, pdf_file, ofd_file 四选一
 * @returns
 */
async function baiduOcr(
  secretKey: string,
  option: BaiduOcrAccurateBasic | BaiduOcrPictureTr,
) {
  if (secretKey.length > 50) {
    return baiduOcrAccurate(secretKey)(option as BaiduOcrAccurateBasic);
  } else {
    return baiduPictureTranslate(secretKey)(option as BaiduOcrPictureTr);
  }
}

async function baiduOauth(secretKey: string) {
  const params = secretKey.split("#");
  const appid = params[0];
  const key = params[1];
  const token_url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${appid}&client_secret=${key}`;
  const headersToken = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  //@ts-ignore has
  const tokenXhr = await Zotero.HTTP.request("POST", token_url, headersToken);
  if (tokenXhr.statusText == "OK") {
    const access_token = JSON.parse(tokenXhr.response).access_token;
    if (access_token) {
      return access_token;
    } else {
      throw "Get Access Token Failed!";
    }
  } else {
    throw `Http Request Error\nHttp Status: ${tokenXhr.status}\n${JSON.stringify(tokenXhr.response)}`;
  }
}

function baiduOcrAccurate(secretKey: string) {
  return async function doit(option: BaiduOcrAccurateBasic) {
    const access_token = await baiduOauth(secretKey);
    if (!access_token) return;
    let imgSrc = option.image;
    if (imgSrc && !imgSrc.startsWith("data:")) {
      if (imgSrc.startsWith("file:///")) {
        imgSrc = imgSrc.replace("file:///", "");
      }
      const imgData = await readImage(imgSrc);
      if (!imgData) {
        return;
      }
      imgSrc = imgData.base64 as string;
      option.image = imgSrc;
    }

    const body = Object.entries(option)
      .map(
        ([k, v]) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`,
      )
      .join("&");
    const headers = { "Content-Type": "application/x-www-form-urlencoded" };
    let url = "https://aip.baidubce.com/rest/2.0/Ocr/v1/accurate_basic";
    url = url + `?access_token=${access_token}`;
    const options = { body, headers, timeout: 30000, responseType: "json" };
    const request = await Zotero.HTTP.request("POST", url, options);
    if (request.statusText != "OK") {
      //@ts-ignore has
      throw `Http Request Error\nHttp Status: ${request.status}\n${JSON.stringify(request.data)}`;
    }
    if (!request.response["words_result"]) {
      throw JSON.stringify(request.response);
    }
    return request.response;
  };
}

/**
 * 请使用百度翻译账号
 * @param option
 */
function baiduPictureTranslate(secretKey: string) {
  return async function doit({
    image,
    translate,
    sourceLang,
    targetLang,
  }: BaiduOcrPictureTr) {
    const params = secretKey.split("#");
    const appid = params[0];
    const key = params[1];
    const salt = new Date().getTime();
    const cuid = "APICUID";
    const mac = "mac";
    const from: SourceLangPicturTr = sourceLang || "auto";
    const to: TargetLangPicturTr = targetLang || "zh";
    let file, imgPath;
    if (image.startsWith("data:")) {
      const parts = image.split(",");
      if (!parts) return;
      const ext = parts[0]
        .match(/:(.*?);/)![1]
        .split("/")
        .pop();
      file = base64ToBlob(image);
      imgPath = PathUtils.join(addonStorageDir, "tempImage." + ext);
      await saveImage(image, imgPath);
    } else {
      if (image.startsWith("file:///")) {
        image = image.replace("file:///", "").replace(/\//g, "\\");
      }
      if (!image) return;
      file = await fileToblob(image);
      imgPath = image;
    }
    if (!file || !imgPath) return;
    //const file = await IOUtils.read(pathf);
    //const file = Zotero.File.getBinaryContentsAsync(pathf);
    //文件格式读取为 blob，
    //估计百度将 blob 转为 nodejs 的 buffer类型,
    //然后计算出文件 md5，进而计算 sign 的值，
    //然后和传入的 sign 比对，完成鉴权。
    // 浏览器没有 node 环境下的 buffer 类型
    // 需要在 node 环境下计算文件的 md5 值
    const fileMD5 = await Zotero.Utilities.Internal.md5Async(imgPath);
    const sign = Zotero.Utilities.Internal.md5(
      `${appid}${fileMD5}${salt}${cuid}${mac}${key}`,
    );
    const urlTail = `?from=${from}&to=${to}&appid=${appid}&salt=${salt}&sign=${sign}&cuid=${cuid}&mac=${mac}&version=3`;
    let url = "https://fanyi-api.baidu.com/api/trans/sdk/picture";
    url = url + urlTail;
    const body = new window.FormData();
    body.append("image", file);
    const headers = { "Content-Type": "multipart/form-data" };
    const options = { body, headers, timeout: 30000, responseType: "json" };
    //@ts-ignore has
    const request = await Zotero.HTTP.request("POST", url, options);
    if (request.statusText != "OK") {
      //@ts-ignore has
      throw `Http Request Error\nHttp Status: ${request.status}\n${JSON.stringify(request.data)}`;
    }
    if (request.response.error_msg != "success") {
      throw `error_msg: ${request.response.error_msg}`;
    }
    if (!request.response.data["content"]) {
      throw JSON.stringify(request.response.data);
    }
    return request.response;
  };
}

export function extractData(response: any, apiName: ApiName, option?: any) {
  let result, target;
  if (!option) option = {};
  if (!option.translate) option.translate = true;
  if (!option.position) option.position = false;
  switch (apiName) {
    case "baiduPictureTranslate":
      result = response.data;
      target = "";
      for (const i of result["content"]) {
        target += i["src"] + "\n";
        if (option.translate) target += i["dst"] + "\n";
        if (option.translate) target += i["rect"] + "\n";
        target += "\n";
      }
      if (option.translate)
        target += `${getString("info-baiduOcrPositon")}:left、top、width、height\n`;
      return target.trim();
    case "baiduOcrAccurate":
      target = "";
      result = response.data;
      for (const i of result["words_result"]) {
        target += i["words"] + "\n";
      }
      return target.trim();
  }
}

export declare type ApiName = "baiduPictureTranslate" | "baiduOcrAccurate";
/**
 * auto:"自动检测 ",
zh:"中文 ",
en:"英语 ",
jp:"日语 ",
kor:"韩语 ",
fra:"法语 ",
spa:"西班牙语 ",
ru:"俄语 ",
pt:"葡萄牙语 ",
de:"德语 ",
it:"意大利语 ",
dan:"丹麦语 ",
nl:"荷兰语 ",
may:"马来语 ",
swe:"瑞典语 ",
id:"印尼语 ",
pl:"波兰语 ",
rom:"罗马尼亚语 ",
tr:"土耳其语 ",
el:"希腊语 ",
hu:"匈牙利语",
 */
declare type SourceLangPicturTr =
  | "auto"
  | "zh"
  | "en"
  | "jp"
  | "kor"
  | "fra"
  | "spa"
  | "ru"
  | "pt"
  | "de"
  | "it"
  | "dan"
  | "nl"
  | "may"
  | "swe"
  | "id"
  | "pl"
  | "rom"
  | "tr"
  | "el"
  | "hu";

/**
 * - zh:"中文",
- en:"英语",
- jp:"日语",
- kor:"韩语",
- fra:"法语",
- spa:"西班牙语",
- ru:"俄语",
- pt:"葡萄牙语",
- de:"德语",
- it:"意大利语",
- dan:"丹麦语",
- nl:"荷兰语",
- may:"马来语",
- swe:"瑞典语",
- id:"印尼语",
- pl:"波兰语",
- rom:"罗马尼亚语",
- tr:"土耳其语",
- el:"希腊语",
- hu:"匈牙利语",
 */
declare type TargetLangPicturTr =
  | "zh"
  | "en"
  | "jp"
  | "kor"
  | "fra"
  | "spa"
  | "ru"
  | "pt"
  | "de"
  | "it"
  | "dan"
  | "nl"
  | "may"
  | "swe"
  | "id"
  | "pl"
  | "rom"
  | "tr"
  | "el"
  | "hu";

/**
 * 识别语言类型，默认为CHN_ENG
可选值包括：
- auto_detect：自动检测语言，并识别
- CHN_ENG：中英文混合
- ENG：英文
- JAP：日语
- KOR：韩语
- FRE：法语
- SPA：西班牙语
- POR：葡萄牙语
- GER：德语
- ITA：意大利语
- RUS：俄语
- DAN：丹麦语
- DUT：荷兰语
- MAL：马来语
- SWE：瑞典语
- IND：印尼语
- POL：波兰语
- ROM：罗马尼亚语
- TUR：土耳其语
- GRE：希腊语
- HUN：匈牙利语
- THA：泰语
- VIE：越南语
- ARA：阿拉伯语
- HIN：印地语
 */
declare type LanguageType =
  | "CHN_ENG"
  | "ENG"
  | "JAP"
  | "KOR"
  | "FRE"
  | "SPA"
  | "POR"
  | "GER"
  | "ITA"
  | "RUS"
  | "DAN"
  | "DUT"
  | "MAL"
  | "SWE"
  | "IND"
  | "POL"
  | "ROM"
  | "TUR"
  | "GRE"
  | "HUN"
  | "THA"
  | "VIE"
  | "ARA"
  | "HIN";

/**
 * | 参数         | 是否必选                          | 类型   | 可选值范围 | 说明                                                         |
| ------------ | --------------------------------- | ------ | ---------- | ------------------------------------------------------------ |
| image        | 和 url/pdf_file/ofd_file 四选一   | string | -          | 图像数据，base64编码后进行urlencode，要求base64编码和urlencode后大小不超过10M，最短边至少15px，最长边最大8192px，支持jpg/jpeg/png/bmp格式 **优先级**：image > url > pdf_file > ofd_file ，当image字段存在时，url、pdf_file、ofd_file 字段失效 |
| url          | 和 image/pdf_file/ofd_file 四选一 | string | -          | 图片完整url，url长度不超过1024字节，url对应的图片base64编码后大小不超过10M，最短边至少15px，最长边最大8192px，支持jpg/jpeg/png/bmp格式 **优先级**：image > url > pdf_file > ofd_file，当image字段存在时，url字段失效 **请注意关闭URL防盗链** |
| pdf_file     | 和 image/url/ofd_file 四选一      | string | -          | PDF文件，base64编码后进行urlencode，要求base64编码和urlencode后大小不超过10M，最短边至少15px，最长边最大8192px **优先级**：image > url > pdf_file > ofd_file，当image、url字段存在时，pdf_file字段失效 |
| pdf_file_num | 否                                | string | -          | 需要识别的PDF文件的对应页码，当 pdf_file 参数有效时，识别传入页码的对应页面内容，若不传入，则默认识别第 1 页 |
| ofd_file     | 和 image/url/pdf_file 四选一      | string | -          | OFD文件，base64编码后进行urlencode，要求base64编码和urlencode后大小不超过10M，最短边至少15px，最长边最大8192px **优先级**：image > url > pdf_file > ofd_file，当image、url、pdf_file字段存在时，ofd_file字段失效 |
| ofd_file_num | 否                                | string | -          | 需要识别的OFD文件的对应页码，当 ofd_file 参数有效时，识别传入页码的对应页面内容，若不传入，则默认识别第 1 页 |
| detect_direction | 否   | string | true/false | 是否检测图像朝向，默认不检测，即：false。朝向是指输入图像是正常方向、逆时针旋转90/180/270度。可选值包括: - true：检测朝向； - false：不检测朝向 |
| paragraph        | 否   | string | true/false | 是否输出段落信息                                             |
| probability      | 否   | string | true/false | 是否返回识别结果中每一行的置信度                             |
 */
declare type BaiduOcrAccurateBasic = {
  image?: string;
  url?: string;
  pdf_file?: string;
  ofd_file?: string;
  language_type?: LanguageType;
  detect_direction?: string;
  paragraph?: string;
  pdf_file_num?: string;
  ofd_file_num?: string;
  probability?: string;
};
declare type BaiduOcrPictureTr = {
  image: string;
  translate?: boolean;
  sourceLang?: SourceLangPicturTr;
  targetLang?: TargetLangPicturTr;
};

/*     const bodyProps = {
        language_type: language,
        detect_direction: detectDirection,
        paragraph: paragraph,
        image: base64,
        url: url,
        pdf_file: pdfFile,
        pdf_file_num: pdfFileNum,
        ofd_file: ofdFile,
        ofd_file_num: ofdFileNum,
        probability: probability,
    }; */
