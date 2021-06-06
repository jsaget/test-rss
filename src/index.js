'use strict';

const glob = require('glob')
const Inert = require('@hapi/inert');
const Hapi = require('@hapi/hapi');
const HapiSwagger = require('hapi-swagger');
const Path = require('path')
const Vision = require('@hapi/vision');
const Pack = require('../package');

const init = async () => {

  const server = Hapi.server({
    port: 3000,
    host: 'localhost'
  });

  // swagger - Open API documentation
  const swaggerOptions = {
    info: {
      title: 'RSS Test API Documentation',
      version: Pack.version,
    },
  };

  await server.register([
    Inert,
    Vision,
    {
      plugin: HapiSwagger,
      options: swaggerOptions
    }
  ]);

  // load route dynamically
  const cwd = Path.resolve(__dirname, '.');
  const routes = glob.sync('**/*.route.js', { cwd: cwd })

  routes.forEach(route => {
    var route = require(Path.resolve(cwd, route));

    try {
      server.route(route);
      console.log('Route: ', route.path, '(' + route.method + ')');
    } catch (error) {
      throw new Error('Cannot load route ' + route.path + ':\n' + error.message);
    }
  })

  await server.start();
  console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {

  console.log(err);
  process.exit(1);
});

init();
