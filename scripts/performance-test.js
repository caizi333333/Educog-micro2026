const https = require('https');
const http = require('http');

// 配置
const config = {
  baseUrl: process.env.TEST_URL || 'http://localhost:3000',
  authToken: process.env.TEST_TOKEN || '',
  concurrentUsers: 10,
  requestsPerUser: 20,
  endpoints: [
    { path: '/api/user/stats', method: 'GET' },
    { path: '/api/achievements', method: 'GET' },
    { path: '/api/learning-progress', method: 'GET' },
    { path: '/api/users?page=1&limit=10', method: 'GET' }
  ]
};

// 性能测试结果
const results = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalDuration: 0,
  responseTimes: [],
  errors: []
};

// 发送请求
function makeRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.baseUrl + endpoint.path);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const startTime = Date.now();
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: endpoint.method,
      headers: {
        'Authorization': `Bearer ${config.authToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const duration = Date.now() - startTime;
        
        results.totalRequests++;
        results.responseTimes.push(duration);
        
        if (res.statusCode < 400) {
          results.successfulRequests++;
        } else {
          results.failedRequests++;
          results.errors.push({
            endpoint: endpoint.path,
            status: res.statusCode,
            message: data
          });
        }
        
        resolve({ duration, status: res.statusCode });
      });
    });
    
    req.on('error', (error) => {
      results.failedRequests++;
      results.errors.push({
        endpoint: endpoint.path,
        error: error.message
      });
      reject(error);
    });
    
    req.end();
  });
}

// 模拟单个用户
async function simulateUser(userId) {
  console.log(`Starting user ${userId}...`);
  
  for (let i = 0; i < config.requestsPerUser; i++) {
    const endpoint = config.endpoints[i % config.endpoints.length];
    
    try {
      await makeRequest(endpoint);
      // 随机延迟 100-500ms
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
    } catch (error) {
      console.error(`User ${userId} request failed:`, error.message);
    }
  }
  
  console.log(`User ${userId} completed.`);
}

// 运行测试
async function runTest() {
  console.log('Starting performance test...');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Concurrent users: ${config.concurrentUsers}`);
  console.log(`Requests per user: ${config.requestsPerUser}`);
  console.log('');
  
  const startTime = Date.now();
  
  // 启动所有用户
  const userPromises = [];
  for (let i = 0; i < config.concurrentUsers; i++) {
    userPromises.push(simulateUser(i + 1));
  }
  
  // 等待所有用户完成
  await Promise.all(userPromises);
  
  results.totalDuration = Date.now() - startTime;
  
  // 计算统计数据
  const avgResponseTime = results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length;
  const minResponseTime = Math.min(...results.responseTimes);
  const maxResponseTime = Math.max(...results.responseTimes);
  const p95ResponseTime = results.responseTimes.sort((a, b) => a - b)[Math.floor(results.responseTimes.length * 0.95)];
  
  // 输出结果
  console.log('\n=== Performance Test Results ===');
  console.log(`Total duration: ${results.totalDuration}ms`);
  console.log(`Total requests: ${results.totalRequests}`);
  console.log(`Successful requests: ${results.successfulRequests} (${(results.successfulRequests / results.totalRequests * 100).toFixed(2)}%)`);
  console.log(`Failed requests: ${results.failedRequests}`);
  console.log(`Requests per second: ${(results.totalRequests / (results.totalDuration / 1000)).toFixed(2)}`);
  console.log('');
  console.log('Response times:');
  console.log(`  Average: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`  Min: ${minResponseTime}ms`);
  console.log(`  Max: ${maxResponseTime}ms`);
  console.log(`  P95: ${p95ResponseTime}ms`);
  
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.slice(0, 10).forEach(error => {
      console.log(`  - ${error.endpoint}: ${error.error || `Status ${error.status}`}`);
    });
    if (results.errors.length > 10) {
      console.log(`  ... and ${results.errors.length - 10} more errors`);
    }
  }
}

// 检查参数
if (!config.authToken) {
  console.error('Please provide TEST_TOKEN environment variable');
  console.log('Usage: TEST_TOKEN=your_token TEST_URL=http://localhost:3000 node scripts/performance-test.js');
  process.exit(1);
}

// 运行测试
runTest().catch(console.error);