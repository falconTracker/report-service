'use strict';

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const conn = app.mongooseDB.get('db3');
  if (!conn) return;

  const WebMetricSchema = new Schema({
    app_id: { type: String },
    create_time: { type: Date, default: Date.now },
    mark_page: { type: String },
    name: { type: String },
    rating: { type: String },
    value: { type: Number },
  });

  WebMetricSchema.index({ mark_page: -1, app_id: -1 });

  app.models.WebMetrics = function(appId) {
    return conn.model(`web_metrics_${appId}`, WebMetricSchema);
  };
};
