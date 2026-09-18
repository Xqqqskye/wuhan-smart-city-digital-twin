import axios from 'axios'

const instance=axios.create({
    baseURL: import.meta.env.VITE_MOCK_API_URL || 'http://localhost:8080',
    timeout:5000,
});

instance.interceptors.response.use(
  (res) => {
    if (res.status === 200) {
      return res.data
    } else {
      console.error('请求失败')
      return Promise.reject('请求失败')
    }
  },
  (err) => {
    return Promise.reject(err)
  }
)

export default instance
