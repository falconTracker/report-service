/** @type Egg.EggPlugin */
module.exports = {
  redis: {
    enable: true,
    package: 'egg-redis',
  },

  mongoose: {
    enable: true,
    package: 'egg-mongoose',
  },

  cors: {
    enable: true,
    package: 'egg-cors',
  },
};
