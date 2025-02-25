const Controller = require('egg').Controller;

const getUserIp = (ctx) => {
  const res =
    ctx.req.headers['x-forwarded-for'] ||
    ctx.req.headers['x-real-ip'] ||
    ctx.req.headers.remote_addr ||
    ctx.req.headers.client_ip ||
    ctx.req.connection.remoteAddress ||
    ctx.req.socket.remoteAddress ||
    ctx.req.connection.socket.remoteAddress ||
    ctx.ip;
  return res.match(/[.\d\w]+/g).join('');
};

class ReportController extends Controller {
  async webReport() {
    const { ctx } = this;
    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('Content-Type', 'application/json;charset=UTF-8');
    ctx.set('X-Response-Time', '2s');
    ctx.set('Connection', 'close');
    ctx.status = 200;

    const query = ctx.request.body;
    if (!query.appId) throw new Error('web端上报数据异常：appId不能为空');

    query.ip = getUserIp(ctx);
    query.url = query.url || ctx.headers.referer;
    query.user_agent = ctx.headers['user-agent'];

    this.saveWebReportDataForRedis(query);
  }

  // 通过redis 消息队列消费数据
  async saveWebReportDataForRedis(query) {
    try {
      if (this.app.config.redis_consumption.total_limit_web) {
        // 限流
        const length = await this.app.redis.llen('web_report_data');
        if (length >= this.app.config.redis_consumption.total_limit_web) return;
      }
      this.app.redis.lpush('web_report_data', JSON.stringify(query));
    } catch (e) {
      console.log(e);
    }
  }
}

module.exports = ReportController;
