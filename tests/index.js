const { run } = require('./runner');

// Import test files
require('./auth.test.js');
require('./logical.test.js');
require('./edge_cases.test.js');

run();
