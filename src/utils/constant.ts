import { config } from "../../package.json";



export const ENCRYPT_KEYS = ["secretKey", "token"];

export const EmptyValue = "No Data";
//该值用于替换输入框内容，故应为 string
export const DEFAULT_VALUE = {
  usable: '1',
  charConsum: '0',
  forbidden: '0',
  secretKey: 'secretKey',

};
export const keysTranslateService = ["serviceID", "charasPerTime", "QPS", "limitMode", "charasLimit", "supportMultiParas", "hasSecretKey", "hasToken"];
export const parasArrTranslateService = [
  ["baidu", 5000, 10, "month", 1000000, false, true, false,],
  ["baidufield", 5000, 10, "month", 500000, false, true, false,],
  ["niutranspro", 5000, 50, "daily", 200000, true, true, false,],
  ["caiyun", 5000, 50, "month", 1000000, false, true, false,],
  ["youdaozhiyun", 5000, 200, "total", 500000, false, true, false,],
  ["cnki", 1000, 5, "noLimit", 0, false, false, false,],
  ["googleapi", 5000, 5, "noLimit", 0, true, false, false,],
  ["google", 5000, 5, "noLimit", 0, true, false, false,],
  ["deeplfree", 3000, 3, "month", 500000, true, true, false,],
  ["deeplx", 3000, 3, "month", 500000, true, false, false,],
  ["microsoft", 50000, 10, "month", 2000000, false, true, false,],
  ["baiduModify", 5000, 10, "month", 1000000, true, true, false,],
  ["baidufieldModify", 5000, 10, "month", 500000, true, true, false,],
  ["tencentTransmart", 5000, 20, "noLimit", 0, false, false, false,],
  ["tencent", 2000, 5, "month", 5000000, true, true, false,],
  ["haici", 600, 10, "noLimit", 0, false, false, false,],
  ["youdao", 2000, 5, "noLimit", 0, false, false, false,],

];


//有新增时加入 example:= [["tencent", 2000, 5, "month", 5000000, true, true, false,]];
export const parasArrTranslateServiceAdd = [];

export const syncConfig = {
  SYNC_ITEM_TITLE_PREFIX: "sqliteDatabase",
  SYNC_COLLECTION_NAME: "addonDatabase"
};

export const addonDir = PathUtils.join(Zotero.DataDirectory.dir, config.addonRef);

export const msg = {
  SCHEMA_NEED_REPAIR: "Addon Database Schema Needs To Be Repaired",
  SCHEMA_SUCCESS_REPAIRED: "Addon Database Schema Repaired Success"
};
export const addonStorageDir = PathUtils.join(
  Zotero.getStorageDirectory().path,
  config.addonName,
);

export const addonDatabaseDir = PathUtils.join(
  Zotero.DataDirectory.dir,
  config.addonRef,
);
export const { OS } = Components.utils.import(
  "resource://gre/modules/osfile.jsm",
);

//@ts-ignore has
/* export const schemaConfig = {
  addonSystem: {
    path: `chrome://${config.addonRef}/content/schema/addonSystem.sql`,
    version: 1,
  },
  apiAccount: {
    path: `chrome://${config.addonRef}/content/schema/apiAccount.sql`,
    version: 1,
  },
  translation: {
    path: `chrome://${config.addonRef}/content/schema/translation.sql`,
    version: 1,
  },
  triggers: {
    path: `chrome://${config.addonRef}/content/schema/triggers.sql`,
    version: 1,
  },
}; */


//export const schemaConfigTest = __schemaConfig__;

