-- 1
-- 翻译引擎账号

CREATE TABLE  IF NOT EXISTS translateService(
    serialNumber INT PRIMARY KEY,
    serviceID TEXT NOT NULL UNIQUE,
    hasSecretKey INT NOT NULL,
    forbidden INT NOT NULL,
    supportMultiParas INT NOT NULL
);

CREATE TABLE  IF NOT EXISTS account(
    serialNumber INT NOT NULL,
    APPID TEXT NOT NULL,
    secretKey TEXT NOT NULL,
    charConsum INT NOT NULL,
    dataMarker TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 根据限额模式，用于恢复额度
    isAlive INT NOT NULL,
    UNIQUE(serialNumber, APPID), -- 联合唯一，防止重复注册
    FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE
);


CREATE TABLE  IF NOT EXISTS accessToken(
    serialNumber INT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    isAlive INT NOT NULL,
    FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE
);

CREATE TABLE  IF NOT EXISTS serviceLimit(
    serialNumber INT NOT NULL,
    QPS INT NOT NULL,
    charasPerTime  INT NOT NULL,
    limitMode TEXT NOT NULL,
    charasLimit INT NOT NULL,
    configID INT NOT NULL, -- 允许每个翻译引擎多个配置适应不同环境
    UNIQUE(serialNumber, configID),
    FOREIGN KEY (serialNumber) REFERENCES translateService (serialNumber) ON DELETE CASCADE
);