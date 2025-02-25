'use strict';
const { exec } = require('child_process');

module.exports = {
  /* 生成随机字符串 */
  randomString(len) {
    len = len || 7;
    const $chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz12345678';
    const maxPos = $chars.length;
    let pwd = '';
    for (let i = 0; i < len; i++) {
      pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return pwd + Date.now();
  },

  // 返回结果json
  result(jn = {}) {
    return Object.assign(
      {
        code: 1000,
        desc: '成功',
        data: '',
      },
      jn
    );
  },
  // 重启mongodb服务器
  restartMongodbs(type, ctx, catcherr) {
    if (
      this.config.shell_restart.mongodb &&
      this.config.shell_restart.mongodb.length
    ) {
      this.config.shell_restart.mongodb.forEach(item => {
        exec(`sh ${item}`, error => {
          if (error) {
            this.logger.info(`重启${type}数据库失败!`);
            return;
          }
          this.logger.info(`重启${type}数据库成功!`);
          ctx.service.errors.saveSysAndDbErrors(type, item, catcherr);
          // 重启servers
          if (
            this.config.shell_restart.servers &&
            this.config.shell_restart.servers.length
          ) {
            this.config.shell_restart.servers.forEach(item => {
              exec(`sh ${item}`, error => {
                if (error) {
                  this.logger.info('重启node.js服务失败!');
                  return;
                }
                this.logger.info('重启node.js服务成功!');
              });
            });
          }
        });
      });
    }
  },
};
