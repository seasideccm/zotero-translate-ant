

export async function baiduModify(sourceText: string, secretKey: string, sourceLang?: string, targetLang?: string) {
  if (sourceLang === undefined || sourceLang == "" || sourceLang == null) {
    sourceLang = "en";
  }
  if (targetLang === undefined || targetLang == "" || targetLang == null) {
    targetLang = "zh";
  }
  const params = secretKey.split("#");
  const appid = params[0];
  const key = params[1];
  let action = "0";
  if (params.length >= 3) {
    action = params[2];
  }
  const salt = new Date().getTime();
  const sign = Zotero.Utilities.Internal.md5(
    appid + sourceText + salt + key,
    false
  );
  `from=${sourceLang}&to=${targetLang}`;

  // Request
  const xhr = await Zotero.HTTP.request(
    "GET",
    `http://api.fanyi.baidu.com/api/trans/vip/translate?q=${encodeURIComponent(
      sourceText
    )}&appid=${appid}&from=${sourceLang}&to=${targetLang
    }&salt=${salt}&sign=${sign}&action=${action}`,
    {
      responseType: "json",
    }
  );
  if (xhr?.status !== 200) {
    throw `Request error: ${xhr?.status}`;
  }
  // Parse
  if (xhr.response.error_code) {
    throw `Service error: ${xhr.response.error_code}:${xhr.response.error_msg}`;
  }
  let tgt = "";
  for (let i = 0; i < xhr.response.trans_result.length; i++) {
    tgt += xhr.response.trans_result[i].dst + "\n";
  }
  const data = {
    "result": tgt,
    "error": `${xhr.response.error_code}`
  };
  return data;
};
