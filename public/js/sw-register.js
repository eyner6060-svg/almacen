(function() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function(registration) {
          registration.addEventListener('updatefound', function() {
            var newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', function() {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  if (confirm('Nueva versión disponible. ¿Actualizar ahora?')) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch(function(registrationError) {
          console.log('Registro de SW falló:', registrationError);
        });
    });

    navigator.serviceWorker.addEventListener('message', function(event) {
      var msg = event.data || {};
      switch(msg.type) {
        case 'REQUEST_QUEUED':
          window.dispatchEvent(new CustomEvent('offlineRequestQueued', { detail: msg.data }));
          break;
        case 'REQUEST_SYNCED':
          window.dispatchEvent(new CustomEvent('offlineRequestSynced', { detail: msg.data }));
          break;
        case 'NOTIFICATION_CLICKED':
          window.dispatchEvent(new CustomEvent('notificationClicked', { detail: msg.data }));
          break;
      }
    });

    navigator.serviceWorker.addEventListener('controllerchange', function() {
      window.location.reload();
    });
  }
})();
