const WUHAN_COORDINATES = { latitude: 30.545, longitude: 114.302 };

export async function getLiveAirQuality() {
  const params = new URLSearchParams({
    latitude: String(WUHAN_COORDINATES.latitude),
    longitude: String(WUHAN_COORDINATES.longitude),
    current: 'us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone',
    timezone: 'Asia/Shanghai'
  });
  try {
    const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
    const payload = await response.json();
    if (!response.ok || payload.current?.us_aqi == null) {
      throw new Error(payload.reason || '空气质量数据不可用');
    }
    const current = payload.current;
    return {
      success: true,
      data: {
        aqi: Math.round(current.us_aqi),
        pm2_5: current.pm2_5,
        pm10: current.pm10,
        co: current.carbon_monoxide,
        no2: current.nitrogen_dioxide,
        so2: current.sulphur_dioxide,
        o3: current.ozone,
        observedAt: current.time,
        source: 'Open-Meteo · CAMS'
      }
    };
  } catch (error) {
    return { success: false, error: error.message || '空气质量请求失败' };
  }
}
