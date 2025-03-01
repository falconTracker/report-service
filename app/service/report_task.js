'use strict';

const url = require('url');
const UAParser = require('ua-parser-js');
const Service = require('egg').Service;
const fs = require('fs');
const path = require('path');
class ReportTaskService extends Service {
  constructor(params) {
    super(params);
    this.cacheJson = {};
    this.cacheIpJson = {};
    this.cacheArr = [];
    this.system = {};
    // 缓存一次ip地址库信息
    this.ipCityFileCache();
  }

  // 获得本地文件缓存
  async ipCityFileCache() {
    this.cacheIpJson = {};
    if (!this.app.config.ip_city_cache_file.isUse) return {};
    try {
      const beginTime = new Date().getTime();
      const filepath = path.resolve(
        __dirname,
        `../cache/${this.app.config.ip_city_cache_file.web}`
      );
      const ipDatas = fs.readFileSync(filepath, { encoding: 'utf8' });
      const result = JSON.parse(`{${ipDatas.slice(0, -1)}}`);
      this.cacheIpJson = result;
      this.app.logger.info(
        `--------读取文件城市Ip地址耗时为 ${
          new Date().getTime() - beginTime
        }ms-------`
      );
    } catch (err) {
      this.cacheIpJson = {};
    }
  }

  // 把redis消费数据经过加工之后同步到db3中 的定时任务（从redis中拉取数据）
  async saveWebReportDataForRedis() {
    const onecount = this.app.config.redis_consumption.thread_web;
    for (let i = 0; i < onecount; i++) {
      this.getWebItemDataForRedis();
    }
  }

  // 单个item储存数据
  async getWebItemDataForRedis() {
    let query = await this.app.redis.rpop('web_report_data');
    if (!query) return;
    query = JSON.parse(query);

    const reportType = query.reportType || 1;
    const item = await this.handleData(query);

    let system = {};
    if (this.cacheJson[item.app_id]) {
      system = this.cacheJson[item.app_id];
    } else {
      system = await this.service.system.getSystemForAppId(item.app_id);
      this.cacheJson[item.app_id] = system;
    }
    // 是否禁用上报
    if (system.is_use !== 0) return;

    // 页面数据包含了页面渲染数据，首屏渲染时加载的资源总量
    if (system.is_statisi_pages === 0 && reportType === 1) {
      await this.savePages(item, system.slow_page_time);

      // 处理 web-vitals 数据
      if (
        item.metric_list &&
        Array.isArray(item.metric_list) &&
        item.metric_list.length != 0
      ) {
        await this.saveMetric(item);
      }

      // 处理上报的资源数据
      // 需要统计耗时的资源进行展示
      if (system.is_statisi_resource === 0) {
        this.forEachResources(item, system);
      }
    }

    if (system.is_statisi_ajax === 0 && reportType === 2) {
      this.forEachRequest(item, system);
    }

    if (system.is_statisi_error === 0 && reportType === 3) {
      this.saveErrors(item);
    }

    if (system.is_statisi_system === 0) this.saveEnvironment(item);
  }

  // 数据操作层
  async handleData(query) {
    const reportType = query.reportType || 1;
    let item = {
      app_id: query.appId,
      create_time: new Date(query.time),
      user_agent: query.user_agent,
      ip: query.ip,
      // 根据 requestId 就可以获取到某条上报数据的全部内容
      request_id: this.app.randomString(),
      mark_page: query.markPage || '',
      mark_user: query.markUser || '',
      mark_uv: query.markUv || '',
      url: query.url,
    };

    if (reportType === 1) {
      // 页面级性能
      item = Object.assign(item, {
        pre_url: query.preUrl,
        performance: query.performance,
        error_list: query.errorList || [],
        resource_list: query.resourceList || [],
        request_list: query.requestList || [],
        metric_list: query.metricList,
        screen_width: query.screen_width,
        screen_height: query.screen_height,
      });
    } else if (reportType === 2 || reportType === 3) {
      item = Object.assign(item, {
        error_list: query.errorList || [],
        resource_list: query.resourceList || [],
        request_list: query.requestList || [],
      });
    }
    return item;
  }

  // 更新 metric 数据
  async getAndUpdateMetric(metricModel, item, query) {
    const data = await metricModel.findOne(query).exec();
    if (data) {
      // 已经存在的 metric 直接覆盖
      data[item.name] = item;
      await metricModel.updateOne(query, { data });
      return true;
    }
    return false;
  }

