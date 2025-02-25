'use strict';

const Service = require('egg').Service;

class PvuvipService extends Service {
  // pv
  async pv(appId, querydata) {
    return this.app.models.WebPages(appId).count(querydata).read('sp')
      .exec();
  }
  // ajax
  async ajax(appId, querydata) {
    return this.app.models.WebAjaxs(appId).count(querydata).read('sp')
      .exec();
  }
  // uv
  async uv(appId, querydata) {
    return this.app.models
      .WebEnvironment(appId)
      .aggregate([
        { $match: querydata },
        { $project: { mark_uv: true } },
        { $group: { _id: '$mark_uv' } },
        { $group: { _id: null, count: { $sum: 1 } } },
      ])
      .read('sp')
      .exec();
  }
  // ip
  async ip(appId, querydata) {
    return this.app.models
      .WebEnvironment(appId)
      .aggregate([
        { $match: querydata },
        { $project: { ip: true } },
        { $group: { _id: '$ip' } },
        { $group: { _id: null, count: { $sum: 1 } } },
      ])
      .read('sp')
      .exec();
  }
  // user
  async user(appId, querydata) {
    return this.app.models
      .WebEnvironment(appId)
      .aggregate([
        { $match: querydata },
        { $project: { mark_user: true } },
        { $group: { _id: '$mark_user' } },
        { $group: { _id: null, count: { $sum: 1 } } },
      ])
      .read('sp')
      .exec();
  }
  // 流量消费
  async flow(appId, querydata) {
    const pagequery = Object.assign({}, querydata);
    const pageflow = Promise.resolve(
      this.app.models
        .WebPages(appId)
        .aggregate([
          { $match: pagequery },
          { $group: { _id: null, amount: { $sum: '$total_res_size' } } },
        ])
        .read('sp')
        .exec()
    );
    const ajaxflow = Promise.resolve(
      this.app.models
        .WebAjaxs(appId)
        .aggregate([
          { $match: querydata },
          { $group: { _id: null, amount: { $sum: '$decoded_body_size' } } },
        ])
        .read('sp')
        .exec()
    );
    const data = await Promise.all([ pageflow, ajaxflow ]);
    const page_flow = data[0].length ? data[0][0].amount : 0;
    const ajax_flow = data[1].length ? data[1][0].amount : 0;
    return page_flow + ajax_flow;
  }
}

module.exports = PvuvipService;
