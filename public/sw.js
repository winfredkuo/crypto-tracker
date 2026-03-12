self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // 必須要有 fetch 事件監聽器，Chrome 才會判定這是一個合格的 PWA 並跳出安裝提示
});
