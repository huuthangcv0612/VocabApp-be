import('./src/app.js').then(m => {
  const app = m.default;
  console.log('App router exists:', !!app.router);
  app.router.stack.forEach((layer, idx) => {
    console.log('layer', idx, 'name=', layer.name, 'path=', layer.path, 'regexp=', layer.regexp?.toString());
    if (layer.route) {
      console.log('  route', layer.route.path, Object.keys(layer.route.methods));
    }
    if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      layer.handle.stack.forEach((sub, j) => {
        console.log('   sub', j, 'name=', sub.name, 'route=', sub.route?.path, 'methods=', sub.route ? Object.keys(sub.route.methods) : '', 'regexp=', sub.regexp?.toString());
      });
    }
  });
}).catch(err => {
  console.error('ERR', err);
  process.exit(1);
});
