const version = require('../package.json').version;

module.exports = app => {
  const { router, controller } = app;
  router.post(`/api/v${version}/report`, controller.report.webReport);
};
