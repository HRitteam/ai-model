const DeepSeekCollector = require('./deepseek');
const KimiCollector = require('./kimi');
const VolcEngineCollector = require('./volcengine');
const OpenAIHubCollector = require('./openaihub');
const ZhipuCollector = require('./zhipu');
const { createMinimaxCollector } = require('./minimax');

// 采集器注册表：platform code -> collector 实例
function createCollector(platformRow) {
  switch (platformRow.code) {
    case 'deepseek':  return new DeepSeekCollector(platformRow);
    case 'kimi':      return new KimiCollector(platformRow);
    case 'volc':      return new VolcEngineCollector(platformRow);
    case 'openaihub': return new OpenAIHubCollector(platformRow);
    case 'zhipu':     return new ZhipuCollector(platformRow);
    case 'minimax':   return createMinimaxCollector(platformRow);
    default:          return null;
  }
}

module.exports = { createCollector };
