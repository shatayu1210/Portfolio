var cacheName = 'mOdEL^';

// console.log("registered");

var staticAssets = [
  

];


console.log("berfore install");

self.addEventListener("install", function(e) {
  e.waitUntil(
    caches.open(cacheName).then(function(cache) {
      return cache.addAll(staticAssets);
    })
  );
});

console.log("before Fetch");

self.addEventListener('fetch', function(event) {
    event.respondWith(
      caches.open(cacheName).then(function(cache) {
        return cache.match(event.request).then(function (response) {
          return response || fetch(event.request).then(function(response) {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
  });
    
  // self.addEventListener('fetch', function(event) {
  //   event.respondWith(
  //     fetch(event.request).catch(function() {
  //       return caches.match(event.request);
  //     })
  //   );
  // });
  // console.log("After Fetch");

/* Serve cached content when offline */
self.addEventListener("fetch", function(e) {
  e.respondWith(
    caches.match(e.request).then(function(response) {
      return response || fetch(e.request);
    })
  );
});