export const svgPrefix = "data:image/svg+xml,";
//缺少</path>不显示svg,
//分割符为空格，不是逗号
//单引号替换 " 引号，
//fill='red' 颜色不能用#xxx
export const ocrIconSvg =
  svgPrefix +
  `<svg viewBox='0 0 1024 1024' version='1.1' xmlns='http://www.w3.org/2000/svg'><path d='M1022.54 731.84v182.08c0 60.23-49.01 109.25-109.25 109.25H694.81c-20.14 0-36.42-16.28-36.42-36.42s16.28-36.42 36.42-36.42H913.3c20.1 0 36.42-16.31 36.42-36.41V731.84c0-20.14 16.27-36.42 36.42-36.42 20.13 0 36.4 16.28 36.4 36.42zM294.07 950.33H111.99c-20.06 0-36.41-16.31-36.41-36.41V731.84c0-20.14-16.31-36.42-36.42-36.42-20.1 0-36.41 16.28-36.41 36.42v182.08c0 60.23 49.01 109.25 109.24 109.25h182.08c20.1 0 36.42-16.28 36.42-36.42s-16.32-36.42-36.42-36.42zM38.16 328.1c20.1 0 36.42-16.31 36.42-36.41V109.61c0-20.07 16.35-36.42 36.41-36.42h182.08c20.1 0 36.42-16.31 36.42-36.41 0-20.1-16.31-36.42-36.42-36.42H110.99C50.76 0.36 1.75 49.38 1.75 109.61v182.08c0 20.1 16.31 36.41 36.41 36.41zM914.3 0.36H695.81c-20.14 0-36.42 16.31-36.42 36.42 0 20.1 16.28 36.41 36.42 36.41H914.3c20.1 0 36.42 16.35 36.42 36.42v182.08c0 20.1 16.27 36.41 36.42 36.41 20.14 0 36.41-16.31 36.41-36.41V109.61C1023.54 49.38 974.53 0.36 914.3 0.36zM383.4 509.78c0 97.6-55.2 156-136.4 156s-136.4-58.4-136.4-156 55.2-152.8 136.4-152.8 136.4 55.6 136.4 152.8z m-72.8 0c0-57.6-24.4-91.6-63.6-91.6s-63.2 34-63.2 91.6c0 58 24 94.4 63.2 94.4s63.6-36.4 63.6-94.4z m246.8 94.4c-42 0-69.2-34.4-69.2-93.6 0-58 31.6-92.4 70-92.4 21.2 0 36.8 9.6 51.6 23.2l37.6-45.6c-20.4-20.8-51.6-38.8-90.4-38.8-75.6 0-142 56.8-142 156 0 100.8 64 152.8 139.6 152.8 38.8 0 72-14.8 97.2-44l-37.6-44.8c-14 15.2-33.2 27.2-56.8 27.2z m302.4-62l66.4 118h-80l-54.8-104.8H757v104.8h-71.6v-297.6h109.2c63.6 0 116.4 21.6 116.4 93.6 0 43.6-20.4 71.6-51.2 86z m-18.8-86c0-28-18-37.2-52-37.2h-32v80h32c34 0 52-14.8 52-42.8z' fill='red'></path></svg>`;

export const zIcon =
  svgPrefix +
  `<svg viewBox='0 0 108 32' xmlns='http://www.w3.org/2000/svg'><path d='M51.659 8.863h-5.67V20.456a6.294 6.294 0 0 0 0.21 1.785 2.52 2.52 0 0 0 0.589 1.071 2.019 2.019 0 0 0 0.9.525 4.237 4.237 0 0 0 1.155.146 5.479 5.479 0 0 0 1.47-.209 6.806 6.806 0 0 0 1.386-.546l.126 2.562a8.907 8.907 0 0 1-3.738.714 6.99 6.99 0 0 1-1.659-.21 3.912 3.912 0 0 1-1.575-.8 4.392 4.392 0 0 1-1.176-1.6 6.409 6.409 0 0 1-.462-2.646V8.863H39.059V6.344h4.158V.8h2.772V6.344h5.67Z'></path></svg>`;

