# report-service

前端性能监控上报服务，主要用于收集页面上报的数据，收集的数据在 platform-service 平台上展示。

## 安装

```bash
npm i
npm run dev
```

## 部署

```bash
npm start
npm stop
```

## 功能

report-service 服务只有一个功能，就是收集页面上报的数据。

接口为

```js
/api/v${version}/report
```

version 为 report-service 中 package.json 中的 version 值。

## 上报字段总览

- appId：项目 id
- time：数据产生的时间戳
- reportType：上报数据类型，有以下 3 种类型：
- - 1：上报页面性能数据，包括首页加载时页面性能数据以及 metric 测量数据（在页面加载完成后不能直接获取到全部的测量数据，因此可以通过上报多条 type 为 1 的数据，此时只需要传递 metric
- - 2：上报异步请求数据
- - 3：上报错误数据
- markUser：一个字符串，用于计算 pv（page view）。
- markUv: 一个字符串，用于计算 uv（unique visitor）。
- markPage: 一个字符串，用于标识页面，可以与 metric 数据进行绑定。
- preUrl：从网站哪个页面跳转进来的
- user_agent: navigator.userAgent 值
- metricList：web-vitals 中获取的数据，
- url：当前上报数据所处的页面 url
- performance：首屏加载时获取到的性能条目数据，包含以下字段
- - dnst：dns 解析耗时
- - tcpt：tcp 连接耗时
- - wit：页面加载白屏时长
- - domt：页面从加载到 dom 渲染完成耗时
- - lodt：页面从加载到 onload 事件触发耗时
- - radt：页面可以发送异步请求的耗时
- - rdit：页面重定向耗时
- - uodt：页面卸载的耗时
- - reqt：页面（html）下载耗时
- - andt：解析 dom 树耗时
- errorList：错误数据列表，每条数据包含以下字段
- - traceId：
- - msg：错误信息
- - method：TODO
- - t：错误出现时间戳
- - n：错误类型，可选值为 js | resource | request
- - data：错误具体描述
- - - line：js 类型专属，错误代码所处行数
- - - col：js类型专属，错误代码所处列数
- - - target：resource 类型专属，标签名，代表加载失败的资源是通过哪个标签导入的
- - - resourceUrl：当错误类型为 resource 时，代表加载失败的资源 url；当错误类型为 js 时，代表错误代码所处文件的 url；当错误类型为 request 时，代表请求 url。
- - - params：request 类型专属，代表请求时携带的参数。
- - - text：request 类型专属，请求错误的描述
- - - status：request 类型专属，错误码，当然对于请求错误一般都是 -1。
- behaviorList：用户行为列表，包括点击、发送请求、导航切换。在出现 js 类型的错误时才需要携带，用于追溯错误产生的源头。根据不同类型有不同的字段
- - type：行为类型，可选 api | ui-click | navigation
- - data：当行为类型为 api 或者 navigation 时进行配置
- - - from：api 类型专属，导航前的页面 url
- - - to：api 类型专属，要导航的页面 url
- - - resource：navigation 类型专属，PerformanceResourceTiming 实例或者 underfined
- - - status：navigation 类型专属，请求响应码
- - - statusText：navigation 类型专属，请求响应码描述
- - - message：navigation 类型专属，请求响应文本
- - - contentLength：navigation 类型专属，请求响应内容大小，在一些跨域请求中，PerformanceResourceTiming 实例中的 decodedBodySize 为 0，为了更好展示，单独添加一个额外的字段进行收集，当请求失败应该传递 0
- - - method：navigation 类型专属，请求方法
- - - params：navigation 类型专属，请求携带参数
- - event：当行为类型为 ui-click 时进行配置，值为 PointEvent 实例。
- resourceList：资源数据列表，每条数据应该包含以下字段
- - name：资源名，可以通过 PerformanceResourceTiming 实例中的 name 获取
- - method：资源请求方式，默认 GET
- - type：资源类型，可以通过 PerformanceResourceTiming 实例中的 initiatorType 获取
- - duration：资源请求耗时，可以通过 PerformanceResourceTiming 实例中的 duration 获取
- - decodedBodySize：资源大小，可以通过 PerformanceResourceTiming 实例中的 decodedBodySize 获取
- - nextHopProtocol：协议，可以通过 PerformanceResourceTiming 实例中的 nextHopProtocol 获取
- - responseStatus：资源响应码，可以通过 PerformanceResourceTiming 实例中的 responseStatus 获取
- requestList：请求列表，每条数据包含以下字段
- - method：请求方法
- - params：请求参数
- - url：请求 url
- - duration：请求耗时
- - decodedBodySize：请求响应大小
- screenWidth：页面宽度
- screenHeight：页面宽度

## 上报示例

上面展示的上报字段总览包含了全部的参数，根据不同的 type，只需要传递具体的字段，不需要传递全部。

**考虑到可能存在频繁上报问题，因此 report-service 使用数组格式收集资源、请求、错误等信息**


### 页面性能数据示例

```js
{
    appId: 'xxx',
    time: 12345678,
    reportType: 1,
    markUser: 'usertoken',
    markUv: 'uniqueId',
    markPage: 'markPagexxx',
    url: 'http://xxx.com/b',
    pre_url: 'http://xxx.com/a',
    performance: {
        lodt: 0,
        dnst: 0,
        tcpt: 0,
        domt: 0,
        wit: 0,
        rdit: 0,
        uodt: 0,
        reqt: 0,
        andt: 0,
        radt: 0
    },
    resourceList: [
        {
            initiatorType: 'script',
            resourceUrl: 'http://xxx.com/index.js',
            duration: 0,
            decodedBodySize: 1024,
            nextHopProtocol: 'http/1.1',
            responseStatus: 0
        }
    ],
    metricList：[{
        name: 'TTFB',
        rating: 'good',
        value: 14,
    }]
}
```

