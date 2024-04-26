export async function baidufieldModify(
  sourceText: string,
  secretKey: string,
  sourceLang?: string,
  targetLang?: string,
) {
  if (sourceLang === undefined || sourceLang == "" || sourceLang == null) {
    sourceLang = "en";
  }
  if (targetLang === undefined || targetLang == "" || targetLang == null) {
    targetLang = "zh";
  }
  const params = secretKey.split("#");
  const appid = params[0];
  const key = params[1];
  const domain = params[2];
  const salt = new Date().getTime();
  const sign = Zotero.Utilities.Internal.md5(
    appid + sourceText + salt + domain + key,
    false,
  );
  `from=${sourceLang}&to=${targetLang}`;
  const xhr = await Zotero.HTTP.request(
    "GET",
    `http://api.fanyi.baidu.com/api/trans/vip/fieldtranslate?q=${encodeURIComponent(
      sourceText,
    )}&appid=${appid}&from=${sourceLang}&to=${targetLang}&domain=${domain}&salt=${salt}&sign=${sign}`,
    {
      responseType: "json",
    },
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
    result: tgt,
    error: `${xhr.response.error_code}`,
  };
  return data;
}
