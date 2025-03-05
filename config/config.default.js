const path = require('path');
const address = require('address');
const version = require('../package.json').version;

module.exports = () => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = (exports = {});

  config.name = 'falcontracker性能监控上报服务';

  config.description = 'falcontracker性能监控上报服务';

  config.keys = 'falcontracker_report_service';

  config.middleware = [];

  // 线上环境此处替换为项目根域名 例如:blog.seosiwei.com (这里不需要填写http|https和斜杠等字符)
  // 用于安全校验和回调域名根路径 开发路径域名
  config.host = '127.0.0.1';
  config.port = 7002;

  config.cluster = {
    listen: {
      port: config.port,
      hostname: config.host,
      ip: address.ip(),
    },
  };

  config.origin = `http://${config.host}:${config.port}`;

  config.pvuvip_task_minute_time = '0 */2 * * * *';

  // 执行pvuvip定时任务的时间间隔 每天定时执行一次
  config.pvuvip_task_day_time = '0 0 0 */1 * *';

  // 执行ip地理位置转换的定时任务 每分钟定时执行一次
  config.ip_task_time = '0 */1 * * * *';

  // 更新用户上报IP对应的城市信息线程数
  config.ip_thread = 5;

  // 使用redis储存原始数据时相关配置
  config.redis_consumption = {
    // 定时任务执行时间
    task_time: '*/20 * * * * *',
    // 每次定时任务消费线程数(web端)
    thread_web: 100,
    // 消息队列池限制数, 0：不限制 number: 限制条数，高并发时服务优雅降级方案
    total_limit_web: 10000,
  };
  
  // db3同步db1上报数据线程数
  config.report_thread = 10;

  // 文件缓存ip对应地理位置（文件名）
  config.ip_city_cache_file = {
    isUse: false, // 是否开启本地文件缓存（数据量太大时建议不开启）
    web: 'web_ip_city_cache_file.txt',
  };

  // ip 解析 为 省市区
  config.location = {
    type: 'ip-api', // baidu | ip-api,
    lang: 'zh-CN',
    BAIDUAK: '这里替换为你的百度KEY', // type = baidu 时生效
  };

  // top数据分析提取前N条配置
  config.top_analysis_size = {
    web: 10,
  };

  // 定义日志路径
  exports.logger = {
    dir: path.resolve(__dirname, '../buildlogs'),
  };

  // shell重启（可选填）
  config.shell_restart = {
    // mongodb重启shell,如果mongodb进程kill了，请求不了数据库时重启
    mongodb: [ path.resolve(__dirname, '../srcipt/mongodb-restart.sh') ],
    // node.js服务重启shell,mongodb重启时，数据库连接池有可能会断，这时需要重启服务
    servers: [ path.resolve(__dirname, '../script/servers-restart.sh') ],
  };

  // redis配置
  config.redis = {
    client: {
      port: 6379, // Redis port
      host: '127.0.0.1', // Redis host
      password: '',
      db: 0,
    },
  };

  // mongoose配置
  config.mongoose = {
    clients: {
      db3: {
        // 单机部署
        url: 'mongodb://127.0.0.1:27017/performance',
        // 副本集 读写分离
        // url: 'mongodb://127.0.0.1:28100,127.0.0.1:28101,127.0.0.1:28102/performance?replicaSet=rs1',
        // 集群分片
        // url: 'mongodb://127.0.0.1:30000/performance',
      },
    },
  };

  config.security = {
    domainWhiteList: [ 'http://127.0.0.1:18090' ],
    csrf: {
      enable: false,
      ignore: `/api/v${version}/report/**`,
    },
  };

  config.cors = {
    origin: '*',
    allowMethods: 'GET,PUT,POST,DELETE',
  };

  config.onerror = {
    all(err, ctx) {
      // 统一错误处理
      ctx.body = JSON.stringify({
        code: 1001,
        desc: err.toString().replace('Error: ', ''),
      });
      ctx.status = 200;
      // 统一错误日志记录
      ctx.logger.info(`统一错误日志：发现了错误${err}`);
    },
  };


  return config;
};
