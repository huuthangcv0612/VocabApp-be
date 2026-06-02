import('./src/app.js').then(m => {
  const app = m.default;
  console.log('App router exists:', !!app.router);
  app.router.stack.forEach((layer, idx) => {
    console.log('\nlayer', idx, 'name=', layer.name);
    console.log(' keys=', Object.keys(layer));
    console.log(' path=', layer.path);
    console.log(' match=', layer.match?.toString ? layer.match.toString() : layer.match);
    console.log(' regexp=', layer.regexp?.toString ? layer.regexp.toString() : layer.regexp);
    console.log(' handleType=', layer.handle?.name || typeof layer.handle);
    if (layer.route) {
      console.log('  route.path=', layer.route.path, 'methods=', Object.keys(layer.route.methods));
    }
    if (layer.handle && layer.handle.stack) {
      console.log('  subcount=', layer.handle.stack.length);
    }
  });
}).catch(err => {
  console.error('ERR', err);
  process.exit(1);
});
