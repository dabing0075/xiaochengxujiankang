import Taro from '@tarojs/taro'
import { getToken, clearToken } from '@/lib/auth'

/**
 * 网络请求模块
 * 封装 Taro.request、Taro.uploadFile、Taro.downloadFile，自动添加项目域名前缀与鉴权头
 * 如果请求的 url 以 http:// 或 https:// 开头，则不会添加域名前缀
 *
 * IMPORTANT: 项目已经全局注入 PROJECT_DOMAIN
 */
export namespace Network {
    const createUrl = (url: string): string => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url
        }
        return `${PROJECT_DOMAIN}${url}`
    }

    const buildHeader = (header?: Record<string, any>): Record<string, any> => {
        const token = getToken()
        return {
            ...(header || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
    }

    const handleResponse = (res: any): any => {
        // 登录过期：清除 token 并跳转登录页
        if (res && res.statusCode === 401) {
            clearToken()
            Taro.reLaunch({ url: '/pages/login/index' })
        }
        return res
    }

    export const request: typeof Taro.request = option => {
        return Taro.request({
            ...option,
            url: createUrl(option.url),
            header: buildHeader(option.header as Record<string, any>),
        } as any).then(handleResponse) as any
    }

    export const uploadFile: typeof Taro.uploadFile = option => {
        return Taro.uploadFile({
            ...option,
            url: createUrl(option.url),
            header: buildHeader(option.header as Record<string, any>),
        } as any) as any
    }

    export const downloadFile: typeof Taro.downloadFile = option => {
        return Taro.downloadFile({
            ...option,
            url: createUrl(option.url),
            header: buildHeader(option.header as Record<string, any>),
        } as any) as any
    }
}
