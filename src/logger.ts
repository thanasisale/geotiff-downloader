import winston from 'winston';
import path from 'path';
import fs from 'fs-extra';

const logsDir = path.join(process.cwd(), 'logs');
fs.ensureDirSync(logsDir);

const logFilePath = path.join(logsDir, 'geotiff-downloader.log');
const errorFilePath = path.join(logsDir, 'geotiff-downloader-error.log');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.printf(
      (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`
        )
      ),
    }),
    new winston.transports.File({
      filename: logFilePath,
    }),
    new winston.transports.File({
      filename: errorFilePath,
      level: 'error',
    }),
  ],
});

export default logger;
