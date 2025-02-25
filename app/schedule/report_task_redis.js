'use strict';

// 处理数据定时任务
// 定时处理上报到 redis 中的数据，同步到db3数据
module.exports = app => {
  return {
    schedule: {
      cron: app.config.redis_consumption.task_time,
      type: 'worker',
      disable: false,
    },
    async task(ctx) {
      // 查询db3是否正常,不正常则重启
      try {
        await ctx.model.System.count({}).exec();
        app.logger.info('-----------db3数据库连接正常-----------');

        ctx.service.reportTask.saveWebReportDataForRedis();
      } catch (err) {
        app.restartMongodbs('db3', ctx, err);
      }
    },
  };
};