export const addonIconSvg =
  svgPrefix +
  `<svg viewBox='0 0 60.7711 97.5084' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'>
<path d='M18.3293 3.24209C19.5293 6.04209 22.1585 12.9128 22.4919 14.9128C22.4275 15.299 22.2786 15.7448 22.028 16.0084L20.9503 16.0084C20.6731 15.806 20.3548 15.4572 19.9919 14.9128C18.3919 12.5128 13.6919 6.81282 12.4919 4.41282C12.0027 3.43456 11.8293 2.75536 11.8293 2.29396C11.8293 1.62337 12.1957 1.41281 12.4919 1.41281C13.9377 0.855904 17.1293 0.442085 18.3293 3.24209ZM8.57267 8.59183C10.3471 10.406 14.3411 14.9277 15.0105 16.3397C15.0001 16.5162 14.9596 16.7143 14.878 16.8987C14.5986 17.5294 13.838 17.9996 12.1564 16.8945C9.98309 15.4663 3.79405 12.2741 2.07743 10.7571C1.26982 10.0434 0.999863 9.53247 0.999863 9.17988C0.999863 8.78302 1.34186 8.5868 1.64414 8.52805C3.21432 7.7934 6.79828 6.77766 8.57267 8.59183ZM11.0693 38.2764C10.4577 37.9341 9.71523 37.5147 8.82929 37.0084C8.60949 34.8104 8.48631 32.8297 8.48631 31.0347C8.48631 30.1164 8.51854 29.2467 8.58656 28.4213L8.58655 28.4029C8.58655 20.886 15.3727 17.8078 18.3293 17.0084C18.4233 16.983 18.5189 16.9571 18.6159 16.9308C21.5742 16.1288 25.8928 14.9581 27.8293 16.3397C31.8293 18.0747 33.8293 21.5084 34.3293 23.0084C34.3969 23.4981 34.461 23.9341 34.5191 24.3301C34.6987 25.553 34.8222 26.3938 34.8222 27.2527C34.8222 28.1602 34.6844 29.0881 34.3293 30.5084C34.0158 31.7623 32.6852 33.1594 30.9653 34.4954C31.3842 34.234 32.0347 34.0084 33.3293 34.0084C33.6286 34.0084 33.8922 34.0057 34.1275 34.0034C35.858 33.9859 36.0688 33.9838 37.8293 35.1657C39.8293 36.5084 39.2293 35.9084 40.8293 39.5084C42.4293 43.1084 43.3293 46.0084 43.3293 47.5084C43.3293 49.0084 43.3293 51.0084 42.1035 53.1566C42.6832 52.586 44.3248 51.6517 48.3293 53.0084C48.7967 53.159 49.1128 53.2014 49.8293 53.5084C50.9095 53.9714 52.0195 55.3361 53.0444 56.3616C54.348 57.666 55.5139 59.2302 56.306 60.5583C56.5054 60.8926 56.6811 61.212 56.8293 61.5084C57.9337 63.7173 58.4452 64.6555 59.1433 67.2857C59.2038 67.5133 59.2656 67.7536 59.3293 68.0084C59.6554 69.3127 59.771 71.5475 59.771 74.0083C59.771 74.3756 59.7684 74.7478 59.7636 75.1228C59.7214 78.3996 59.3293 83.0084 57.8293 85.0084C57.6851 85.1526 57.6282 85.0972 57.3833 84.8582C57.0621 84.5448 56.4177 83.9161 54.8293 83.0084C53.9952 82.5318 52.9659 82.0285 51.8471 81.504C49.2101 80.2675 46.076 78.9126 43.8293 77.5084C42.2173 76.5009 40.7068 75.8741 39.349 74.9887C38.0113 74.1165 36.8218 72.9934 35.8293 71.0084C35.6899 70.7296 35.5354 70.3878 35.3709 69.9998C35.3912 69.9935 35.4052 69.989 35.4052 69.9884C35.4052 69.988 35.395 69.9904 35.3698 69.9973L35.3692 69.9959C34.6286 68.2492 33.683 65.5679 32.9771 63.4719C32.8868 63.2038 32.8637 63.1983 32.8637 63.2786C32.8637 63.3228 32.8707 63.393 32.8774 63.4597C32.8786 63.4719 32.8798 63.4839 32.8809 63.4956C32.8855 63.5422 32.8891 63.5842 32.8891 63.6103C32.8891 63.6604 32.8757 63.6526 32.8293 63.5084C32.8293 60.7084 33.6626 58.0084 34.3293 58.0084L34.9509 57.7598C33.8611 58.0941 33.3253 57.8644 31.474 57.0705C31.4267 57.0502 31.3784 57.0295 31.3293 57.0084C30.5603 56.6788 29.9497 56.4926 29.427 56.3129C28.2187 55.8975 27.4806 55.5173 26.3422 53.4826C26.1802 53.193 26.01 52.8699 25.8293 52.5084C24.2381 49.326 23.09 46.3335 23.09 43.8331C23.09 43.1907 23.1658 42.5807 23.3293 42.0084C23.8634 40.1389 25.6161 38.314 27.2181 37.0099C25.4741 38.0465 23.7513 38.9273 22.4919 39.5084C20.8537 40.3017 19.2834 40.5968 17.9015 40.6121L12.3293 42.5084L13.3293 39.5084C13.1014 39.3945 12.3907 39.0157 11.0693 38.2764ZM30.5544 34.808C30.3936 34.9279 30.23 35.0472 30.0641 35.1657C30.2503 35.0775 30.3923 34.9483 30.5544 34.808Z' fill-rule='evenodd' fill='red'></path>
<path d='M22.028 16.0084C21.7768 16.2726 21.4234 16.3537 20.9503 16.0084C20.6731 15.806 20.3548 15.4572 19.9919 14.9128C18.3919 12.5128 13.6919 6.81282 12.4919 4.41282C11.2919 2.01281 11.9919 1.41281 12.4919 1.41281C13.9377 0.855904 17.1293 0.442085 18.3293 3.24209C19.5293 6.04209 22.1585 12.9128 22.4919 14.9128C22.4275 15.299 22.2786 15.7448 22.028 16.0084M15.0105 16.3397C15.0001 16.5162 14.9596 16.7143 14.878 16.8987C14.5986 17.5294 13.838 17.9996 12.1564 16.8945C9.98309 15.4663 3.79405 12.2741 2.07743 10.7571C0.360806 9.24016 1.07331 8.639 1.64414 8.52805C3.21432 7.7934 6.79828 6.77766 8.57267 8.59183C10.3471 10.406 14.3411 14.9277 15.0105 16.3397ZM17.3293 27.5084C18.3293 22.0084 22.8293 22.0084 23.8293 27.5084M13.3293 39.5084L12.3293 42.5084L17.9015 40.6121M27.2181 37.0099C28.1854 36.4349 29.1592 35.812 30.0641 35.1657C32.207 33.6352 33.9629 31.9739 34.3293 30.5084C35.1293 27.3084 34.8265 26.6084 34.3293 23.0084C33.8293 21.5084 31.8293 18.0747 27.8293 16.3397C25.8293 14.9128 21.2883 16.2084 18.3293 17.0084C15.3703 17.8084 8.57545 20.891 8.58656 28.4213C8.38557 30.8603 8.49705 33.686 8.82929 37.0084C9.71523 37.5147 10.4577 37.9341 11.0693 38.2764C12.3907 39.0157 13.1014 39.3945 13.3293 39.5084C14.1338 40.0112 15.7995 40.6354 17.9015 40.6121C19.2834 40.5968 20.8537 40.3017 22.4919 39.5084C23.7513 38.9273 25.4741 38.0465 27.2181 37.0099M30.0641 35.1657C30.7316 34.8495 30.8293 34.0084 33.3293 34.0084C35.8293 34.0084 35.8293 33.823 37.8293 35.1657C39.8293 36.5084 39.2293 35.9084 40.8293 39.5084C42.4293 43.1084 43.3293 46.0084 43.3293 47.5084C43.3293 49.0084 43.3293 51.0084 42.1035 53.1566M42.1035 53.1566C42.0201 53.2669 41.9292 53.3835 41.8293 53.5084C40.2293 55.5084 39.6293 55.8084 36.8293 57.0084C35.9982 57.3646 35.4226 57.615 34.9509 57.7598M29.427 56.3129C28.2187 55.8975 27.4806 55.5173 26.3422 53.4826C26.1802 53.193 26.01 52.8699 25.8293 52.5084C23.8293 48.5084 22.5293 44.8084 23.3293 42.0084C23.8634 40.1389 25.6161 38.314 27.2181 37.0099C28.0154 36.3608 28.7754 35.8407 29.3293 35.5084C29.5665 35.4135 29.7984 35.2915 30.0641 35.1657M48.3293 53.0084C48.7967 53.159 49.1128 53.2014 49.8293 53.5084C50.9095 53.9714 52.0195 55.3361 53.0444 56.3616C54.348 57.666 55.5139 59.2302 56.306 60.5583C56.5054 60.8926 56.6811 61.212 56.8293 61.5084C57.9337 63.7173 58.4452 64.6555 59.1433 67.2857C59.2038 67.5133 59.2656 67.7536 59.3293 68.0084C59.704 69.5074 59.8009 72.2352 59.7636 75.1228C59.7214 78.3996 59.3293 83.0084 57.8293 85.0084C57.496 85.3417 57.6293 84.6084 54.8293 83.0084C53.9952 82.5318 52.9659 82.0285 51.8471 81.504C49.2101 80.2675 46.076 78.9126 43.8293 77.5084C42.2173 76.5009 40.7068 75.8741 39.349 74.9887M35.3692 69.9959C34.6286 68.2492 33.683 65.5679 32.9771 63.4719C32.8281 63.0293 32.8621 63.3024 32.8809 63.4956C32.8942 63.6315 32.8999 63.7279 32.8293 63.5084C32.8293 60.7084 33.6626 58.0084 34.3293 58.0084L34.9509 57.7598L36.8293 57.0084M29.8293 43.5084L26.8293 52.5084L26.3422 53.4826M26.3422 53.4826L25.8293 54.5084L11.3293 54.5084L6.32929 49.0084M40.1888 65.0084L27.8293 78.5084L31.8293 96.5084L24.3293 96.5084M45.3293 69.0084L40.1888 74.1489L39.349 74.9887L35.3293 79.0084L43.8293 96.5084L36.8293 96.5084M32.8293 49.5084L29.427 56.3129L27.8293 59.5084L14.8293 63.5084L5.32929 59.5084M22.3293 16.0084L22.028 16.0084L20.9503 16.0084M14.878 16.8987L14.3293 17.0084M34.9509 57.7598C33.8332 58.1027 33.2982 57.8522 31.3293 57.0084C30.5603 56.6788 29.9497 56.4926 29.427 56.3129M59.8293 75.0084C59.8074 75.0467 59.7855 75.0849 59.7636 75.1228M59.7636 75.1228C57.7882 78.5469 55.7915 80.5135 51.8471 81.504M51.8471 81.504C51.8411 81.5054 51.8352 81.5069 51.8293 81.5084M59.3293 67.0084C59.2672 67.1015 59.2052 67.194 59.1433 67.2857M59.1433 67.2857C55.22 73.1014 51.7361 76.0472 45.8293 78.5084M56.3293 60.5084C56.3215 60.5251 56.3137 60.5417 56.306 60.5583M56.306 60.5583C52.9747 67.6774 49.18 71.6339 40.1888 74.1489M40.1888 74.1489C39.7483 74.2722 39.2953 74.3919 38.8293 74.5084M39.349 74.9887C38.0113 74.1165 36.8218 72.9934 35.8293 71.0084C35.6899 70.7296 35.5354 70.3878 35.3709 69.9998C35.3705 69.999 35.3701 69.9981 35.3698 69.9973M53.0444 56.3616C53.1583 57.7374 52.5023 60.1527 49.3293 63.0084C45.7242 66.253 38.7309 68.9403 35.3692 69.9959C35.3558 70.0001 35.3425 70.0043 35.3293 70.0084C35.1015 70.0797 35.2883 70.0254 35.3709 69.9998M48.3293 53.0084C48.3466 52.9815 48.3635 52.9554 48.3293 53.0084C44.0277 59.6797 42.683 61.0381 32.9771 63.4719M35.3698 69.9973C35.3696 69.9968 35.3694 69.9964 35.3692 69.9959M35.3709 69.9998C35.4085 69.9882 35.4245 69.9824 35.3698 69.9973C35.3591 70.0002 35.3457 70.0038 35.3293 70.0084M48.3293 53.0084L48.3293 53.0084M41.8293 53.5084C41.8293 53.5084 41.9027 53.3543 42.1035 53.1566C42.6832 52.586 44.3248 51.6517 48.3293 53.0084M32.9771 63.4719C32.9452 63.48 32.9131 63.4878 32.8809 63.4956M32.8809 63.4956C32.8637 63.4999 32.8465 63.5041 32.8293 63.5084M48.3293 53.0084C48.2933 53.0644 48.3115 53.036 48.3293 53.0084'></path>
</svg>`;

