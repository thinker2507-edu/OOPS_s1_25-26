// One-node local replica set. mongosh supplies db, rs and quit.
(async () => {
  try {
    await rs.status();
  }
  catch (error) {
    if (error.code !== 94 && error.codeName !== 'NotYetInitialized') {
      throw error;
    }
    await rs.initiate({
      _id: 'rs0',
      members: [{
        _id: 0,
        host: 'mongo:27017'
      }]
    });
  }
  for (let attempt = 0;attempt < 60;attempt++) {
    if ((await db.adminCommand({ hello: 1 })).isWritablePrimary) {
      print('MongoDB replica set rs0 is ready.');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('MongoDB replica set did not elect a primary.');
})().catch(error => {
  console.error(error.message);
  quit(1);
});