  async saveMetric(item) {
    const metricModel = this.app.models.WebMetrics(item.app_id);
    const metrics = metricModel();
    for (let i = 0; i < item.metric_list.length; i++) {
      const metircItem = item.metric_list[i];

      const isMetricSave = await this.getAndUpdateMetric(metricModel, metircItem, {
        app_id: item.app_id,
        mark_page: item.mark_page,
        name: metircItem.name
      });
      if (!isMetricSave) {
        metrics.app_id = item.app_id;
        metrics.mark_page = item.mark_page;
        metrics.create_time = item.time;
        metrics.name = metircItem.name;
        metrics.rating = metircItem.rating;
        metrics.value = metircItem.value;
        await metrics.save();
      }
    }
  }

  // 储存网页性能数据
  async savePages(item, slowPageTime = 5) {
    try {
      if (!item.performance || typeof item.performance != 'object') return;

      const pages = this.app.models.WebPages(item.app_id)();
      const performance = item.performance;

      if (item.performance.lodt > 0) {
        const newUrl = url.parse(item.url);
        const newName = `${newUrl.protocol}//${newUrl.host}${newUrl.pathname}${
          newUrl.hash ? newUrl.hash : ''
        }`;

        slowPageTime = slowPageTime * 1000;
        // 根据不同的 speedType 分为正常页面（1）以及慢页面（2）
        const speedType = performance.lodt >= slowPageTime ? 2 : 1;

        // 算出首页页面加载时资源总大小
        let totalSize = 0;
        const sourceList = item.resource_list || [];
        for (let i = 0; i < sourceList.length; i++) {
          // 不需要计算异步请求的响应大小值
          if (
            sourceList[i].decodedBodySize &&
            sourceList[i].initiatorType !== 'fetch' &&
            sourceList[i].initiatorType !== 'xmlhttprequest'
          ) {
            totalSize += sourceList[i].decodedBodySize;
          }
        }

        pages.app_id = item.app_id;
        pages.create_time = item.create_time;
        pages.url = newName;
        pages.full_url = item.url;
        pages.pre_url = item.pre_url;
        pages.speed_type = speedType;
        pages.request_id = item.request_id;
        pages.mark_page = item.mark_page;
        pages.mark_user = item.mark_user;
        pages.load_time = performance.lodt;
        pages.dns_time = performance.dnst;
        pages.tcp_time = performance.tcpt;
        pages.dom_time = performance.domt;
        pages.resource_list = sourceList;
        pages.total_res_size = totalSize;
        pages.white_time = performance.wit;
        pages.redirect_time = performance.rdit;
        pages.unload_time = performance.uodt;
        pages.request_time = performance.reqt;
        pages.analysisDom_time = performance.andt;
        pages.ready_time = performance.radt;
        pages.screen_width = item.screen_width;
        pages.screen_height = item.screen_height;
        await pages.save();
      }
    } catch (err) {
      console.log(err);
    }
  }

  forEachRequest(data, system) {
    if (
      // 请求数据资源
      !data.request_list &&
      !data.request_list.length
    ) {
      return;
    }

    data.request_list.forEach((item) => {
      if (system.is_statisi_ajax === 0) {
        this.saveRequests(data, item, system.slow_ajax_time);
      }
    });
  }
  // 根据资源类型存储不同数据
  forEachResources(data, system) {
    if (
      // 资源数据
      !data.resource_list &&
      !data.resource_list.length
    ) {
      return;
    }

    // 遍历所有资源进行存储
    data.resource_list.forEach((item) => {
      // resource_list中的请求数据并不需要处理
      if (
        item.initiatorType != 'xmlhttprequest' &&
        item.initiatorType != 'fetch'
      ) {
        if (system.is_statisi_resource === 0) {
          this.saveResources(data, item, system);
        }
      }
    });
  }

  // 存储ajax信息
  saveRequests(data, item, slowAjaxTime = 2) {
    const newUrl = url.parse(item.resourceUrl);
    const newName = newUrl.protocol + '//' + newUrl.host + newUrl.pathname;
    let duration = Math.abs(item.duration || 0);
    if (duration > 60000) duration = 60000;
    slowAjaxTime = slowAjaxTime * 1000;
    const speedType = duration >= slowAjaxTime ? 2 : 1;

    const ajaxs = this.app.models.WebAjaxs(data.app_id)();
    ajaxs.app_id = data.app_id;
    ajaxs.create_time = data.create_time;
    ajaxs.speed_type = speedType;
    ajaxs.url = newName;
    ajaxs.full_url = item.resourceUrl;
    ajaxs.method = item.method;
    ajaxs.duration = duration;
    ajaxs.decoded_body_size = item.decodedBodySize;
    ajaxs.call_url = data.url;
    ajaxs.params = item.params;
    ajaxs.request_id = data.request_id;
    ajaxs.mark_user = data.mark_user;
    ajaxs.mark_page = data.mark_page;

    ajaxs.save();
  }

