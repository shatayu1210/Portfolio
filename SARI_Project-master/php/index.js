window.onload = () => {  
    'use strict';     
    if ('serviceWorker' in navigator) {     
    navigator.serviceWorker  
    .register('serviceWorker.js'); 
    } 
    }

    window.addEventListener('beforeinstallprompt', function(e) {
        e.userChoice.then(function(choiceResult){
            console.log(choiceResult.outcome);
            if(choiceResult.outcome == 'dismissed'){
                console.log('User cancelled home screen install');
            }else{
                console.log('User added to home screen');
            }
        });
    });