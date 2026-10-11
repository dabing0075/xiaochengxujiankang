export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/checkin/index',
    'pages/weight/index',
    'pages/data/index',
    'pages/profile/index',
    'pages/edit-profile/index',
    'pages/edit-target/index',
    'pages/feedback/index',
    'pages/login/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#F7F4ED',
    navigationBarTitleText: '体重管理',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F7F4ED',
  },
  tabBar: {
    color: '#6B7280',
    selectedColor: '#F26B3A',
    backgroundColor: '#FAF8F3',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: './assets/tabbar/home.png',
        selectedIconPath: './assets/tabbar/home-active.png',
      },
      {
        pagePath: 'pages/checkin/index',
        text: '打卡',
        iconPath: './assets/tabbar/circle-plus.png',
        selectedIconPath: './assets/tabbar/circle-plus-active.png',
      },
      {
        pagePath: 'pages/weight/index',
        text: '减重',
        iconPath: './assets/tabbar/target.png',
        selectedIconPath: './assets/tabbar/target-active.png',
      },
      {
        pagePath: 'pages/data/index',
        text: '数据',
        iconPath: './assets/tabbar/trending-up.png',
        selectedIconPath: './assets/tabbar/trending-up-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: './assets/tabbar/user.png',
        selectedIconPath: './assets/tabbar/user-active.png',
      },
    ],
  },
})
