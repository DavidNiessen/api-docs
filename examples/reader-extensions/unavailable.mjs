export default {
  id: 'unavailable-example',
  version: '1.0.0',
  pluginApi: '1',
  capabilities: ['page'],
  activate() {
    throw new Error('Demonstration activation failure');
  },
};
