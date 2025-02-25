'use strict';

// 执行pvuvip定时任务的时间间隔 每天定时执行一次
module.exports = app => {
  return {
    schedule: {
      // pvuvip_task_minute_time 时间间隔执行一次任务
      cron: app.config.pvuvip_task_minute_time,
      type: 'worker',
      disable: false,
    },
    // 定时处pv，uv,ip统计信息 每分钟执行一次
    async task(ctx) {
      // 保证集群servers task不冲突
      const preminute = (await app.redis.get('pvuvip_task_minute_time')) || '';
      const value =
        app.config.cluster.listen.ip + ':' + app.config.cluster.listen.port;
      if (preminute && preminute !== value) return;
      if (!preminute) {
        await app.redis.set('pvuvip_task_minute_time', value, 'EX', 20000);
        const preminutetwo = await app.redis.get('pvuvip_task_minute_time');
        if (preminutetwo !== value) return;
      }
      await ctx.service.pvuvipTask.getWebPvUvIpByMinute();
    },
  };
};