  // 储存网页资源性能数据
  saveResources(data, item, system) {
    let slowTime = 2;
    let speedType = 1;
    let duration = Math.abs(item.duration || 0);
    if (duration > 60000) duration = 60000;

    if (item.type === 'link' || item.type === 'css') {
      slowTime = (system.slow_css_time || 2) * 1000;
    } else if (item.type === 'script') {
      slowTime = (system.slow_js_time || 2) * 1000;
    } else if (item.type === 'img') {
      slowTime = (system.slow_img_time || 2) * 1000;
    } else {
      slowTime = 2 * 1000;
    }

    speedType = duration >= slowTime ? 2 : 1;
    // 因为资源数据可能非常多，因此这里只存储慢资源
    if (duration < slowTime) return;

    const newUrl = url.parse(item.resourceUrl);
    const newName = newUrl.protocol + '//' + newUrl.host + newUrl.pathname;

    const resours = this.app.models.WebResource(data.app_id)();
    resours.app_id = data.app_id;
    resours.create_time = data.create_time;
    resours.url = data.url;
    resours.full_url = item.resourceUrl;
    resours.speed_type = speedType;
    resours.name = newName;
    resours.type = item.initiatorType;
    resours.duration = duration;
    resours.decoded_body_size = item.decodedBodySize;
    resours.next_hop_protocol = item.nextHopProtocol;
    resours.request_id = data.request_id;
    resours.mark_user = data.mark_user;
    resours.mark_page = data.mark_page;

    resours.save();
  }

  // 存储错误信息
  saveErrors(data) {
    if (!data.error_list && !data.error_list.length) return;
    data.error_list.forEach((item) => {
      // 暂时不支持处理自定义错误
      if (item.n !== 'js' && item.n !== 'resource' && item.n !== 'request') return;

      const newUrl = url.parse(item.data.resourceUrl || '');
      const newName = newUrl.protocol + '//' + newUrl.host + newUrl.pathname;
      const errors = this.app.models.WebErrors(data.app_id)();
      errors.app_id = data.app_id;
      errors.url = data.url;
      errors.create_time = item.t;
      errors.msg = item.msg;
      errors.category = item.n;
      errors.traceId = item.traceId;
      errors.request_id = data.request_id;
      errors.mark_user = data.mark_user;
      errors.mark_page = data.mark_page;
      errors.resource_url = newName;
      errors.fullurl = item.data.resourceUrl;

      if (item.n === 'js') {
        errors.line = item.data.line;
        errors.col = item.data.col;
        errors.screenRecords = item.screenRecords || '';
        errors.behavior_list = item.behaviorList || [];
      } else if (item.n === 'resource') {
        errors.target = item.data.target;
        errors.type = item.data.type;
      } else if (item.n === 'request') {
        errors.params = item.data.params;
        errors.method = item.data.method;
        errors.status = item.data.status;
        errors.text = item.data.statusText;
      }
      errors.save();
    });
  }

  //  储存用户的设备信息
  async saveEnvironment(data) {
    // 检测用户UA相关信息
    const parser = new UAParser();
    parser.setUA(data.user_agent);
    const result = parser.getResult();
    const ip = data.ip;

    if (!ip) return;
    let copyip = ip.split('.');
    copyip = `${copyip[0]}.${copyip[1]}.${copyip[2]}`;
    let datas = null;

    if (this.cacheIpJson[copyip]) {
      datas = this.cacheIpJson[copyip];
    } else {
      datas = await this.app.redis.get(copyip);
      if (datas) {
        datas = JSON.parse(datas);
        this.cacheIpJson[copyip] = datas;
        this.saveIpDatasInFile(copyip, {
          city: datas.city,
          province: datas.province,
        });
      }
    }

    const environment = this.app.models.WebEnvironment(data.app_id)();
    environment.app_id = data.app_id;
    environment.create_time = data.create_time;
    environment.url = data.url;
    environment.request_id = data.request_id;
    environment.mark_page = data.mark_page;
    environment.mark_user = data.mark_user;
    environment.mark_uv = data.mark_uv;
    environment.browser = result.browser.name || '';
    environment.browser_version = result.browser.version || '';
    environment.system = result.os.name || '';
    environment.system_version = result.os.version || '';
    environment.ip = data.ip;
    environment.county = data.county;
    environment.province = data.province;
    if (datas) {
      environment.province = datas.province;
      environment.city = datas.city;
    }
    environment.save();
  }

  // 保存城市信息到文件中
  saveIpDatasInFile(copyip, json) {
    if (this.cacheArr.includes(copyip)) return;
    this.cacheArr.push(copyip);
    const filepath = path.resolve(
      __dirname,
      `../cache/${this.app.config.ip_city_cache_file.web}`
    );
    const str = `"${copyip}":${JSON.stringify(json)},`;
    fs.promises.appendFile(filepath, str, { encoding: 'utf8' }, () => {});
  }
}

module.exports = ReportTaskService;
