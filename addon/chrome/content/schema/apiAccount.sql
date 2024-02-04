-- 1
-- 翻译引擎账号

CREATE TABLE translateService(
    serialNumber INT PRIMARY KEY,
    serviceID TEXT NOT NULL UNIQUE,
    serviceTypeID INT NOT NULL,
    hasSecretKey INT NOT NULL,
    forbidden INT NOT NULL,
    supportMultiParas INT NOT NULL
);

CREATE TABLE account(
    serialNumber INT NOT NULL,
    APPID TEXT NOT NULL,
    secretKey TEXT NOT NULL,
    UNIQUE(serialNumber, APPID), -- 联合唯一，防止重复注册
    FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE
);

CREATE TABLE charConsum(
    serialNumber INT NOT NULL PRIMARY KEY,
    charConsum INT NOT NULL,
    dataMarker TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 根据限额模式，用于恢复额度
    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE
);


CREATE TABLE accessToken(
    serialNumber INT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    UNIQUE(serialNumber, token), 
    FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE
);

CREATE TABLE alive(
    serialNumber INT NOT NULL PRIMARY KEY,
    isAlive INT NOT NULL,
    FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE
);

CREATE TABLE serviceLimit(
    serialNumber INT NOT NULL,
    QPS INT NOT NULL,
    charasPerTime  INT NOT NULL,
    limitMode TEXT NOT NULL,
    charasLimit INT NOT NULL,
    configID INT NOT NULL, -- 允许每个翻译引擎多个配置适应不同环境
    UNIQUE(serialNumber, configID),
    FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE
);

CREATE TABLE totalCharConsum(
    serialNumber INT PRIMARY KEY,
    totalCharConsum INT NOT NULL DEFAULT 0,
    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE
);

CREATE TABLE serviceType(
    serviceTypeID INT PRIMARY KEY,
    serviceType TEXT NOT NULL
);