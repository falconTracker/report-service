'use strict';

const Service = require('egg').Service;

function format(date, fmt) {
  const o = {
    'M+': date.getMonth() + 1, // 月份
    'd+': date.getDate(), // 日
    'h+': date.getHours(), // 小时
    'H+': date.getHours() > 12 ? date.getHours() - 12 : date.getHours(),
    'm+': date.getMinutes(), // 分
    's+': date.getSeconds(), // 秒
  };
  if (/(y+)/.test(fmt)) {
    fmt = fmt.replace(
      RegExp.$1,
      (date.getFullYear() + '').substr(4 - RegExp.$1.length)
    );
  }
  for (const k in o) {
    if (new RegExp('(' + k + ')').test(fmt)) {
      fmt = fmt.replace(
        RegExp.$1,
        RegExp.$1.length === 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length)
      );
    }
  }
  return fmt;
}

class AnalysisService extends Service {
  async getRealTimeTopPagesForDb(appId, beginTime, endTime, type) {
    try {
      const result = await this.app.models
        .WebPages(appId)
        .aggregate([
          {
            $match: {
              create_time: {
                $gte: new Date(beginTime),
                $lte: new Date(endTime),
              },
            },
          },
          {
            $group: {
              _id: { url: '$url' },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: this.app.config.top_analysis_size.web || 10 },
        ])
        .read('sp')
        .exec();

      // 每分钟执行存储到redis
      if (type === 1) {
        this.app.redis.set(
          `${appId}_top_pages_realtime`,
          JSON.stringify(result)
        );
      }
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  async getRealTimeTopBrowserForDb(appId, beginTime, endTime, type) {
    try {
      const result = await this.app.models
        .WebEnvironment(appId)
        .aggregate([
          {
            $match: {
              create_time: {
                $gte: new Date(beginTime),
                $lte: new Date(endTime),
              },
            },
          },
          {
            $group: {
              _id: { browser: '$browser' },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: this.app.config.top_analysis_size.web || 10 },
        ])
        .read('sp')
        .exec();

      // 每分钟执行存储到redis
      if (type === 1) {
        this.app.redis.set(
          `${appId}_top_browser_realtime`,
          JSON.stringify(result)
        );
      }
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  async getRealTimeTopProvinceForDb(appId, beginTime, endTime, type) {
    try {
      const result = await this.app.models
        .WebEnvironment(appId)
        .aggregate([
          {
            $match: {
              create_time: {
                $gte: new Date(beginTime),
                $lte: new Date(endTime),
              },
            },
          },
          {
            $group: {
              _id: { province: '$province' },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: this.app.config.top_analysis_size.web || 10 },
        ])
        .read('sp')
        .exec();

      // 每分钟执行存储到redis
      if (type === 1) {
        this.app.redis.set(
          `${appId}_top_province_realtime`,
          JSON.stringify(result)
        );
      }
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  // top排行榜 Task任务
  async saveRealTimeTopTask(appId, type, begin, end) {
    try {
      let beginTime = begin;
      let endTime = end;
      if (type === 1) {
        beginTime = format(new Date(), 'yyyy/MM/dd') + ' 00:00:00';
        endTime = new Date();
      }
      const pages = Promise.resolve(
        this.getRealTimeTopPagesForDb(appId, beginTime, endTime, type)
      );
      const browser = Promise.resolve(
        this.getRealTimeTopBrowserForDb(appId, beginTime, endTime, type)
      );
      const province = Promise.resolve(
        this.getRealTimeTopProvinceForDb(appId, beginTime, endTime, type)
      );
      this.getRealTimeTopPvUvIpAjax(appId, beginTime, endTime);

      if (type === 2) {
        // 每天数据存储到数据库
        const all = await Promise.all([ pages, browser, province ]);
        const [ toppages, topbrowser, provinces ] = all;

        const statis = this.ctx.model.Web.WebStatis();
        statis.app_id = appId;
        statis.top_pages = toppages;
        statis.top_browser = topbrowser;
        statis.provinces = provinces;
        statis.create_time = beginTime;
        const result = await statis.save();
        return result;
      }
    } catch (err) {
      console.log(err);
    }
  }

  // 定时获得实时流量统计
  async getRealTimeTopPvUvIpAjax(appId, beginTime, endTime) {
    const query = {
      create_time: { $gte: new Date(beginTime), $lt: new Date(endTime) },
    };
    const pvpro = Promise.resolve(this.ctx.service.pvuvip.pv(appId, query));
    const uvpro = Promise.resolve(this.ctx.service.pvuvip.uv(appId, query));
    const ippro = Promise.resolve(this.ctx.service.pvuvip.ip(appId, query));
    const ajpro = Promise.resolve(this.ctx.service.pvuvip.ajax(appId, query));
    const flpro = Promise.resolve(this.ctx.service.pvuvip.flow(appId, query));
    const data = await Promise.all([ pvpro, uvpro, ippro, ajpro, flpro ]);

    const pv = data[0] || 0;
    const uv = data[1].length ? data[1][0].count : 0;
    const ip = data[2].length ? data[2][0].count : 0;
    const ajax = data[3] || 0;
    const flow = data[4] || 0;
    this.app.redis.set(
      `${appId}_pv_uv_ip_realtime`,
      JSON.stringify({ pv, uv, ip, ajax, flow })
    );
  }
}

module.exports = AnalysisService;
