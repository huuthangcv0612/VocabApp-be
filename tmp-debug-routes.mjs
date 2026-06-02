import('./src/app.js').then(m => {
  const app = m.default;
  console.log('App has router:', !!app.router);
  const routes = [];
  app.router.stack.forEach((layer, idx) => {
    const obj = {
      idx,
      name: layer.name,
      path: layer.path,
      regexp: layer.regexp?.toString(),
      route: layer.route ? {
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      } : undefined,
      handleType: layer.handle?.name || typeof layer.handle,
      keys: layer.keys,
      params: layer.params,
    };
    routes.push(obj);
  });
  console.log(JSON.stringify(routes, null, 2));
}).catch(err => {
  console.error('ERR', err);
  process.exit(1);
});
