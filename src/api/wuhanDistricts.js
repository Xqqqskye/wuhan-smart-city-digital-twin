import request from './request'

export const getWuhanDistricts = () => {
  return request({
    url:'wuhan_districts',
    method:'GET'
  })
}