export const svgTest = `<svg width="60.771137" height="97.508408" viewBox="0 0 60.7711 97.5084" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<desc>
        Created with Pixso.
</desc>
<defs/>
<path id="矢量 1" d="M18.3293 3.24209C19.5293 6.04209 22.1585 12.9128 22.4919 14.9128C22.4275 15.299 22.2786 15.7448 22.028 16.0084L20.9503 16.0084C20.6731 15.806 20.3548 15.4572 19.9919 14.9128C18.3919 12.5128 13.6919 6.81282 12.4919 4.41282C12.0027 3.43456 11.8293 2.75536 11.8293 2.29396C11.8293 1.62337 12.1957 1.41281 12.4919 1.41281C13.9377 0.855904 17.1293 0.442085 18.3293 3.24209ZM8.57267 8.59183C10.3471 10.406 14.3411 14.9277 15.0105 16.3397C15.0001 16.5162 14.9596 16.7143 14.878 16.8987C14.5986 17.5294 13.838 17.9996 12.1564 16.8945C9.98309 15.4663 3.79405 12.2741 2.07743 10.7571C1.26982 10.0434 0.999863 9.53247 0.999863 9.17988C0.999863 8.78302 1.34186 8.5868 1.64414 8.52805C3.21432 7.7934 6.79828 6.77766 8.57267 8.59183ZM11.0693 38.2764C10.4577 37.9341 9.71523 37.5147 8.82929 37.0084C8.60949 34.8104 8.48631 32.8297 8.48631 31.0347C8.48631 30.1164 8.51854 29.2467 8.58656 28.4213L8.58655 28.4029C8.58655 20.886 15.3727 17.8078 18.3293 17.0084C18.4233 16.983 18.5189 16.9571 18.6159 16.9308C21.5742 16.1288 25.8928 14.9581 27.8293 16.3397C31.8293 18.0747 33.8293 21.5084 34.3293 23.0084C34.3969 23.4981 34.461 23.9341 34.5191 24.3301C34.6987 25.553 34.8222 26.3938 34.8222 27.2527C34.8222 28.1602 34.6844 29.0881 34.3293 30.5084C34.0158 31.7623 32.6852 33.1594 30.9653 34.4954C31.3842 34.234 32.0347 34.0084 33.3293 34.0084C33.6286 34.0084 33.8922 34.0057 34.1275 34.0034C35.858 33.9859 36.0688 33.9838 37.8293 35.1657C39.8293 36.5084 39.2293 35.9084 40.8293 39.5084C42.4293 43.1084 43.3293 46.0084 43.3293 47.5084C43.3293 49.0084 43.3293 51.0084 42.1035 53.1566C42.6832 52.586 44.3248 51.6517 48.3293 53.0084C48.7967 53.159 49.1128 53.2014 49.8293 53.5084C50.9095 53.9714 52.0195 55.3361 53.0444 56.3616C54.348 57.666 55.5139 59.2302 56.306 60.5583C56.5054 60.8926 56.6811 61.212 56.8293 61.5084C57.9337 63.7173 58.4452 64.6555 59.1433 67.2857C59.2038 67.5133 59.2656 67.7536 59.3293 68.0084C59.6554 69.3127 59.771 71.5475 59.771 74.0083C59.771 74.3756 59.7684 74.7478 59.7636 75.1228C59.7214 78.3996 59.3293 83.0084 57.8293 85.0084C57.6851 85.1526 57.6282 85.0972 57.3833 84.8582C57.0621 84.5448 56.4177 83.9161 54.8293 83.0084C53.9952 82.5318 52.9659 82.0285 51.8471 81.504C49.2101 80.2675 46.076 78.9126 43.8293 77.5084C42.2173 76.5009 40.7068 75.8741 39.349 74.9887C38.0113 74.1165 36.8218 72.9934 35.8293 71.0084C35.6899 70.7296 35.5354 70.3878 35.3709 69.9998C35.3912 69.9935 35.4052 69.989 35.4052 69.9884C35.4052 69.988 35.395 69.9904 35.3698 69.9973L35.3692 69.9959C34.6286 68.2492 33.683 65.5679 32.9771 63.4719C32.8868 63.2038 32.8637 63.1983 32.8637 63.2786C32.8637 63.3228 32.8707 63.393 32.8774 63.4597C32.8786 63.4719 32.8798 63.4839 32.8809 63.4956C32.8855 63.5422 32.8891 63.5842 32.8891 63.6103C32.8891 63.6604 32.8757 63.6526 32.8293 63.5084C32.8293 60.7084 33.6626 58.0084 34.3293 58.0084L34.9509 57.7598C33.8611 58.0941 33.3253 57.8644 31.474 57.0705C31.4267 57.0502 31.3784 57.0295 31.3293 57.0084C30.5603 56.6788 29.9497 56.4926 29.427 56.3129C28.2187 55.8975 27.4806 55.5173 26.3422 53.4826C26.1802 53.193 26.01 52.8699 25.8293 52.5084C24.2381 49.326 23.09 46.3335 23.09 43.8331C23.09 43.1907 23.1658 42.5807 23.3293 42.0084C23.8634 40.1389 25.6161 38.314 27.2181 37.0099C25.4741 38.0465 23.7513 38.9273 22.4919 39.5084C20.8537 40.3017 19.2834 40.5968 17.9015 40.6121L12.3293 42.5084L13.3293 39.5084C13.1014 39.3945 12.3907 39.0157 11.0693 38.2764ZM30.5544 34.808C30.3936 34.9279 30.23 35.0472 30.0641 35.1657C30.2503 35.0775 30.3923 34.9483 30.5544 34.808Z" fill-rule="evenodd" fill="#AC0707"/>
<path id="矢量 1" d="M22.028 16.0084C21.7768 16.2726 21.4234 16.3537 20.9503 16.0084C20.6731 15.806 20.3548 15.4572 19.9919 14.9128C18.3919 12.5128 13.6919 6.81282 12.4919 4.41282C11.2919 2.01281 11.9919 1.41281 12.4919 1.41281C13.9377 0.855904 17.1293 0.442085 18.3293 3.24209C19.5293 6.04209 22.1585 12.9128 22.4919 14.9128C22.4275 15.299 22.2786 15.7448 22.028 16.0084M15.0105 16.3397C15.0001 16.5162 14.9596 16.7143 14.878 16.8987C14.5986 17.5294 13.838 17.9996 12.1564 16.8945C9.98309 15.4663 3.79405 12.2741 2.07743 10.7571C0.360806 9.24016 1.07331 8.639 1.64414 8.52805C3.21432 7.7934 6.79828 6.77766 8.57267 8.59183C10.3471 10.406 14.3411 14.9277 15.0105 16.3397ZM17.3293 27.5084C18.3293 22.0084 22.8293 22.0084 23.8293 27.5084M13.3293 39.5084L12.3293 42.5084L17.9015 40.6121M27.2181 37.0099C28.1854 36.4349 29.1592 35.812 30.0641 35.1657C32.207 33.6352 33.9629 31.9739 34.3293 30.5084C35.1293 27.3084 34.8265 26.6084 34.3293 23.0084C33.8293 21.5084 31.8293 18.0747 27.8293 16.3397C25.8293 14.9128 21.2883 16.2084 18.3293 17.0084C15.3703 17.8084 8.57545 20.891 8.58656 28.4213C8.38557 30.8603 8.49705 33.686 8.82929 37.0084C9.71523 37.5147 10.4577 37.9341 11.0693 38.2764C12.3907 39.0157 13.1014 39.3945 13.3293 39.5084C14.1338 40.0112 15.7995 40.6354 17.9015 40.6121C19.2834 40.5968 20.8537 40.3017 22.4919 39.5084C23.7513 38.9273 25.4741 38.0465 27.2181 37.0099M30.0641 35.1657C30.7316 34.8495 30.8293 34.0084 33.3293 34.0084C35.8293 34.0084 35.8293 33.823 37.8293 35.1657C39.8293 36.5084 39.2293 35.9084 40.8293 39.5084C42.4293 43.1084 43.3293 46.0084 43.3293 47.5084C43.3293 49.0084 43.3293 51.0084 42.1035 53.1566M42.1035 53.1566C42.0201 53.2669 41.9292 53.3835 41.8293 53.5084C40.2293 55.5084 39.6293 55.8084 36.8293 57.0084C35.9982 57.3646 35.4226 57.615 34.9509 57.7598M29.427 56.3129C28.2187 55.8975 27.4806 55.5173 26.3422 53.4826C26.1802 53.193 26.01 52.8699 25.8293 52.5084C23.8293 48.5084 22.5293 44.8084 23.3293 42.0084C23.8634 40.1389 25.6161 38.314 27.2181 37.0099C28.0154 36.3608 28.7754 35.8407 29.3293 35.5084C29.5665 35.4135 29.7984 35.2915 30.0641 35.1657M48.3293 53.0084C48.7967 53.159 49.1128 53.2014 49.8293 53.5084C50.9095 53.9714 52.0195 55.3361 53.0444 56.3616C54.348 57.666 55.5139 59.2302 56.306 60.5583C56.5054 60.8926 56.6811 61.212 56.8293 61.5084C57.9337 63.7173 58.4452 64.6555 59.1433 67.2857C59.2038 67.5133 59.2656 67.7536 59.3293 68.0084C59.704 69.5074 59.8009 72.2352 59.7636 75.1228C59.7214 78.3996 59.3293 83.0084 57.8293 85.0084C57.496 85.3417 57.6293 84.6084 54.8293 83.0084C53.9952 82.5318 52.9659 82.0285 51.8471 81.504C49.2101 80.2675 46.076 78.9126 43.8293 77.5084C42.2173 76.5009 40.7068 75.8741 39.349 74.9887M35.3692 69.9959C34.6286 68.2492 33.683 65.5679 32.9771 63.4719C32.8281 63.0293 32.8621 63.3024 32.8809 63.4956C32.8942 63.6315 32.8999 63.7279 32.8293 63.5084C32.8293 60.7084 33.6626 58.0084 34.3293 58.0084L34.9509 57.7598L36.8293 57.0084M29.8293 43.5084L26.8293 52.5084L26.3422 53.4826M26.3422 53.4826L25.8293 54.5084L11.3293 54.5084L6.32929 49.0084M40.1888 65.0084L27.8293 78.5084L31.8293 96.5084L24.3293 96.5084M45.3293 69.0084L40.1888 74.1489L39.349 74.9887L35.3293 79.0084L43.8293 96.5084L36.8293 96.5084M32.8293 49.5084L29.427 56.3129L27.8293 59.5084L14.8293 63.5084L5.32929 59.5084M22.3293 16.0084L22.028 16.0084L20.9503 16.0084M14.878 16.8987L14.3293 17.0084M34.9509 57.7598C33.8332 58.1027 33.2982 57.8522 31.3293 57.0084C30.5603 56.6788 29.9497 56.4926 29.427 56.3129M59.8293 75.0084C59.8074 75.0467 59.7855 75.0849 59.7636 75.1228M59.7636 75.1228C57.7882 78.5469 55.7915 80.5135 51.8471 81.504M51.8471 81.504C51.8411 81.5054 51.8352 81.5069 51.8293 81.5084M59.3293 67.0084C59.2672 67.1015 59.2052 67.194 59.1433 67.2857M59.1433 67.2857C55.22 73.1014 51.7361 76.0472 45.8293 78.5084M56.3293 60.5084C56.3215 60.5251 56.3137 60.5417 56.306 60.5583M56.306 60.5583C52.9747 67.6774 49.18 71.6339 40.1888 74.1489M40.1888 74.1489C39.7483 74.2722 39.2953 74.3919 38.8293 74.5084M39.349 74.9887C38.0113 74.1165 36.8218 72.9934 35.8293 71.0084C35.6899 70.7296 35.5354 70.3878 35.3709 69.9998C35.3705 69.999 35.3701 69.9981 35.3698 69.9973M53.0444 56.3616C53.1583 57.7374 52.5023 60.1527 49.3293 63.0084C45.7242 66.253 38.7309 68.9403 35.3692 69.9959C35.3558 70.0001 35.3425 70.0043 35.3293 70.0084C35.1015 70.0797 35.2883 70.0254 35.3709 69.9998M48.3293 53.0084C48.3466 52.9815 48.3635 52.9554 48.3293 53.0084C44.0277 59.6797 42.683 61.0381 32.9771 63.4719M35.3698 69.9973C35.3696 69.9968 35.3694 69.9964 35.3692 69.9959M35.3709 69.9998C35.4085 69.9882 35.4245 69.9824 35.3698 69.9973C35.3591 70.0002 35.3457 70.0038 35.3293 70.0084M48.3293 53.0084L48.3293 53.0084M41.8293 53.5084C41.8293 53.5084 41.9027 53.3543 42.1035 53.1566C42.6832 52.586 44.3248 51.6517 48.3293 53.0084M32.9771 63.4719C32.9452 63.48 32.9131 63.4878 32.8809 63.4956M32.8809 63.4956C32.8637 63.4999 32.8465 63.5041 32.8293 63.5084M48.3293 53.0084C48.2933 53.0644 48.3115 53.036 48.3293 53.0084" stroke="#000000" stroke-width="2.000000"/>
</svg>
`;

export const addonTranslateService = [
  "baiduModify",
  "baidufieldModify",
  "tencentTransmart",
];


export const tablesTranslation = {
  translateService: ["serialNumber", "serviceID", "hasSecretKey", "forbidden", "supportMultiParas"],
  account: ["serialNumber", "appID", "secretKey", "charConsum", "dataMarker", "usable"],
  accessToken: ["serialNumber", "token", "usable", "", "",],
  serviceLimit: ["serialNumber", "QPS", "charasPerTime", "limitMode", "charasLimit", "configID"],
  totalCharConsum: ["serialNumber", "totalCharConsum", "dateModified"]
};