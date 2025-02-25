'use strict';

const Service = require('egg').Service;

class SystemService extends Service {
  async getSystemForAppId(appId) {
    if (!appId) throw new Error('查询某个系统信：appId不能为空');

    const result = (await this.app.redis.get(appId)) || '{}';
    return JSON.parse(result);
  }
}

module.exports = SystemService;
