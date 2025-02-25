'use strict';

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Mixed = Schema.Types.Mixed;
  const conn = app.mongooseDB.get('db1');
  if (!conn) return;

  const WebReportSchema = new Schema({
    app_id: { type: String }, // 系统标识
    create_time: { type: Date, default: Date.now }, // 创建时间
    user_agent: { type: String }, // 用户浏览器信息标识
    ip: { type: String }, // 用户ip
    report_id: { type: String }, // 所有资源页面统一标识 html img css js 用户系统信息等
    mark_page: { type: String }, // 页面标识
    mark_user: { type: String }, // 统一某一时间段用户标识
    mark_uv: { type: String }, // 统一uv标识
    url: { type: String }, // 访问url
    pre_url: { type: String }, // 上一页面来源
    performance: { type: Mixed }, // 用户浏览器性能数据
    error_list: { type: Mixed }, // 错误信息列表
    resource_list: { type: Mixed }, // 资源性能数据列表
    screen_width: { type: Number }, // 屏幕宽度
    screen_height: { type: Number }, // 屏幕高度
    report_type: { type: Number }, // 1:网页性能上报  2：后续操作ajax上报 3：后续操作错误上报

    category: { type: Number },
    sdk_version: { type: String },
    release: { type: String },
    environment: { type: String },
    errors: { type: Mixed },
    performances: { type: Mixed },
    whiteScreen: { type: Mixed },
    behaviors: { type: Mixed },
    metric: { type: Mixed },
  });
  WebReportSchema.index({ create_time: 1 });

  return conn.model('WebReport', WebReportSchema);
};
