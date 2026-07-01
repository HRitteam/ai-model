/**
 * CloudBase HTTP 云函数入口
 * 使用 serverless-http 适配器将 Express 应用包装为 CloudBase HTTP 函数
 */
const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const path = require('path');
// 加载 .env（云函数中环境变量通过配置注入，本地开发用 .env）
require('dotenv').config();

const config = require('./src/config');
const { testConnection } = require('./src/db/pool');
const { initDatabase } = require('./src/db/init');
const { startCron } = require('./src/jobs/cron');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');

const dashboardRouter = require('./src/routes/dashboard');
const platformsRouter = require('./src/routes/platforms');
const recordsRouter = require('./src/routes/records');
const collectRouter = require('./src/routes/collect');
const alertsRouter = require('./src/routes/alerts');
const settingsRouter = require('./src/routes/settings');
const recipientsRouter = require('./src/routes/recipients');
const healthRouter = require('./src/routes/health');

let appInstance = null;
let handler = null;
let initPromise = null;

async function ensureInit() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await initDatabase();
    } catch (e) {
      console.error('DB init error:', e.message);
    }
    const dbOk = await testConnection();
    if (dbOk) {
      console.log('MySQL connected, starting cron...');
      startCron();
    } else {
      console.warn('MySQL not connected, running in degraded mode');
    }
  })();
  return initPromise;
}

function createApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API 路由
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/platforms', platformsRouter);
  app.use('/api/records', recordsRouter);
  app.use('/api/collect', collectRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/recipients', recipientsRouter);
  app.use('/api/health', healthRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

exports.main = async (event, context) => {
  if (!appInstance) {
    appInstance = createApp();
    handler = serverless(appInstance);
    // 异步初始化数据库
    ensureInit();
  }

  // 兼容两种调用方式：
  // 1. HTTP 网关: event 直接包含 httpMethod/path/headers/body 等
  // 2. callFunction: event.data 包含 HTTP 参数（前端 SDK 调用）
  const httpData = event.httpMethod ? event : (event.data || event);

  // 确保 path 始终以 /api 开头
  const originalQuery = httpData.queryStringParameters || httpData.queryString || {};
  const queryStringParameters = { ...originalQuery };
  let reqPath = httpData.path || '/';
  if (reqPath === '/api' && queryStringParameters.__path) {
    reqPath = queryStringParameters.__path;
    delete queryStringParameters.__path;
  }
  if (!reqPath.startsWith('/api')) {
    reqPath = '/api' + (reqPath.startsWith('/') ? reqPath : '/' + reqPath);
  }

  const slsEvent = {
    httpMethod: httpData.httpMethod || 'GET',
    path: reqPath,
    headers: httpData.headers || { 'Content-Type': 'application/json' },
    queryStringParameters,
    body: httpData.body || '',
    isBase64Encoded: httpData.isBase64Encoded || false,
    requestContext: httpData.requestContext || {},
  };

  const result = await handler(slsEvent, context);
  return result;
};
