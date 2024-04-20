-- 1
-- 翻译引擎账号

CREATE TABLE translateServiceSN(
    serialNumber INTEGER PRIMARY KEY,
    serviceID TEXT NOT NULL,
    appID TEXT NOT NULL DEFAULT "no",
    usable INT NOT NULL DEFAULT 1,
    forbidden INT NOT NULL DEFAULT 0,
    FOREIGN KEY (serviceID) REFERENCES translateServices (serviceID) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE encryptAccounts(
    serialNumber INTEGER PRIMARY KEY,
    FOREIGN KEY (serialNumber) REFERENCES translateServiceSN (serialNumber) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE translateServices(
    serviceID TEXT NOT NULL PRIMARY KEY,
    serviceTypeID INT NOT NULL,
    hasSecretKey INT NOT NULL DEFAULT 0,
    hasToken INT NOT NULL DEFAULT 0,
    supportMultiParas INT NOT NULL DEFAULT 0
);

CREATE TABLE accounts(
    serialNumber INT NOT NULL PRIMARY KEY,
    serviceID TEXT NOT NULL,
    appID TEXT NOT NULL,
    secretKey TEXT NOT NULL,
    UNIQUE(serviceID, appID), -- 联合唯一，防止重复注册
    FOREIGN KEY (serviceID) REFERENCES translateServices (serviceID) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (serialNumber) REFERENCES translateServiceSN (serialNumber) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE accessTokens(
    serialNumber INT NOT NULL PRIMARY KEY,
    serviceID TEXT NOT NULL,
    appID TEXT NOT NULL DEFAULT "no",
    token TEXT NOT NULL UNIQUE,
    UNIQUE(serviceID, appID), 
    FOREIGN KEY (serviceID) REFERENCES translateServices (serviceID) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (serialNumber) REFERENCES translateServiceSN (serialNumber) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE freeLoginServices (
    serialNumber INT NOT NULL PRIMARY KEY,
    serviceID TEXT NOT NULL UNIQUE,
    FOREIGN KEY (serviceID) REFERENCES translateServices (serviceID) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (serialNumber) REFERENCES translateServiceSN (serialNumber) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE charConsum(
    serialNumber INT NOT NULL PRIMARY KEY,
    charConsum INT NOT NULL DEFAULT 0,
    dateMarker TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 根据限额模式，用于恢复额度，被调用的时间记录
    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (serialNumber) REFERENCES translateServiceSN (serialNumber) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE totalCharConsum(
    serialNumber INT NOT NULL PRIMARY KEY,
    totalCharConsum INT NOT NULL DEFAULT 0,
    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (serialNumber) REFERENCES translateServiceSN (serialNumber) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE serviceLimits(
    serviceID TEXT NOT NULL PRIMARY KEY,
    QPS INT NOT NULL,
    charasPerTime  INT NOT NULL,
    limitMode TEXT NOT NULL,
    charasLimit INT NOT NULL,
    configID INT NOT NULL DEFAULT 0, -- 允许每个翻译引擎多个配置适应不同环境
    FOREIGN KEY (serviceID) REFERENCES translateServices (serviceID) ON DELETE CASCADE ON UPDATE CASCADE
);

--创建不能为NULL的主键时,应该使用 PRIMARY KEY NOT NULL
--解决 NOT NULL 约束报错 使用 INTEGER PRIMARY KEY 实现整数递增
CREATE TABLE serviceTypes(
    serviceTypeID INTEGER PRIMARY KEY,
    serviceType TEXT NOT NULL --serviceTypes = ["translate", "ocr", "ocrTranslate", "languageIdentification"]
);

-- LLM
CREATE TABLE largeLanguageModels(
    serialNumber INT NOT NULL PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT "",
    apikey TEXT NOT NULL DEFAULT "",
    baseurl TEXT NOT NULL DEFAULT "",
    models TEXT NOT NULL DEFAULT "",
    defaultModel TEXT NOT NULL DEFAULT "",
    UNIQUE(provider, apikey)
);
