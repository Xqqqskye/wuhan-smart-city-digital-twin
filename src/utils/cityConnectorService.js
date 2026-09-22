const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function getCityConnectorStatus() {
  const response = await fetch('/api/city-connectors/status');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '连接器状态不可用');
  return data;
}

export async function callExternalCityTool(tool, args = {}) {
  const response = await fetch('/api/city-connectors/execute', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ tool, arguments: args })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '外部城市服务调用失败');
  return {
    message: data.message || `已调用外部工具 ${tool}`,
    data: data.data ?? data.result ?? data
  };
}

export const cloudMemoryTools = {
  load: (syncId) => callExternalCityTool('agent_memory_get', { syncId }),
  save: (syncId, memory) => callExternalCityTool('agent_memory_save', { syncId, memory })
};