当 reportType 为 1 时，可以同时传递 metricList、performance 以及 resourceList。

如果存在了 performance 字段，说明这条数据属于页面首屏加载的，此时会将 resourceList 中的全部性能数据进行计算，算出页面首屏渲染时所需要加载的资源大小，并且收集每条资源的具体详情。

如果不存在 performance，说明上报的并非是首屏加载，而是导入的资源上报（这些资源不会被计算到首屏中）或者是 web-vitals 指标上报，此时可以单独传递 resourceList 或者 web-vitals 指标，当然也可以同时传递。

**注意，在收集首页渲染时的页面性能数据，会根据平台中配置的页面慢加载阀值（默认值是5秒）区分成正常页面以及慢页面。**

#### 普通的资源上报

```js
{
    appId: 'xxx',
    time: 12345678,
    reportType: 1,
    markUser: 'usertoken',
    markUv: 'uniqueId',
    markPage: 'markPagexxx',
    url: 'http://xxx.com/b',
    pre_url: 'http://xxx.com/a',
    resourceList: [
        {
            initiatorType: 'script',
            resourceUrl: 'http://xxx.com/index.js',
            duration: 0
            method: 'GET',
            decodedBodySize: 1024,
            nextHopProtocol: 'http/1.1'
        }
    ],
}
```

**注意，上报的资源信息只有在 duration 值大于平台中配置的慢加载阀值才会进行收集（默认值是2秒）**

#### web-vitals 指标上报

```js
{
    appId: 'xxx',
    time: 12345678,
    reportType: 1,
    markUser: 'usertoken',
    markUv: 'uniqueId',
    markPage: 'markPagexxx',
    url: 'http://xxx.com/b',
    pre_url: 'http://xxx.com/a',
    metricList：[{
        name: 'TTFB',
        rating: 'good',
        value: 14,
    }]
}
```


### 请求数据示例

```js
{
    appId: 'xxx',
    time: 12345678,
    reportType: 2,
    markUser: 'usertokenxxx',
    markUv: 'uniqueIdxxx',
    markPage: 'markPagexxx',
    url: 'http://xxx.com/b',
    requestList: [
        {
            requestUrl: 'http://xxx.com/api/login',
            method: 'POST',
            duration: 10,
            decodedBodySize: 1024,
            status: -1,
            text: '',
            params: `{name: 'leo', password: '123'}`
        }
    ]
}
```

**注意，上报的请求数据会按照平台中配置的慢加载阀值（默认值是2秒）区分成正常响应以及缓慢响应。**

### 错误数据示例

#### js 错误

普通的 js 错误以及 unhandledrejection 错误。

```js
{
    appId: 'xxx',
    time: 12345678,
    reportType: 2,
    markUser: 'usertoken',
    markUv: 'uniqueId',
    markPage: 'markPagexxx',
    url: 'http://xxx.com/b',
    errorList: [
        {
            traceId: 'traceIdxxx'
            msg: 'con is not defined',
            n: 'js',
            t: 12345678,
            data: {
                line: 1,
                col: 1,
                resourceUrl: 'http://xxx.com/index.js'
            },
        }
    ],
    behaviorList: [
                // 点击
                {
                    type: 'ui-click',
                    data: {
                        chain: 'div#id.className1.className2'
                    },
                    timeStamp: 12345678,
                },
                // 发送请求
                {
                    type: 'api',
                    data: {
                        href: 'http://xxx.com/api/login',
                    },
                    timeStamp: 12345678,
                },
                // 导航
                {
                    type: 'navigation',
                    data: {
                        from: 'http://xxx.com/b',
                        to: 'http://xxx.com/c'
                    },
                    url: 'http://xxx.com/b'
                    timeStamp: 12345678,
                }
            ]
}
```

#### 资源加载错误

```js
{
    appId: 'xxx',
    time: 12345678,
    reportType: 2,
    markUser: 'usertoken',
    markUv: 'uniqueId',
    markPage: 'markPagexxx',
    url: 'http://xxx.com/b',
    errorList: [
        {
            traceId: 'traceIdxxx'
            msg: 'The resource imported through script tag failed to load',
            n: 'resource',
            t: 12345678,
            data: {
                target: 'script',
                resourceUrl: 'http://xxx.com/wrong.js'
            }
        }
    ]
}
```

#### 请求错误数据示例

```js
{
    appId: 'xxx',
    time: 12345678,
    reportType: 3,
    markUser: 'usertoken',
    markUv: 'uniqueId',
    markPage: 'markPagexxx',
    url: 'http://xxx.com/b',
    errorList: [
        {
            traceId: 'traceIdxxx'
            msg: 'error',
            n: 'request',
            t: 12345678
            data: {
                resourceUrl: 'http://xxx.com/api/login',
                method: 'POST',
                text: 'error',
                status: -1,
                params: `{name: 'leo', password: '123'}`
            }
        }
    ]
}
```


## 配置

在 config/config.default.js 文件中对上报服务进行配置。

**在部署的时候需要修改 host 字段，将其修改为部署的域名或者ip，否则无法使用。**

### ip 解析服务

默认使用 http://ip-api.com/ 进行解析，如果需要使用百度的 ip 解析，可以在 location 中进行配置。

